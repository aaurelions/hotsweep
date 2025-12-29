/**
 * Address specification parser
 */
import { isAddress, type Address } from "viem";
import type { AddressSpec, WalletConfig } from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";

// ============================================================================
// Parse Address Specification
// ============================================================================

/**
 * Parse a string into an AddressSpec
 */
export function parseAddressSpec(
  value: string | number | AddressSpec,
  wallets?: Record<string, WalletConfig>
): AddressSpec {
  // Already an AddressSpec object
  if (typeof value === "object" && "type" in value) {
    return value;
  }

  // Number = index
  if (typeof value === "number") {
    return { type: "index", value };
  }

  const str = value.trim();

  // Check if it's a valid Ethereum address
  if (isAddress(str)) {
    return { type: "address", value: str as Address };
  }

  // Check if it's a simple number (index)
  if (/^\d+$/.test(str)) {
    return { type: "index", value: parseInt(str, 10) };
  }

  // Check if it's a comma-separated list of numbers (indices)
  if (/^[\d,\s]+$/.test(str) && !str.includes("-")) {
    const indices = str
      .split(",")
      .map((s: string) => parseInt(s.trim(), 10))
      .filter((n: number) => !isNaN(n));
    return { type: "indices", value: indices };
  }

  // Check if it's a range (contains - or ,)
  if (/^[\d\-,\s]+$/.test(str) && str.includes("-")) {
    return { type: "range", value: str };
  }

  // Check if it's a wallet label
  if (wallets && str in wallets) {
    return { type: "label", value: str };
  }

  // Assume it's a label if nothing else matches
  return { type: "label", value: str };
}

// ============================================================================
// Expand Range to Indices
// ============================================================================

/**
 * Parse a range string like "0-10,15,20-25" into an array of indices
 */
export function parseRange(range: string): number[] {
  const indices: number[] = [];
  const parts = range.split(",").map((s) => s.trim());

  for (const part of parts) {
    if (part.includes("-")) {
      const [startStr, endStr] = part.split("-");
      const start = parseInt(startStr!.trim(), 10);
      const end = parseInt(endStr!.trim(), 10);

      if (isNaN(start) || isNaN(end)) {
        throw new HotSweepError({
          code: ErrorCodes.ADDRESS_RANGE_INVALID,
          message: `Invalid range part: ${part}`,
        });
      }

      if (start > end) {
        throw new HotSweepError({
          code: ErrorCodes.ADDRESS_RANGE_INVALID,
          message: `Invalid range: start (${start}) > end (${end})`,
        });
      }

      for (let i = start; i <= end; i++) {
        indices.push(i);
      }
    } else {
      const index = parseInt(part, 10);
      if (isNaN(index)) {
        throw new HotSweepError({
          code: ErrorCodes.ADDRESS_RANGE_INVALID,
          message: `Invalid index: ${part}`,
        });
      }
      indices.push(index);
    }
  }

  // Remove duplicates and sort
  return [...new Set(indices)].sort((a, b) => a - b);
}

// ============================================================================
// Resolve AddressSpec to Indices
// ============================================================================

/**
 * Resolve an AddressSpec to an array of indices
 */
export function resolveToIndices(spec: AddressSpec): number[] {
  switch (spec.type) {
    case "index":
      return [spec.value];
    case "indices":
      return [...new Set(spec.value)].sort((a: number, b: number) => a - b);
    case "range":
      return parseRange(spec.value);
    case "address":
    case "label":
      throw new HotSweepError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Cannot resolve ${spec.type} to indices`,
      });
  }
}

// ============================================================================
// Resolve AddressSpec to Address
// ============================================================================

/**
 * Resolve an AddressSpec to an address
 */
export function resolveToAddress(
  spec: AddressSpec,
  wallets?: Record<string, WalletConfig>,
  addressResolver?: (index: number) => Address
): Address {
  switch (spec.type) {
    case "address":
      return spec.value;

    case "label":
      if (!wallets || !(spec.value in wallets)) {
        throw new HotSweepError({
          code: ErrorCodes.ADDRESS_LABEL_NOT_FOUND,
          message: `Wallet label not found: ${spec.value}`,
        });
      }
      return wallets[spec.value]!.address;

    case "index":
      if (!addressResolver) {
        throw new HotSweepError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Address resolver required for index resolution",
        });
      }
      return addressResolver(spec.value);

    case "indices":
    case "range":
      throw new HotSweepError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: `Cannot resolve ${spec.type} to a single address`,
      });
  }
}

// ============================================================================
// Resolve AddressSpec to Addresses
// ============================================================================

/**
 * Resolve an AddressSpec to an array of addresses with their identifiers
 */
export function resolveToAddresses(
  spec: AddressSpec,
  wallets?: Record<string, WalletConfig>,
  addressResolver?: (index: number) => Address
): Array<{ identifier: string; address: Address }> {
  switch (spec.type) {
    case "address":
      return [{ identifier: spec.value, address: spec.value }];

    case "label":
      if (!wallets || !(spec.value in wallets)) {
        throw new HotSweepError({
          code: ErrorCodes.ADDRESS_LABEL_NOT_FOUND,
          message: `Wallet label not found: ${spec.value}`,
        });
      }
      return [
        { identifier: spec.value, address: wallets[spec.value]!.address },
      ];

    case "index":
      if (!addressResolver) {
        throw new HotSweepError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Address resolver required for index resolution",
        });
      }
      return [
        {
          identifier: String(spec.value),
          address: addressResolver(spec.value),
        },
      ];

    case "indices": {
      if (!addressResolver) {
        throw new HotSweepError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Address resolver required for indices resolution",
        });
      }
      return spec.value.map((index) => ({
        identifier: String(index),
        address: addressResolver(index),
      }));
    }

    case "range": {
      if (!addressResolver) {
        throw new HotSweepError({
          code: ErrorCodes.VALIDATION_ERROR,
          message: "Address resolver required for range resolution",
        });
      }
      const indices = parseRange(spec.value);
      return indices.map((index: number) => ({
        identifier: String(index),
        address: addressResolver(index),
      }));
    }
  }
}
