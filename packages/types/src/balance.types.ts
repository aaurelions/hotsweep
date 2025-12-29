/**
 * Balance query types for HotSweep
 */
import type { Address } from "viem";
import type { AddressSpec, OutputFormat, CAIP2ChainId } from "./common.types";

// ============================================================================
// Balance Query Options
// ============================================================================

export interface BalanceOptions {
  /** Target address(es) to check */
  target: string | AddressSpec;
  /** Filter by chain (chain ID, name, or CAIP-2 ID) */
  chain?: string | number | CAIP2ChainId;
  /** Filter by token symbol or address */
  token?: string | Address;
  /** Minimum balance threshold to display */
  min?: string | number;
  /** Output format */
  format?: OutputFormat;
  /** Save to file path */
  output?: string;
}

// ============================================================================
// Asset Balance
// ============================================================================

export interface AssetBalance {
  chainId: number;
  chainName: string;
  caip2Id: CAIP2ChainId;
  symbol: string;
  contract?: Address;
  isNative: boolean;
  balance: string; // Human-readable formatted balance
  rawBalance: string; // Raw balance as string (to avoid BigInt serialization issues)
  decimals: number;
  usdValue?: number;
}

// ============================================================================
// Address Balance Result
// ============================================================================

export interface AddressBalanceResult {
  identifier: string; // index, label, or address
  type: "index" | "label" | "address";
  address: Address;
  assets: AssetBalance[];
  totalUsdValue?: number;
}

// ============================================================================
// Balance Query Result
// ============================================================================

export interface BalanceResult {
  success: true;
  meta: {
    timestamp: number;
    count: number;
    totalUsdValue?: number;
  };
  data: AddressBalanceResult[];
}

export interface BalanceErrorResult {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type BalanceQueryResult = BalanceResult | BalanceErrorResult;

// ============================================================================
// Balance Scan Options (for sweep candidate detection)
// ============================================================================

export interface BalanceScanOptions extends BalanceOptions {
  /** Include zero balances */
  includeZero?: boolean;
  /** Price feed source for USD values */
  priceSource?: "coingecko" | "chainlink" | "none";
}
