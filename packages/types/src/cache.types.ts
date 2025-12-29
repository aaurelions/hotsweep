/**
 * Cache types for HotSweep
 */
import type { Address, Hex } from "viem";
import type { CAIP2ChainId, SweepStrategy } from "./common.types";

// ============================================================================
// Cache Entry Types
// ============================================================================

export interface CacheEntry<T> {
  value: T;
  createdAt: number;
  expiresAt: number;
  ttl: number;
}

// ============================================================================
// Balance Cache
// ============================================================================

export interface BalanceCacheKey {
  address: Address;
  chainId: CAIP2ChainId;
  token: Address | "native";
}

export interface BalanceCacheValue {
  balance: string; // Raw balance as string
  lastUpdated: number;
  blockNumber?: bigint;
}

// ============================================================================
// Nonce Cache
// ============================================================================

export interface NonceCacheKey {
  address: Address;
  chainId: CAIP2ChainId;
}

export interface NonceCacheValue {
  nonce: number;
  pendingTxs: number;
  lastUpdated: number;
}

// ============================================================================
// Strategy Cache (which strategy works for which token)
// ============================================================================

export interface StrategyCacheKey {
  token: Address;
  chainId: CAIP2ChainId;
}

export interface StrategyCacheValue {
  strategy: SweepStrategy;
  supportsEIP2612: boolean;
  supportsEIP3009: boolean;
  supportsEIP7702: boolean;
  lastChecked: number;
}

// ============================================================================
// Sweep Queue Entry
// ============================================================================

export interface SweepQueueEntry {
  id: string;
  from: Address;
  to: Address;
  chainId: CAIP2ChainId;
  token: Address | "native";
  amount: string | "all";
  strategy?: SweepStrategy;
  priority: number;
  createdAt: number;
  status: "pending" | "processing" | "completed" | "failed";
  retryCount: number;
  lastError?: string;
  txHash?: Hex;
}

// ============================================================================
// Cache Stats
// ============================================================================

export interface CacheStats {
  hits: number;
  misses: number;
  size: number;
  maxSize: number;
  hitRate: number;
}
