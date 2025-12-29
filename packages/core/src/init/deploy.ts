/**
 * Contract deployment functionality
 */
import { type Address, type Hex, createWalletClient, http } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import type {
  HotSweepConfig,
  DeploymentResult,
  TestEnvironment,
  CAIP2ChainId,
} from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";
import { getPublicClient, buildChainDefinition } from "../chain";
import { requireEnv } from "../config";

// ============================================================================
// HotSweep Contract Bytecode (compiled from HotSweep.sol)
// ============================================================================

// ============================================================================
// Deployment Functions
// ============================================================================

/**
 * Deploy HotSweep contract to specified chains
 */
export async function deployContracts(
  config: HotSweepConfig,
  chainIds: number[]
): Promise<DeploymentResult[]> {
  const deployerKey = requireEnv("SWEEP_DEPLOYER_PRIVATE_KEY");
  const deployerAccount = privateKeyToAccount(deployerKey as Hex);

  const results: DeploymentResult[] = [];

  for (const numericChainId of chainIds) {
    const caip2Id = `eip155:${numericChainId}` as CAIP2ChainId;
    const chainConfig = config.chains[caip2Id];

    if (!chainConfig) {
      throw new HotSweepError({
        code: ErrorCodes.CHAIN_NOT_FOUND,
        message: `Chain configuration not found for chain ID: ${numericChainId}`,
      });
    }

    const publicClient = getPublicClient(config, caip2Id);
    const chain = buildChainDefinition(chainConfig, caip2Id);
    const rpcUrl = chainConfig.rpcUrls.default.http[0];

    if (!rpcUrl) {
      throw new HotSweepError({
        code: ErrorCodes.CHAIN_RPC_ERROR,
        message: `No RPC URL for chain: ${chainConfig.name}`,
      });
    }

    createWalletClient({
      account: deployerAccount,
      chain,
      transport: http(rpcUrl),
    });

    // Deploy contract
    // Note: In production, we'd use the actual bytecode
    // For now, we simulate the deployment
    const txHash = await deployHotSweepContract();

    // Wait for receipt
    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    if (!receipt.contractAddress) {
      throw new HotSweepError({
        code: ErrorCodes.CONTRACT_DEPLOY_FAILED,
        message: `Contract deployment failed on ${chainConfig.name}`,
      });
    }

    results.push({
      chainId: numericChainId,
      chainName: chainConfig.name,
      caip2Id,
      contract: {
        name: "HotSweep",
        address: receipt.contractAddress,
        txHash,
        blockNumber: receipt.blockNumber,
      },
      deployer: deployerAccount.address,
    });
  }

  return results;
}

/**
 * Deploy HotSweep contract (placeholder - uses forge in production)
 */
async function deployHotSweepContract(): Promise<Hex> {
  // In production, this would deploy the actual contract
  // For now, we throw an error indicating forge should be used
  throw new HotSweepError({
    code: ErrorCodes.NOT_IMPLEMENTED,
    message:
      "Use 'forge script' for contract deployment. Run: pnpm contracts:deploy",
  });
}

// ============================================================================
// Test Environment Setup
// ============================================================================

/**
 * Initialize test environment on Anvil
 */
export async function initTestEnvironment(
  config: HotSweepConfig
): Promise<TestEnvironment> {
  const anvilChainId = `eip155:31337` as CAIP2ChainId;
  const chainConfig = config.chains[anvilChainId];

  if (!chainConfig) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_NOT_FOUND,
      message:
        "Anvil chain configuration not found. Add eip155:31337 to your config.",
    });
  }

  // Anvil default accounts
  const deployerPrivateKey =
    "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as Hex;
  const hotWalletPrivateKey =
    "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d" as Hex;

  const deployerAccount = privateKeyToAccount(deployerPrivateKey);
  const hotWalletAccount = privateKeyToAccount(hotWalletPrivateKey);

  // Contract addresses (deployed by forge script)
  const defaultContractAddress =
    "0x5FbDB2315678afecb367f032d93F642f64180aa3" as Address;

  return {
    chainId: 31337,
    rpcUrl: chainConfig.rpcUrls.default.http[0] ?? "http://127.0.0.1:8545",
    contracts: {
      hotsweep: defaultContractAddress,
      mockLGCY: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512" as Address,
      mockDLGT: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0" as Address,
      mockPRMT: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9" as Address,
      mockUSDC: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9" as Address,
    },
    accounts: {
      deployer: {
        address: deployerAccount.address,
        privateKey: deployerPrivateKey,
      },
      hotWallet: {
        address: hotWalletAccount.address,
        privateKey: hotWalletPrivateKey,
      },
    },
  };
}

/**
 * Check if Anvil is running
 */
export async function checkAnvilConnection(
  rpcUrl: string = "http://127.0.0.1:8545"
): Promise<boolean> {
  try {
    const response = await fetch(rpcUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_chainId",
        params: [],
        id: 1,
      }),
    });

    const data = (await response.json()) as { result: string };
    return data.result === "0x7a69"; // 31337 in hex
  } catch {
    return false;
  }
}
