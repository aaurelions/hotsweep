/**
 * Dot notation path utilities for configuration access
 */
import type { HotSweepConfig, ConfigPath } from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";

// ============================================================================
// Get Value by Path
// ============================================================================

/**
 * Get a value from config using dot notation path
 * @example getByPath(config, "chains.eip155:1.name") // "ethereum"
 * @example getByPath(config, "settings.batchSize") // 20
 */
export function getByPath(config: HotSweepConfig, path: ConfigPath): unknown {
  const parts = parseDotPath(path);
  let current: unknown = config;

  for (const part of parts) {
    if (current === null || current === undefined) {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_PATH_NOT_FOUND,
        message: `Path not found: ${path}`,
      });
    }

    if (typeof current !== "object") {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_PATH_NOT_FOUND,
        message: `Cannot access property '${part}' on non-object at path: ${path}`,
      });
    }

    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/**
 * Check if a path exists in config
 */
export function hasPath(config: HotSweepConfig, path: ConfigPath): boolean {
  try {
    const value = getByPath(config, path);
    return value !== undefined;
  } catch {
    return false;
  }
}

// ============================================================================
// Set Value by Path
// ============================================================================

/**
 * Set a value in config using dot notation path
 * Returns a new config object (immutable)
 */
export function setByPath(
  config: HotSweepConfig,
  path: ConfigPath,
  value: unknown
): HotSweepConfig {
  const parts = parseDotPath(path);
  if (parts.length === 0) {
    throw new HotSweepError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "Empty path not allowed",
    });
  }

  // Deep clone config
  const newConfig = JSON.parse(JSON.stringify(config)) as HotSweepConfig;

  let current: Record<string, unknown> = newConfig as unknown as Record<
    string,
    unknown
  >;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;

    if (!(part in current)) {
      // Create intermediate objects
      current[part] = {};
    }

    const next = current[part];
    if (typeof next !== "object" || next === null) {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_TYPE_MISMATCH,
        message: `Cannot set property on non-object at: ${parts.slice(0, i + 1).join(".")}`,
      });
    }

    current = next as Record<string, unknown>;
  }

  // Set the value
  const lastPart = parts[parts.length - 1]!;
  current[lastPart] = value;

  return newConfig;
}

// ============================================================================
// Delete by Path
// ============================================================================

/**
 * Delete a key from config using dot notation path
 * Returns a new config object (immutable)
 */
export function deleteByPath(
  config: HotSweepConfig,
  path: ConfigPath
): HotSweepConfig {
  const parts = parseDotPath(path);
  if (parts.length === 0) {
    throw new HotSweepError({
      code: ErrorCodes.VALIDATION_ERROR,
      message: "Empty path not allowed",
    });
  }

  // Deep clone config
  const newConfig = JSON.parse(JSON.stringify(config)) as HotSweepConfig;

  let current: Record<string, unknown> = newConfig as unknown as Record<
    string,
    unknown
  >;

  // Navigate to parent
  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i]!;

    if (!(part in current)) {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_PATH_NOT_FOUND,
        message: `Path not found: ${path}`,
      });
    }

    const next = current[part];
    if (typeof next !== "object" || next === null) {
      throw new HotSweepError({
        code: ErrorCodes.CONFIG_PATH_NOT_FOUND,
        message: `Path not found: ${path}`,
      });
    }

    current = next as Record<string, unknown>;
  }

  // Delete the key
  const lastPart = parts[parts.length - 1]!;
  if (!(lastPart in current)) {
    throw new HotSweepError({
      code: ErrorCodes.CONFIG_PATH_NOT_FOUND,
      message: `Path not found: ${path}`,
    });
  }

  delete current[lastPart];

  return newConfig;
}

// ============================================================================
// Path Parsing
// ============================================================================

/**
 * Parse dot notation path into parts
 * Handles CAIP-2 chain IDs (e.g., "eip155:1")
 * @example parseDotPath("chains.eip155:1.name") // ["chains", "eip155:1", "name"]
 * @example parseDotPath("settings.batchSize") // ["settings", "batchSize"]
 */
export function parseDotPath(path: string): string[] {
  if (!path) return [];

  const parts: string[] = [];
  let current = "";
  let inBracket = false;

  for (let i = 0; i < path.length; i++) {
    const char = path[i]!;

    if (char === "[") {
      if (current) {
        parts.push(current);
        current = "";
      }
      inBracket = true;
    } else if (char === "]") {
      if (current) {
        // Remove quotes if present
        const cleaned = current.replace(/^['"]|['"]$/g, "");
        parts.push(cleaned);
        current = "";
      }
      inBracket = false;
    } else if (char === "." && !inBracket) {
      if (current) {
        parts.push(current);
        current = "";
      }
    } else {
      current += char;
    }
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

/**
 * Build a dot notation path from parts
 */
export function buildDotPath(parts: string[]): ConfigPath {
  return parts.join(".") as ConfigPath;
}

// ============================================================================
// Type Conversion Helpers
// ============================================================================

/**
 * Infer and convert value type for config setting
 */
export function inferType(value: string): unknown {
  // Boolean
  if (value === "true") return true;
  if (value === "false") return false;

  // Null
  if (value === "null") return null;

  // Number
  if (/^-?\d+$/.test(value)) return parseInt(value, 10);
  if (/^-?\d+\.\d+$/.test(value)) return parseFloat(value);

  // JSON array or object
  if (
    (value.startsWith("[") && value.endsWith("]")) ||
    (value.startsWith("{") && value.endsWith("}"))
  ) {
    try {
      return JSON.parse(value);
    } catch {
      // Return as string if JSON parse fails
    }
  }

  // String
  return value;
}
