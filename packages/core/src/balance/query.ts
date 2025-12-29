/**
 * Balance query functionality
 */
import { type Address, type PublicClient, formatUnits, erc20Abi } from "viem";
import type {
  HotSweepConfig,
  BalanceOptions,
  BalanceQueryResult,
  AssetBalance,
  AddressBalanceResult,
  CAIP2ChainId,
  TokenConfig,
} from "@hotsweep/types";
import {
  HotSweepError,
  ErrorCodes,
  NATIVE_TOKEN_ADDRESS,
} from "@hotsweep/types";
import { getPublicClient } from "../chain";
import { toCaip2ChainId } from "../config";
import { parseAddressSpec, resolveToAddresses } from "../address";
import { generateAddress, type AddressGeneratorContext } from "../address";

// ============================================================================
// Balance Query
// ============================================================================

/**
 * Query balances for addresses across chains
 */
export async function queryBalances(
  config: HotSweepConfig,
  options: BalanceOptions,
  context?: AddressGeneratorContext
): Promise<BalanceQueryResult> {
  try {
    const addresses = resolveTargetAddresses(config, options, context);
    const results: AddressBalanceResult[] = [];

    // Determine which chains to query
    const chainIds = options.chain
      ? [toCaip2ChainId(config, options.chain)]
      : getEnabledChainIds(config);

    for (const { identifier, address } of addresses) {
      const assets: AssetBalance[] = [];

      for (const chainId of chainIds) {
        if (!chainId) continue;

        const chainConfig = config.chains[chainId];
        if (!chainConfig || !chainConfig.enabled) continue;

        try {
          const chainAssets = await queryChainBalances(
            config,
            chainId,
            address,
            options.token
          );
          assets.push(...chainAssets);
        } catch (err) {
          // Log error but continue with other chains
          const errorMsg = err instanceof Error ? err.message : String(err);
          console.warn(
            `Failed to query balances for ${address} on ${chainId}: ${errorMsg}`
          );
        }
      }

      // Filter by minimum balance
      const minBalance = options.min ? parseFloat(String(options.min)) : 0;
      const filteredAssets = assets.filter(
        (a) => parseFloat(a.balance) >= minBalance
      );

      // Calculate total USD value
      const totalUsdValue = filteredAssets.reduce(
        (sum, a) => sum + (a.usdValue ?? 0),
        0
      );

      results.push({
        identifier,
        type: inferIdentifierType(identifier),
        address,
        assets: filteredAssets,
        totalUsdValue: totalUsdValue > 0 ? totalUsdValue : undefined,
      });
    }

    const timestamp = Date.now();
    const totalUsdValue = results.reduce(
      (sum, r) => sum + (r.totalUsdValue ?? 0),
      0
    );

    return {
      success: true,
      meta: {
        timestamp,
        count: results.length,
        totalUsdValue: totalUsdValue > 0 ? totalUsdValue : undefined,
      },
      data: results,
    };
  } catch (error) {
    if (error instanceof HotSweepError) {
      return {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          details: error.context,
        },
      };
    }
    return {
      success: false,
      error: {
        code: ErrorCodes.BALANCE_QUERY_FAILED,
        message: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

/**
 * Query balances for a specific chain
 */
async function queryChainBalances(
  config: HotSweepConfig,
  chainId: CAIP2ChainId,
  address: Address,
  tokenFilter?: string | Address
): Promise<AssetBalance[]> {
  const client = getPublicClient(config, chainId);
  const chainConfig = config.chains[chainId]!;
  const chainTokens = config.tokens[chainId] ?? {};
  const assets: AssetBalance[] = [];

  // Get native balance
  if (
    !tokenFilter ||
    isNativeToken(tokenFilter, chainConfig.nativeCurrency.symbol)
  ) {
    const nativeBalance = await client.getBalance({ address });
    assets.push({
      chainId: chainConfig.chainId!,
      chainName: chainConfig.name,
      caip2Id: chainId,
      symbol: chainConfig.nativeCurrency.symbol,
      isNative: true,
      balance: formatUnits(nativeBalance, chainConfig.nativeCurrency.decimals),
      rawBalance: nativeBalance.toString(),
      decimals: chainConfig.nativeCurrency.decimals,
    });
  }

  // Get token balances
  const tokensToQuery = getTokensToQuery(chainTokens, tokenFilter);

  if (tokensToQuery.length > 0) {
    const tokenBalances = await queryTokenBalances(
      client,
      address,
      tokensToQuery
    );
    for (const [symbol, tokenConfig, balance] of tokenBalances) {
      const decimals = tokenConfig.decimals ?? 18;
      assets.push({
        chainId: chainConfig.chainId!,
        chainName: chainConfig.name,
        caip2Id: chainId,
        symbol,
        contract: tokenConfig.address!,
        isNative: false,
        balance: formatUnits(balance, decimals),
        rawBalance: balance.toString(),
        decimals,
      });
    }
  }

  return assets;
}

/**
 * Query multiple token balances using multicall
 */
async function queryTokenBalances(
  client: PublicClient,
  address: Address,
  tokens: Array<[string, TokenConfig]>
): Promise<Array<[string, TokenConfig, bigint]>> {
  const results: Array<[string, TokenConfig, bigint]> = [];

  const calls = tokens
    .filter(
      ([, config]) => config.address && config.address !== NATIVE_TOKEN_ADDRESS
    )
    .map(([symbol, config]) => ({
      symbol,
      config,
      address: config.address!,
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address] as const,
    }));

  if (calls.length === 0) return results;

  try {
    const balances = await client.multicall({
      contracts: calls.map((c) => ({
        address: c.address,
        abi: c.abi,
        functionName: c.functionName,
        args: c.args,
      })),
    });

    for (let i = 0; i < balances.length; i++) {
      const result = balances[i]!;
      const call = calls[i]!;
      if (result.status === "success") {
        results.push([call.symbol, call.config, result.result as bigint]);
      }
    }
  } catch {
    // Fallback to individual calls if multicall fails
    for (const call of calls) {
      try {
        const balance = await client.readContract({
          address: call.address,
          abi: erc20Abi,
          functionName: "balanceOf",
          args: [address],
        });
        results.push([call.symbol, call.config, balance]);
      } catch {
        // Skip failed token queries
      }
    }
  }

  return results;
}

// ============================================================================
// Helper Functions
// ============================================================================

function resolveTargetAddresses(
  config: HotSweepConfig,
  options: BalanceOptions,
  context?: AddressGeneratorContext
): Array<{ identifier: string; address: Address }> {
  const spec = parseAddressSpec(String(options.target), config.wallets);

  const addressResolver = context
    ? (index: number) => generateAddress(context, index).address
    : undefined;

  return resolveToAddresses(spec, config.wallets, addressResolver);
}

function getEnabledChainIds(config: HotSweepConfig): CAIP2ChainId[] {
  return Object.entries(config.chains)
    .filter(([, c]) => c.enabled && c.namespace === "eip155")
    .map(([id]) => id as CAIP2ChainId);
}

function isNativeToken(
  filter: string | Address,
  nativeSymbol: string
): boolean {
  const normalized = filter.toLowerCase();
  return (
    normalized === nativeSymbol.toLowerCase() ||
    normalized === "native" ||
    normalized === NATIVE_TOKEN_ADDRESS.toLowerCase()
  );
}

function getTokensToQuery(
  tokens: Record<string, TokenConfig>,
  filter?: string | Address
): Array<[string, TokenConfig]> {
  if (!filter) {
    return Object.entries(tokens).filter(
      ([, c]: [string, TokenConfig]) =>
        c.enabled && c.address && c.address !== NATIVE_TOKEN_ADDRESS
    );
  }

  const normalized = filter.toLowerCase();

  // Filter by symbol
  for (const [symbol, config] of Object.entries(tokens)) {
    if (symbol.toLowerCase() === normalized && config.enabled) {
      return [[symbol, config]];
    }
  }

  // Filter by address
  for (const [symbol, config] of Object.entries(tokens)) {
    if (config.address?.toLowerCase() === normalized && config.enabled) {
      return [[symbol, config]];
    }
  }

  return [];
}

function inferIdentifierType(
  identifier: string
): "index" | "label" | "address" {
  if (/^\d+$/.test(identifier)) return "index";
  if (/^0x[a-fA-F0-9]{40}$/.test(identifier)) return "address";
  return "label";
}
