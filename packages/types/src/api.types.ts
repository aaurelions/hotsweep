/**
 * API types for HotSweep REST API (future)
 */
import type { AddressOptions, AddressResult } from "./address.types";
import type { BalanceOptions, BalanceQueryResult } from "./balance.types";
import type {
  TransferOptions,
  BatchTransferOptions,
  BatchTransferResult,
  TransferResult,
} from "./transfer.types";
import type { InitOptions, InitCommandResult } from "./init.types";
import type { HotSweepConfig, ConfigPath } from "./config.types";

// ============================================================================
// API Response Wrapper
// ============================================================================

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta?: {
    timestamp: number;
    requestId: string;
    version: string;
  };
}

// ============================================================================
// Init API
// ============================================================================

export type InitRequest = InitOptions;
export type InitResponse = ApiResponse<InitCommandResult>;

// ============================================================================
// Address API
// ============================================================================

export type AddressRequest = AddressOptions;
export type AddressResponse = ApiResponse<AddressResult>;

// ============================================================================
// Balance API
// ============================================================================

export type BalanceRequest = BalanceOptions;
export type BalanceResponse = ApiResponse<BalanceQueryResult>;

// ============================================================================
// Transfer API
// ============================================================================

export type TransferRequest = TransferOptions | BatchTransferOptions;
export type TransferResponse = ApiResponse<
  TransferResult | BatchTransferResult
>;

// ============================================================================
// Config API
// ============================================================================

export interface ConfigGetRequest {
  path?: ConfigPath;
}

export interface ConfigSetRequest {
  path: ConfigPath;
  value: unknown;
}

export interface ConfigDeleteRequest {
  path: ConfigPath;
}

export type ConfigGetResponse = ApiResponse<HotSweepConfig | unknown>;
export type ConfigSetResponse = ApiResponse<{
  updated: boolean;
  previous?: unknown;
}>;
export type ConfigDeleteResponse = ApiResponse<{ deleted: boolean }>;
