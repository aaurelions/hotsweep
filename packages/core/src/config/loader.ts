/**
 * Configuration loading and management
 */
import * as fs from "node:fs";
import * as path from "node:path";
import { config as dotenvConfig } from "dotenv";
import type {
  HotSweepConfig,
  ChainConfig,
  WalletConfig,
  TokenConfig,
  CAIP2ChainId,
  ConfigValidationResult,
} from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";
import { validateConfig } from "./schema";

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_CONFIG_PATHS = [
  "./hotsweep.json",
  "./config/hotsweep.json",
  "./hotsweep.config.json",
];

const DEFAULT_ENV_PATHS = [".env", ".env.local", ".env.private"];

// ============================================================================
// Environment Loading
// ============================================================================

/**
 * Load environment variables from .env files
 */
export function loadEnv(envPath?: string): void {
  if (envPath) {
    dotenvConfig({ path: envPath });
    return;
  }

  // Try default paths
  for (const p of DEFAULT_ENV_PATHS) {
    if (fs.existsSync(p)) {
      dotenvConfig({ path: p });
    }
  }
}

/**
 * Get environment variable with optional default
 */
export function getEnv(key: string, defaultValue?: string): string | undefined {
  return process.env[key] ?? defaultValue;
}

/**
 * Get required environment variable
 */
export function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_KEY_NOT_FOUND,
      message: `Required environment variable not found: ${key}`,
    });
  }
  return value;
}

// ============================================================================
// Config Loading
// ============================================================================

/**
 * Find and load configuration file
 */
export function loadConfig(configPath?: string): HotSweepConfig {
  const resolvedPath = findConfigPath(configPath);

  if (!resolvedPath) {
    throw new HotSweepError({
      code: ErrorCodes.CONFIG_NOT_FOUND,
      message: configPath
        ? `Configuration file not found: ${configPath}`
        : `No configuration file found. Tried: ${DEFAULT_CONFIG_PATHS.join(", ")}`,
    });
  }

  return loadConfigFromPath(resolvedPath);
}

/**
 * Find configuration file path
 */
export function findConfigPath(configPath?: string): string | null {
  if (configPath) {
    const resolved = path.resolve(configPath);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
    return null;
  }

  for (const p of DEFAULT_CONFIG_PATHS) {
    const resolved = path.resolve(p);
    if (fs.existsSync(resolved)) {
      return resolved;
    }
  }

  return null;
}

/**
 * Load configuration from a specific path
 */
export function loadConfigFromPath(configPath: string): HotSweepConfig {
  try {
    const content = fs.readFileSync(configPath, "utf-8");
    const parsed = JSON.parse(content);

    const result = validateConfig(parsed);
    if (!result.success) {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_INVALID,
        message: `Configuration validation failed: ${result.error.message}`,
        context: { errors: result.error.issues },
      });
    }

    return result.data as HotSweepConfig;
  } catch (error) {
    if (error instanceof HotSweepError) {
      throw error;
    }
    if (error instanceof SyntaxError) {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_PARSE_ERROR,
        message: `Failed to parse configuration file: ${error.message}`,
        cause: error,
      });
    }
    throw new HotSweepError({
      code: ErrorCodes.INTERNAL_ERROR,
      message: `Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`,
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/**
 * Save configuration to file
 */
export function saveConfig(config: HotSweepConfig, configPath: string): void {
  const content = JSON.stringify(config, null, 2);
  fs.writeFileSync(configPath, content, "utf-8");
}

// ============================================================================
// Config Validation
// ============================================================================

/**
 * Validate configuration with detailed results
 */
export function validateConfigDetailed(
  config: unknown
): ConfigValidationResult {
  const result = validateConfig(config);

  if (result.success) {
    return {
      valid: true,
      errors: [],
      warnings: getConfigWarnings(result.data as HotSweepConfig),
    };
  }

  // Handle Zod validation errors
  const errors = result.error?.issues?.map((e) => ({
    path: e.path.join("."),
    message: e.message,
  })) ?? [
    { path: "", message: result.error?.message ?? "Unknown validation error" },
  ];

  return {
    valid: false,
    errors,
    warnings: [],
  };
}

/**
 * Get configuration warnings
 */
function getConfigWarnings(
  config: HotSweepConfig
): Array<{ path: string; message: string }> {
  const warnings: Array<{ path: string; message: string }> = [];

  // Check for disabled chains
  for (const [chainId, chain] of Object.entries(config.chains)) {
    if (!chain.enabled) {
      warnings.push({
        path: `chains.${chainId}.enabled`,
        message: `Chain ${chain.name} is disabled`,
      });
    }
  }

  // Check for missing hotsweep contracts
  for (const [chainId, chain] of Object.entries(config.chains)) {
    if (chain.enabled && (!chain.contracts || !chain.contracts.hotsweep)) {
      warnings.push({
        path: `chains.${chainId}.contracts.hotsweep`,
        message: `HotSweep contract not deployed on ${chain.name}`,
      });
    }
  }

  // Check for disabled wallets
  for (const [label, wallet] of Object.entries(config.wallets)) {
    if (!wallet.enabled) {
      warnings.push({
        path: `wallets.${label}.enabled`,
        message: `Wallet ${label} is disabled`,
      });
    }
  }

  return warnings;
}

// ============================================================================
// Config Access Helpers
// ============================================================================

/**
 * Get chain configuration by chain ID, name, or CAIP-2 ID
 */
export function getChainConfig(
  config: HotSweepConfig,
  identifier: string | number
): ChainConfig | undefined {
  // Direct CAIP-2 ID lookup
  if (typeof identifier === "string" && identifier.includes(":")) {
    return config.chains[identifier as CAIP2ChainId];
  }

  // Numeric chain ID
  if (typeof identifier === "number") {
    const caip2Id = `eip155:${identifier}` as CAIP2ChainId;
    return config.chains[caip2Id];
  }

  // String numeric chain ID
  if (/^\d+$/.test(String(identifier))) {
    const caip2Id = `eip155:${identifier}` as CAIP2ChainId;
    return config.chains[caip2Id];
  }

  // Name or alias lookup
  const normalized = String(identifier).toLowerCase();
  for (const chain of Object.values(config.chains)) {
    if (chain.name.toLowerCase() === normalized) {
      return chain;
    }
    if (chain.aliases?.some((a) => a.toLowerCase() === normalized)) {
      return chain;
    }
  }

  return undefined;
}

/**
 * Get wallet configuration by label
 */
export function getWalletConfig(
  config: HotSweepConfig,
  label: string
): WalletConfig | undefined {
  return config.wallets[label];
}

/**
 * Get token configuration
 */
export function getTokenConfig(
  config: HotSweepConfig,
  chainId: CAIP2ChainId,
  symbol: string
): TokenConfig | undefined {
  const chainTokens = config.tokens[chainId];
  if (!chainTokens) return undefined;
  return chainTokens[symbol];
}

/**
 * Get CAIP-2 chain ID from identifier
 */
export function toCaip2ChainId(
  config: HotSweepConfig,
  identifier: string | number
): CAIP2ChainId | undefined {
  // Already a CAIP-2 ID
  if (typeof identifier === "string" && identifier.includes(":")) {
    return identifier as CAIP2ChainId;
  }

  // Numeric chain ID
  if (typeof identifier === "number" || /^\d+$/.test(String(identifier))) {
    const caip2Id = `eip155:${identifier}` as CAIP2ChainId;
    if (config.chains[caip2Id]) {
      return caip2Id;
    }
    return undefined;
  }

  // Name or alias lookup
  const normalized = String(identifier).toLowerCase();
  for (const [caip2Id, chain] of Object.entries(config.chains)) {
    if (chain.name.toLowerCase() === normalized) {
      return caip2Id as CAIP2ChainId;
    }
    if (chain.aliases?.some((a) => a.toLowerCase() === normalized)) {
      return caip2Id as CAIP2ChainId;
    }
  }

  return undefined;
}
