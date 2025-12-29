/**
 * Configuration types for HotSweep
 */
import type { Address } from "viem";
import type {
  ChainNamespace,
  CAIP2ChainId,
  KeySource,
  SweepStrategy,
} from "./common.types";

// ============================================================================
// Native Currency
// ============================================================================

export interface NativeCurrency {
  name: string;
  symbol: string;
  decimals: number;
}

// ============================================================================
// RPC URLs
// ============================================================================

export interface RpcUrls {
  default: {
    http: string[];
    webSocket?: string[];
  };
  [key: string]: {
    http: string[];
    webSocket?: string[];
  };
}

// ============================================================================
// Block Explorer
// ============================================================================

export interface BlockExplorer {
  name: string;
  url: string;
  apiUrl?: string;
}

export interface BlockExplorers {
  default: BlockExplorer;
  [key: string]: BlockExplorer;
}

// ============================================================================
// Contract Config
// ============================================================================

export interface ContractConfig {
  address: Address;
  blockCreated?: number;
}

export interface ChainContracts {
  multicall3?: ContractConfig;
  hotsweep?: ContractConfig;
  [key: string]: ContractConfig | undefined;
}

// ============================================================================
// Chain Configuration
// ============================================================================

export interface ChainConfig {
  namespace: ChainNamespace;
  chainId?: number; // For EVM chains
  reference?: string; // For non-EVM chains (e.g., genesis hash)
  name: string;
  aliases?: string[];
  coinType: number; // BIP44 coin type
  enabled?: boolean;
  nativeCurrency: NativeCurrency;
  blockTime?: number; // in milliseconds
  rpcUrls: RpcUrls;
  blockExplorers?: BlockExplorers;
  contracts?: ChainContracts;
}

// ============================================================================
// Wallet Configuration
// ============================================================================

export interface WalletConfig {
  address: Address;
  chains: CAIP2ChainId[];
  enabled: boolean;
  description?: string;
  keySource?: KeySource;
}

// ============================================================================
// Token Configuration
// ============================================================================

export interface TokenConfig {
  address: Address | null; // null for native tokens on some chains
  enabled: boolean;
  decimals?: number;
  strategy?: SweepStrategy;
}

// ============================================================================
// Settings Configuration
// ============================================================================

export interface SettingsConfig {
  batchSize: number;
  parallelChains: boolean;
  retryAttempts: number;
  retryDelay: number; // in milliseconds
}

// ============================================================================
// Cache Configuration
// ============================================================================

export interface CacheConfig {
  queueTTL: number; // in seconds
  sweepCooldown: number; // in seconds
  maxQueueSize: number;
  cleanupInterval: number; // in seconds
}

// ============================================================================
// Main Configuration
// ============================================================================

export interface HotSweepConfig {
  version: "2.0.0";
  chains: Record<CAIP2ChainId, ChainConfig>;
  wallets: Record<string, WalletConfig>;
  tokens: Record<CAIP2ChainId, Record<string, TokenConfig>>;
  settings: SettingsConfig;
  cache?: CacheConfig;
}

// ============================================================================
// Config Validation Result
// ============================================================================

export interface ConfigValidationResult {
  valid: boolean;
  errors: Array<{
    path: string;
    message: string;
  }>;
  warnings: Array<{
    path: string;
    message: string;
  }>;
}

// ============================================================================
// Config Update Types
// ============================================================================

export type ConfigPath = string; // dot notation path, e.g., "chains.eip155:1.name"

export interface ConfigSetOptions {
  path: ConfigPath;
  value: unknown;
}

export interface ConfigDeleteOptions {
  path: ConfigPath;
}
