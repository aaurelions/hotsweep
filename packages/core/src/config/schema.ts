/**
 * Configuration schema validation using Zod
 */
import { z } from "zod";

// ============================================================================
// Basic Schemas
// ============================================================================

const AddressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/);

const ChainNamespaceSchema = z.enum([
  "eip155",
  "bip122",
  "solana",
  "tron",
  "cosmos",
]);

const CAIP2ChainIdSchema = z
  .string()
  .regex(/^(eip155|bip122|solana|tron|cosmos):[a-zA-Z0-9]+$/);

const SweepStrategySchema = z.enum([
  "auto",
  "eip7702",
  "eip2612",
  "eip3009",
  "legacy",
]);

// ============================================================================
// Key Source Schemas
// ============================================================================

const KeySourceEnvSchema = z.object({
  type: z.literal("env"),
  variable: z.string(),
});

const KeySourceFileSchema = z.object({
  type: z.literal("file"),
  path: z.string(),
  encrypted: z.boolean().optional(),
});

const KeySourceHardwareSchema = z.object({
  type: z.literal("hardware"),
  device: z.enum(["ledger", "trezor"]),
  path: z.string().optional(),
});

const KeySourceKMSSchema = z.object({
  type: z.literal("kms"),
  provider: z.enum(["aws", "gcp", "azure"]),
  keyId: z.string(),
});

const KeySourceMultisigSchema = z.object({
  type: z.literal("multisig"),
  threshold: z.number().int().positive(),
  signers: z.array(z.string()),
});

const KeySourceSchema = z.discriminatedUnion("type", [
  KeySourceEnvSchema,
  KeySourceFileSchema,
  KeySourceHardwareSchema,
  KeySourceKMSSchema,
  KeySourceMultisigSchema,
]);

// ============================================================================
// Chain Configuration Schemas
// ============================================================================

const NativeCurrencySchema = z.object({
  name: z.string(),
  symbol: z.string(),
  decimals: z.number().int().min(0).max(18),
});

const RpcEndpointSchema = z.object({
  http: z.array(z.string().url()),
  webSocket: z.array(z.string().url()).optional(),
});

const RpcUrlsSchema = z.record(z.string(), RpcEndpointSchema).and(
  z.object({
    default: RpcEndpointSchema,
  })
);

const BlockExplorerSchema = z.object({
  name: z.string(),
  url: z.string().url(),
  apiUrl: z.string().url().optional(),
});

const BlockExplorersSchema = z.record(z.string(), BlockExplorerSchema).and(
  z.object({
    default: BlockExplorerSchema,
  })
);

const ContractConfigSchema = z.object({
  address: AddressSchema,
  blockCreated: z.number().int().optional(),
});

const ChainContractsSchema = z.record(
  z.string(),
  ContractConfigSchema.optional()
);

const ChainConfigSchema = z.object({
  namespace: ChainNamespaceSchema,
  chainId: z.number().int().positive().optional(),
  reference: z.string().optional(),
  name: z.string(),
  aliases: z.array(z.string()).optional(),
  coinType: z.number().int().min(0),
  enabled: z.boolean().optional().default(true),
  nativeCurrency: NativeCurrencySchema,
  blockTime: z.number().int().positive().optional(),
  rpcUrls: RpcUrlsSchema,
  blockExplorers: BlockExplorersSchema.optional(),
  contracts: ChainContractsSchema.optional(),
});

// ============================================================================
// Wallet Configuration Schema
// ============================================================================

const WalletConfigSchema = z.object({
  address: AddressSchema,
  chains: z.array(CAIP2ChainIdSchema),
  enabled: z.boolean(),
  description: z.string().optional(),
  keySource: KeySourceSchema.optional(),
});

// ============================================================================
// Token Configuration Schema
// ============================================================================

const TokenConfigSchema = z.object({
  address: AddressSchema.nullable(),
  enabled: z.boolean(),
  decimals: z.number().int().min(0).max(18).optional(),
  strategy: SweepStrategySchema.optional(),
});

// ============================================================================
// Settings Configuration Schema
// ============================================================================

const SettingsConfigSchema = z.object({
  batchSize: z.number().int().positive().default(20),
  parallelChains: z.boolean().default(true),
  retryAttempts: z.number().int().min(0).default(3),
  retryDelay: z.number().int().min(0).default(5000),
});

// ============================================================================
// Cache Configuration Schema
// ============================================================================

const CacheConfigSchema = z.object({
  queueTTL: z.number().int().positive().default(60),
  sweepCooldown: z.number().int().min(0).default(30),
  maxQueueSize: z.number().int().positive().default(10000),
  cleanupInterval: z.number().int().positive().default(60),
});

// ============================================================================
// Main Configuration Schema
// ============================================================================

export const HotSweepConfigSchema = z.object({
  version: z.literal("2.0.0"),
  chains: z.record(CAIP2ChainIdSchema, ChainConfigSchema),
  wallets: z.record(z.string(), WalletConfigSchema),
  tokens: z.record(CAIP2ChainIdSchema, z.record(z.string(), TokenConfigSchema)),
  settings: SettingsConfigSchema,
  cache: CacheConfigSchema.optional(),
});

// ============================================================================
// Type Exports
// ============================================================================

export type HotSweepConfigInput = z.input<typeof HotSweepConfigSchema>;
export type HotSweepConfigOutput = z.output<typeof HotSweepConfigSchema>;

// ============================================================================
// Validation Functions
// ============================================================================

export function validateConfig(config: unknown) {
  return HotSweepConfigSchema.safeParse(config);
}

export function parseConfig(config: unknown): HotSweepConfigOutput {
  return HotSweepConfigSchema.parse(config);
}
