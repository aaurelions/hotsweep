/**
 * Initialization types for HotSweep
 */
import type { Address, Hex } from "viem";
import type { CAIP2ChainId } from "./common.types";

// ============================================================================
// Init Options
// ============================================================================

export interface InitOptions {
  /** Deploy contracts to specified chains (comma-separated chain IDs) */
  deploy?: string;
  /** Initialize test environment (Anvil) */
  test?: boolean;
  /** Config file path */
  config?: string;
  /** Overwrite existing deployments */
  force?: boolean;
}

// ============================================================================
// Deployment Result
// ============================================================================

export interface DeploymentResult {
  chainId: number;
  chainName: string;
  caip2Id: CAIP2ChainId;
  contract: {
    name: string;
    address: Address;
    txHash: Hex;
    blockNumber: bigint;
  };
  deployer: Address;
}

// ============================================================================
// Init Result
// ============================================================================

export interface InitResult {
  success: true;
  mode: "deploy" | "test" | "validate";
  deployments?: DeploymentResult[];
  config: {
    path: string;
    valid: boolean;
    version: string;
    chainsConfigured: number;
    walletsConfigured: number;
    tokensConfigured: number;
  };
  warnings?: string[];
}

export interface InitErrorResult {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type InitCommandResult = InitResult | InitErrorResult;

// ============================================================================
// Test Environment Setup
// ============================================================================

export interface TestEnvironment {
  chainId: 31337;
  rpcUrl: string;
  contracts: {
    hotsweep: Address;
    mockLGCY: Address;
    mockDLGT: Address;
    mockPRMT: Address;
    mockUSDC: Address;
  };
  accounts: {
    deployer: {
      address: Address;
      privateKey: Hex;
    };
    hotWallet: {
      address: Address;
      privateKey: Hex;
    };
  };
}
