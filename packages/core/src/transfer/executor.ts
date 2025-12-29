/**
 * Transfer execution engine
 */
import {
  type Address,
  type Hex,
  type PublicClient,
  type LocalAccount,
  createWalletClient,
  http,
  parseUnits,
  formatUnits,
  erc20Abi,
} from "viem";
import type {
  HotSweepConfig,
  TransferOptions,
  TransferResult,
  SweepStrategy,
  CAIP2ChainId,
  ChainConfig,
} from "@hotsweep/types";
import {
  HotSweepError,
  ErrorCodes,
  NATIVE_TOKEN_ADDRESS,
} from "@hotsweep/types";
import { getPublicClient, buildChainDefinition } from "../chain";
import { toCaip2ChainId, getTokenConfig } from "../config";
import {
  parseAddressSpec,
  resolveToAddress,
  resolveToAddresses,
} from "../address";
import { generateAddress, type AddressGeneratorContext } from "../address";
import { detectStrategy } from "./strategy";
import { signPermit, signTransferWithAuthorization } from "./signatures";
import {
  hdKeyFromMnemonic,
  hdKeyFromExtendedKey,
  accountFromHDKey,
} from "../wallet";

// ============================================================================
// Contract ABIs
// ============================================================================

// ============================================================================
// Transfer Execution Context
// ============================================================================

export interface TransferContext {
  config: HotSweepConfig;
  addressContext?: AddressGeneratorContext;
  signerAccount?: LocalAccount;
}

// ============================================================================
// Single Transfer Execution
// ============================================================================

/**
 * Execute a single transfer
 */
export async function executeTransfer(
  context: TransferContext,
  options: TransferOptions
): Promise<TransferResult> {
  const { config, addressContext } = context;

  try {
    // Resolve chain
    const chainId = toCaip2ChainId(config, options.chain);
    if (!chainId) {
      throw new HotSweepError({
        code: ErrorCodes.CHAIN_NOT_FOUND,
        message: `Chain not found: ${options.chain}`,
      });
    }

    const chainConfig = config.chains[chainId]!;
    const client = getPublicClient(config, chainId);

    // Resolve addresses
    const fromSpec = parseAddressSpec(String(options.from), config.wallets);
    const toSpec = parseAddressSpec(String(options.to), config.wallets);

    const addressResolver = addressContext
      ? (index: number) => generateAddress(addressContext, index).address
      : undefined;

    const fromAddresses = resolveToAddresses(
      fromSpec,
      config.wallets,
      addressResolver
    );
    const toAddress = resolveToAddress(toSpec, config.wallets, addressResolver);

    // Resolve token
    const tokenAddress = resolveTokenAddress(config, chainId, options.token);
    const tokenConfig = getTokenConfig(config, chainId, String(options.token));
    const isNative =
      tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();
    const decimals = tokenConfig?.decimals ?? (isNative ? 18 : 18);

    // Get token symbol
    let symbol = String(options.token);
    if (!isNative && tokenAddress !== NATIVE_TOKEN_ADDRESS) {
      try {
        symbol = await client.readContract({
          address: tokenAddress,
          abi: erc20Abi,
          functionName: "symbol",
        });
      } catch {
        // Keep original symbol
      }
    }

    // Execute transfers for each source address
    const results: TransferResult[] = [];

    for (const { identifier, address: fromAddress } of fromAddresses) {
      try {
        const result = await executeSingleTransfer(
          context,
          client,
          chainId,
          chainConfig,
          fromAddress,
          identifier,
          toAddress,
          String(options.to),
          tokenAddress,
          symbol,
          decimals,
          options.amount,
          options.strategy,
          options.dryRun
        );
        results.push(result);
      } catch (error) {
        results.push({
          success: false,
          from: { identifier, address: fromAddress },
          to: { identifier: String(options.to), address: toAddress },
          error: {
            code:
              error instanceof HotSweepError
                ? error.code
                : ErrorCodes.TRANSFER_FAILED,
            message: error instanceof Error ? error.message : String(error),
          },
        });
      }
    }

    // Return first result for single transfer, or last for batch
    return results.length === 1 ? results[0]! : results[results.length - 1]!;
  } catch (error) {
    const fromSpec = parseAddressSpec(String(options.from), config.wallets);
    const toSpec = parseAddressSpec(String(options.to), config.wallets);

    return {
      success: false,
      from: {
        identifier: String(options.from),
        address: (fromSpec.type === "address"
          ? fromSpec.value
          : "0x0") as Address,
      },
      to: {
        identifier: String(options.to),
        address: (toSpec.type === "address" ? toSpec.value : "0x0") as Address,
      },
      error: {
        code:
          error instanceof HotSweepError
            ? error.code
            : ErrorCodes.TRANSFER_FAILED,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Execute a single address-to-address transfer
 */
async function executeSingleTransfer(
  context: TransferContext,
  client: PublicClient,
  chainId: CAIP2ChainId,
  chainConfig: ChainConfig,
  fromAddress: Address,
  fromIdentifier: string,
  toAddress: Address,
  toIdentifier: string,
  tokenAddress: Address,
  symbol: string,
  decimals: number,
  amount: string | "all",
  strategyOption?: SweepStrategy,
  dryRun?: boolean
): Promise<TransferResult> {
  const isNative =
    tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase();

  // Check balance
  let balance: bigint;
  if (isNative) {
    balance = await client.getBalance({ address: fromAddress });
  } else {
    balance = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [fromAddress],
    });
  }

  // Calculate transfer amount
  let transferAmount: bigint;
  if (amount === "all") {
    if (isNative) {
      // Reserve gas for transfer
      const gasPrice = await client.getGasPrice();
      const estimatedGas = 21000n;
      const gasCost = gasPrice * estimatedGas * 2n; // 2x buffer
      transferAmount = balance > gasCost ? balance - gasCost : 0n;
    } else {
      transferAmount = balance;
    }
  } else {
    transferAmount = parseUnits(amount, decimals);
  }

  if (transferAmount === 0n) {
    throw new HotSweepError({
      code: ErrorCodes.TRANSFER_INSUFFICIENT_BALANCE,
      message: "Insufficient balance for transfer",
    });
  }

  if (transferAmount > balance) {
    throw new HotSweepError({
      code: ErrorCodes.TRANSFER_INSUFFICIENT_BALANCE,
      message: `Insufficient balance: ${formatUnits(balance, decimals)} < ${formatUnits(transferAmount, decimals)}`,
    });
  }

  // Determine strategy
  const tokenConfig = context.config.tokens[chainId]?.[symbol];
  const strategy =
    strategyOption === "auto" || !strategyOption
      ? await detectStrategy(client, tokenAddress, tokenConfig)
      : strategyOption;

  if (dryRun) {
    // Simulate only
    return {
      success: true,
      from: { identifier: fromIdentifier, address: fromAddress },
      to: { identifier: toIdentifier, address: toAddress },
      chain: {
        id: chainConfig.chainId!,
        name: chainConfig.name,
        caip2Id: chainId,
      },
      token: { symbol, address: tokenAddress },
      amount: {
        value: formatUnits(transferAmount, decimals),
        raw: transferAmount.toString(),
      },
      strategy,
      tx: { hash: "0x" as Hex },
      reference: undefined,
    };
  }

  // Get signer account
  const account = getSignerAccount(context, fromIdentifier);
  if (!account) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_KEY_NOT_FOUND,
      message: `No signer available for address: ${fromAddress}`,
    });
  }

  // Create wallet client
  const chain = buildChainDefinition(chainConfig, chainId);
  const rpcUrl = chainConfig.rpcUrls.default.http[0];
  const walletClient = createWalletClient({
    account,
    chain,
    transport: http(rpcUrl),
  });

  // Execute based on strategy
  let txHash: Hex;

  if (isNative) {
    // Native transfer
    txHash = await walletClient.sendTransaction({
      to: toAddress,
      value: transferAmount,
    });
  } else if (strategy === "legacy") {
    // ERC20 transfer
    txHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [toAddress, transferAmount],
    });
  } else if (strategy === "eip2612") {
    // EIP-2612 permit + transferFrom
    const tokenName = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "name",
    });

    const nonce = await client.readContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [{ name: "owner", type: "address" }],
          name: "nonces",
          outputs: [{ name: "", type: "uint256" }],
          stateMutability: "view",
          type: "function",
        },
      ],
      functionName: "nonces",
      args: [fromAddress],
    });

    const permitData = await signPermit(account, client, {
      tokenAddress,
      tokenName,
      spender: toAddress,
      value: transferAmount,
      nonce,
    });

    // Execute permit + transfer
    txHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [
            { name: "owner", type: "address" },
            { name: "spender", type: "address" },
            { name: "value", type: "uint256" },
            { name: "deadline", type: "uint256" },
            { name: "v", type: "uint8" },
            { name: "r", type: "bytes32" },
            { name: "s", type: "bytes32" },
          ],
          name: "permit",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "permit",
      args: [
        permitData.owner,
        permitData.spender,
        permitData.value,
        permitData.deadline,
        permitData.v,
        permitData.r,
        permitData.s,
      ],
    });

    // Transfer after permit
    await walletClient.writeContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "transfer",
      args: [toAddress, transferAmount],
    });
  } else if (strategy === "eip3009") {
    // EIP-3009 transferWithAuthorization
    const tokenName = await client.readContract({
      address: tokenAddress,
      abi: erc20Abi,
      functionName: "name",
    });

    const authData = await signTransferWithAuthorization(account, client, {
      tokenAddress,
      tokenName,
      to: toAddress,
      value: transferAmount,
    });

    txHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: [
        {
          inputs: [
            { name: "from", type: "address" },
            { name: "to", type: "address" },
            { name: "value", type: "uint256" },
            { name: "validAfter", type: "uint256" },
            { name: "validBefore", type: "uint256" },
            { name: "nonce", type: "bytes32" },
            { name: "v", type: "uint8" },
            { name: "r", type: "bytes32" },
            { name: "s", type: "bytes32" },
          ],
          name: "transferWithAuthorization",
          outputs: [],
          stateMutability: "nonpayable",
          type: "function",
        },
      ],
      functionName: "transferWithAuthorization",
      args: [
        authData.from,
        authData.to,
        authData.value,
        authData.validAfter,
        authData.validBefore,
        authData.nonce,
        authData.v,
        authData.r,
        authData.s,
      ],
    });
  } else {
    throw new HotSweepError({
      code: ErrorCodes.STRATEGY_UNSUPPORTED,
      message: `Strategy not supported: ${strategy}`,
    });
  }

  // Wait for confirmation
  const receipt = await client.waitForTransactionReceipt({ hash: txHash });

  return {
    success: true,
    from: { identifier: fromIdentifier, address: fromAddress },
    to: { identifier: toIdentifier, address: toAddress },
    chain: {
      id: chainConfig.chainId!,
      name: chainConfig.name,
      caip2Id: chainId,
    },

    token: { symbol, address: tokenAddress },
    amount: {
      value: formatUnits(transferAmount, decimals),
      raw: transferAmount.toString(),
    },
    strategy,
    tx: {
      hash: txHash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed,
      effectiveGasPrice: receipt.effectiveGasPrice,
    },
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

function resolveTokenAddress(
  config: HotSweepConfig,
  chainId: CAIP2ChainId,
  token: string | Address
): Address {
  // Check if it's already an address
  if (/^0x[a-fA-F0-9]{40}$/.test(token)) {
    return token as Address;
  }

  // Native token aliases
  const chainConfig = config.chains[chainId];
  if (
    token.toUpperCase() === chainConfig?.nativeCurrency.symbol.toUpperCase() ||
    token.toLowerCase() === "native"
  ) {
    return NATIVE_TOKEN_ADDRESS;
  }

  // Look up in token config
  const tokenConfig = getTokenConfig(config, chainId, token);
  if (tokenConfig?.address) {
    return tokenConfig.address;
  }

  throw new HotSweepError({
    code: ErrorCodes.TOKEN_NOT_FOUND,
    message: `Token not found: ${token} on chain ${chainId}`,
  });
}

function getSignerAccount(
  context: TransferContext,
  identifier: string
): LocalAccount | undefined {
  // If signer account is provided directly
  if (context.signerAccount) {
    return context.signerAccount;
  }

  // Try to derive from HD wallet context
  if (context.addressContext) {
    const index = parseInt(identifier, 10);
    if (!isNaN(index)) {
      const mnemonic = context.addressContext.mnemonic;
      const xpriv = context.addressContext.xpriv;

      if (mnemonic) {
        const hdKey = hdKeyFromMnemonic(
          mnemonic,
          context.addressContext.passphrase
        );
        return accountFromHDKey(hdKey, index);
      }

      if (xpriv) {
        const hdKey = hdKeyFromExtendedKey(xpriv);
        return accountFromHDKey(hdKey, index);
      }
    }
  }

  return undefined;
}
