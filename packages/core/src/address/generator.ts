/**
 * Address generation for HotSweep
 */
import type {
  AddressOptions,
  AddressSingleOptions,
  AddressBatchOptions,
  AddressResult,
  GeneratedAddress,
  DerivedAddress,
} from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";
import {
  hdKeyFromExtendedKey,
  hdKeyFromMnemonic,
  deriveAddress,
  deriveAddresses,
  ETH_COIN_TYPE,
} from "../wallet";

// ============================================================================
// Type Guards
// ============================================================================

function isSingleOptions(
  options: AddressOptions
): options is AddressSingleOptions {
  return "index" in options && typeof options.index === "number";
}

function isBatchOptions(
  options: AddressOptions
): options is AddressBatchOptions {
  return "count" in options || "endIndex" in options || "startIndex" in options;
}

// ============================================================================
// Address Generation Context
// ============================================================================

export interface AddressGeneratorContext {
  /** Extended public key for address generation */
  xpub?: string;
  /** Extended private key (optional, for signing) */
  xpriv?: string;
  /** BIP39 mnemonic (optional) */
  mnemonic?: string;
  /** Optional passphrase for mnemonic */
  passphrase?: string;
}

// ============================================================================
// Address Generator
// ============================================================================

/**
 * Generate addresses from HD wallet keys
 */
export function generateAddresses(
  context: AddressGeneratorContext,
  options: AddressOptions
): AddressResult {
  const coinType = options.coinType ?? ETH_COIN_TYPE;

  // Get the HDKey from context
  const hdKey = getHDKeyFromContext(context);

  let addresses: DerivedAddress[];

  if (isSingleOptions(options)) {
    // Single address generation
    const derived = deriveAddress(hdKey, options.index, coinType);
    addresses = [derived];
  } else if (isBatchOptions(options)) {
    // Batch address generation
    const startIndex = options.startIndex ?? 0;
    let count: number;

    if (options.count !== undefined) {
      count = options.count;
    } else if (options.endIndex !== undefined) {
      count = options.endIndex - startIndex + 1;
    } else {
      throw new HotSweepError({
        code: ErrorCodes.VALIDATION_ERROR,
        message:
          "Must provide either 'count' or 'endIndex' for batch generation",
      });
    }

    if (count <= 0) {
      throw new HotSweepError({
        code: ErrorCodes.VALIDATION_ERROR,
        message: "Count must be greater than 0",
      });
    }

    addresses = deriveAddresses(hdKey, startIndex, count, coinType);
  } else {
    throw new HotSweepError({
      code: ErrorCodes.VALIDATION_ERROR,
      message:
        "Must provide either 'index' for single address or 'count'/'endIndex' for batch",
    });
  }

  return {
    addresses: addresses.map(toGeneratedAddress),
    coinType,
    xpub: context.xpub,
  };
}

/**
 * Generate a single address at a specific index
 */
export function generateAddress(
  context: AddressGeneratorContext,
  index: number,
  coinType: number = ETH_COIN_TYPE
): GeneratedAddress {
  const hdKey = getHDKeyFromContext(context);
  const derived = deriveAddress(hdKey, index, coinType);
  return toGeneratedAddress(derived);
}

/**
 * Generate a range of addresses
 */
export function generateAddressRange(
  context: AddressGeneratorContext,
  startIndex: number,
  count: number,
  coinType: number = ETH_COIN_TYPE
): GeneratedAddress[] {
  const hdKey = getHDKeyFromContext(context);
  const derived = deriveAddresses(hdKey, startIndex, count, coinType);
  return derived.map(toGeneratedAddress);
}

// ============================================================================
// Helper Functions
// ============================================================================

function getHDKeyFromContext(context: AddressGeneratorContext) {
  if (context.xpub) {
    return hdKeyFromExtendedKey(context.xpub);
  }
  if (context.xpriv) {
    return hdKeyFromExtendedKey(context.xpriv);
  }
  if (context.mnemonic) {
    return hdKeyFromMnemonic(context.mnemonic, context.passphrase);
  }

  throw new HotSweepError({
    code: ErrorCodes.WALLET_KEY_NOT_FOUND,
    message: "No key source provided. Provide xpub, xpriv, or mnemonic.",
  });
}

function toGeneratedAddress(derived: DerivedAddress): GeneratedAddress {
  return {
    index: derived.index,
    path: derived.path,
    address: derived.address,
    publicKey: derived.publicKey,
  };
}
