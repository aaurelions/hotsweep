/**
 * Transfer and sweep types for HotSweep
 */
import type { Address, Hex } from "viem";
import type { AddressSpec, SweepStrategy, CAIP2ChainId } from "./common.types";

// ============================================================================
// Transfer Options
// ============================================================================

export interface TransferOptions {
  /** Source address specification */
  from: string | AddressSpec;
  /** Destination address specification */
  to: string | AddressSpec;
  /** Chain ID, name, or CAIP-2 ID */
  chain: string | number | CAIP2ChainId;
  /** Token symbol or contract address */
  token: string | Address;
  /** Amount to transfer ("all" for full balance) */
  amount: string | "all";
  /** Transaction reference ID */
  ref?: string;
  /** Sweep strategy to use */
  strategy?: SweepStrategy;
  /** Dry run (simulate without broadcasting) */
  dryRun?: boolean;
  /** Number of parallel transfers */
  parallel?: number;
}

// ============================================================================
// Batch Transfer Options
// ============================================================================

export interface BatchTransferOptions {
  /** Path to batch file (JSON or CSV) */
  batch: string;
  /** Number of parallel transfers */
  parallel?: number;
  /** Dry run (simulate without broadcasting) */
  dryRun?: boolean;
}

// ============================================================================
// Batch File Entry (JSON format)
// ============================================================================

export interface BatchTransferEntry {
  chainId: number;
  from: AddressSpec;
  to: AddressSpec;
  token: string | Address;
  amount: string | "all";
  reference?: string;
  strategy?: SweepStrategy;
}

// ============================================================================
// Transfer Result
// ============================================================================

export interface TransferResultSuccess {
  success: true;
  from: {
    identifier: string;
    address: Address;
  };
  to: {
    identifier: string;
    address: Address;
  };
  chain: {
    id: number;
    name: string;
    caip2Id: CAIP2ChainId;
  };
  token: {
    symbol: string;
    address: Address;
  };
  amount: {
    value: string;
    raw: string;
    usdValue?: number;
  };
  strategy: SweepStrategy;
  tx: {
    hash: Hex;
    blockNumber?: bigint;
    gasUsed?: bigint;
    effectiveGasPrice?: bigint;
  };
  reference?: string;
}

export interface TransferResultError {
  success: false;
  from: {
    identifier: string;
    address: Address;
  };
  to: {
    identifier: string;
    address: Address;
  };
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type TransferResult = TransferResultSuccess | TransferResultError;

// ============================================================================
// Batch Transfer Result
// ============================================================================

export interface BatchTransferResult {
  success: boolean;
  meta: {
    total: number;
    successful: number;
    failed: number;
    timestamp: number;
  };
  results: TransferResult[];
}

// ============================================================================
// Transfer Simulation Result (Dry Run)
// ============================================================================

export interface TransferSimulation {
  from: Address;
  to: Address;
  chain: {
    id: number;
    name: string;
  };
  token: {
    symbol: string;
    address: Address;
  };
  amount: {
    value: string;
    raw: string;
  };
  strategy: SweepStrategy;
  estimatedGas: {
    gas: bigint;
    gasPrice: bigint;
    totalCost: string;
    totalCostUsd?: number;
  };
  savings?: {
    legacyGasCost: string;
    optimizedGasCost: string;
    savingsPercent: number;
  };
}

// ============================================================================
// EIP-2612 Permit Data
// ============================================================================

export interface PermitData {
  owner: Address;
  spender: Address;
  value: bigint;
  deadline: bigint;
  v: number;
  r: Hex;
  s: Hex;
}

// ============================================================================
// EIP-3009 Authorization Data
// ============================================================================

export interface AuthorizationData {
  from: Address;
  to: Address;
  value: bigint;
  validAfter: bigint;
  validBefore: bigint;
  nonce: Hex;
  v: number;
  r: Hex;
  s: Hex;
}

// ============================================================================
// EIP-7702 Authorization
// ============================================================================

export interface EIP7702Authorization {
  chainId: number;
  contractAddress: Address;
  nonce: bigint;
  r: Hex;
  s: Hex;
  yParity: number;
}
