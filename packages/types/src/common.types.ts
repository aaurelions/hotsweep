/**
 * Common types shared across HotSweep packages
 */
import type { Address, Hex } from "viem";

// ============================================================================
// Chain Namespace Types (CAIP-2)
// ============================================================================

export type ChainNamespace = "eip155" | "bip122" | "solana" | "tron" | "cosmos";
export type CAIP2ChainId = `${ChainNamespace}:${string}`;

// ============================================================================
// Address Specification Types
// ============================================================================

export type AddressSpecType =
  | "index"
  | "indices"
  | "range"
  | "address"
  | "label";

export interface AddressSpecIndex {
  type: "index";
  value: number;
}

export interface AddressSpecIndices {
  type: "indices";
  value: number[];
}

export interface AddressSpecRange {
  type: "range";
  value: string; // e.g., "0-10,99,500-505"
}

export interface AddressSpecAddress {
  type: "address";
  value: Address;
}

export interface AddressSpecLabel {
  type: "label";
  value: string;
}

export type AddressSpec =
  | AddressSpecIndex
  | AddressSpecIndices
  | AddressSpecRange
  | AddressSpecAddress
  | AddressSpecLabel;

// ============================================================================
// Key Source Types
// ============================================================================

export type KeySourceType = "env" | "file" | "hardware" | "kms" | "multisig";

export interface KeySourceEnv {
  type: "env";
  variable: string;
}

export interface KeySourceFile {
  type: "file";
  path: string;
  encrypted?: boolean;
}

export interface KeySourceHardware {
  type: "hardware";
  device: "ledger" | "trezor";
  path?: string;
}

export interface KeySourceKMS {
  type: "kms";
  provider: "aws" | "gcp" | "azure";
  keyId: string;
}

export interface KeySourceMultisig {
  type: "multisig";
  threshold: number;
  signers: string[];
}

export type KeySource =
  | KeySourceEnv
  | KeySourceFile
  | KeySourceHardware
  | KeySourceKMS
  | KeySourceMultisig;

// ============================================================================
// HD Wallet Types
// ============================================================================

export interface HDPath {
  purpose: number; // BIP44 = 44
  coinType: number; // ETH = 60, BTC = 0
  account: number;
  change: number;
  addressIndex: number;
}

export interface DerivedAddress {
  index: number;
  path: string;
  address: Address;
  publicKey?: Hex;
}

// ============================================================================
// Strategy Types
// ============================================================================

export type SweepStrategy =
  | "auto"
  | "eip7702"
  | "eip2612"
  | "eip3009"
  | "legacy";

// ============================================================================
// Output Format Types
// ============================================================================

export type OutputFormat = "json" | "csv" | "table" | "text";

// ============================================================================
// Native Token Constant
// ============================================================================

export const NATIVE_TOKEN_ADDRESS =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

// ============================================================================
// Result Types
// ============================================================================

export interface SuccessResult<T> {
  success: true;
  data: T;
}

export interface ErrorResult {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type Result<T> = SuccessResult<T> | ErrorResult;

// ============================================================================
// Pagination Types
// ============================================================================

export interface PaginationOptions {
  page?: number;
  limit?: number;
  offset?: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    limit: number;
    hasMore: boolean;
  };
}
