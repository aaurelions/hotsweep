/**
 * HD wallet derivation utilities
 */
import { HDKey } from "@scure/bip32";
import type { Address, Hex } from "viem";
import { publicKeyToAddress as viemPublicKeyToAddress } from "viem/utils";
import {
  HotSweepError,
  ErrorCodes,
  type DerivedAddress,
  type HDPath,
} from "@hotsweep/types";
import { mnemonicToSeed } from "./mnemonic";

// ============================================================================
// Constants
// ============================================================================

/** Default BIP44 derivation path for Ethereum */
export const DEFAULT_ETH_PATH = "m/44'/60'/0'/0";

/** Ethereum coin type (BIP44) */
export const ETH_COIN_TYPE = 60;

/** Bitcoin coin type (BIP44) */
export const BTC_COIN_TYPE = 0;

// ============================================================================
// HD Key Creation
// ============================================================================

/**
 * Create an HDKey from a mnemonic phrase
 */
export function hdKeyFromMnemonic(
  mnemonic: string,
  passphrase?: string
): HDKey {
  const seed = mnemonicToSeed(mnemonic, passphrase);
  return HDKey.fromMasterSeed(seed);
}

/**
 * Create an HDKey from an extended key (xpub or xpriv)
 */
export function hdKeyFromExtendedKey(extendedKey: string): HDKey {
  try {
    return HDKey.fromExtendedKey(extendedKey);
  } catch (error) {
    const isPrivate = extendedKey.startsWith("xprv");
    throw new HotSweepError({
      code: isPrivate
        ? ErrorCodes.WALLET_XPRIV_INVALID
        : ErrorCodes.WALLET_XPUB_INVALID,
      message: `Invalid extended ${isPrivate ? "private" : "public"} key`,
      cause: error instanceof Error ? error : undefined,
    });
  }
}

/**
 * Create an HDKey from seed bytes
 */
export function hdKeyFromSeed(seed: Uint8Array): HDKey {
  return HDKey.fromMasterSeed(seed);
}

// ============================================================================
// Path Construction
// ============================================================================

/**
 * Build a BIP44 derivation path
 */
export function buildPath(
  options: Partial<HDPath> & { addressIndex: number }
): string {
  const {
    purpose = 44,
    coinType = ETH_COIN_TYPE,
    account = 0,
    change = 0,
    addressIndex,
  } = options;

  return `m/${purpose}'/${coinType}'/${account}'/${change}/${addressIndex}`;
}

/**
 * Get the parent path (without address index) for batch derivation
 */
export function getParentPath(coinType: number = ETH_COIN_TYPE): string {
  return `m/44'/${coinType}'/0'/0`;
}

/**
 * Parse a derivation path into components
 */
export function parsePath(path: string): HDPath {
  const match = path.match(/^m\/(\d+)'\/(\d+)'\/(\d+)'\/(\d+)\/(\d+)$/);
  if (!match) {
    throw new HotSweepError({
      code: ErrorCodes.ADDRESS_INVALID,
      message: `Invalid derivation path: ${path}`,
    });
  }

  return {
    purpose: parseInt(match[1]!, 10),
    coinType: parseInt(match[2]!, 10),
    account: parseInt(match[3]!, 10),
    change: parseInt(match[4]!, 10),
    addressIndex: parseInt(match[5]!, 10),
  };
}

// ============================================================================
// Address Derivation
// ============================================================================

import { privateKeyToAccount } from "viem/accounts";

/**
 * Convert a public key to an Ethereum address
 */
export function publicKeyToAddress(publicKey: Uint8Array): Address {
  const hex = `0x${Buffer.from(publicKey).toString("hex")}` as Hex;
  return viemPublicKeyToAddress(hex);
}

/**
 * Derive a single address from an HDKey at a specific index
 */
export function deriveAddress(
  hdKey: HDKey,
  index: number,
  coinType: number = ETH_COIN_TYPE
): DerivedAddress {
  // If hdKey is already at the parent path, just derive by index
  // Otherwise, derive the full path
  const parentPath = getParentPath(coinType);
  const fullPath = `${parentPath}/${index}`;

  let derivedKey: HDKey;

  // Try to derive from the current key
  try {
    // If this is a master key, derive the full path
    if (hdKey.depth === 0) {
      derivedKey = hdKey.derive(fullPath);
    } else {
      // Otherwise, derive just the index (assuming we're at the parent path)
      derivedKey = hdKey.deriveChild(index);
    }
  } catch (error) {
    throw new HotSweepError({
      code: ErrorCodes.ADDRESS_INDEX_OUT_OF_RANGE,
      message: `Failed to derive address at index ${index}`,
      cause: error instanceof Error ? error : undefined,
    });
  }

  if (!derivedKey.publicKey) {
    throw new HotSweepError({
      code: ErrorCodes.INTERNAL_ERROR,
      message: "Failed to derive public key",
    });
  }

  // Use privateKeyToAccount for address if private key is available to ensure Viem compatibility
  let address: Address;
  if (derivedKey.privateKey) {
    const privHex =
      `0x${Buffer.from(derivedKey.privateKey).toString("hex")}` as Hex;
    address = privateKeyToAccount(privHex).address;
  } else {
    address = publicKeyToAddress(derivedKey.publicKey);
  }

  const path =
    hdKey.depth === 0 ? fullPath : buildPath({ coinType, addressIndex: index });

  return {
    index,
    path,
    address,
    publicKey: `0x${Buffer.from(derivedKey.publicKey).toString("hex")}` as Hex,
  };
}

/**
 * Derive multiple addresses from an HDKey
 */
export function deriveAddresses(
  hdKey: HDKey,
  startIndex: number,
  count: number,
  coinType: number = ETH_COIN_TYPE
): DerivedAddress[] {
  const addresses: DerivedAddress[] = [];

  // For efficiency, derive to the parent path first
  let parentKey: HDKey;
  if (hdKey.depth === 0) {
    const parentPath = getParentPath(coinType);
    parentKey = hdKey.derive(parentPath);
  } else {
    parentKey = hdKey;
  }

  for (let i = 0; i < count; i++) {
    const index = startIndex + i;
    const derived = parentKey.deriveChild(index);

    if (!derived.publicKey) {
      throw new HotSweepError({
        code: ErrorCodes.INTERNAL_ERROR,
        message: `Failed to derive public key at index ${index}`,
      });
    }

    let address: Address;
    if (derived.privateKey) {
      const privHex =
        `0x${Buffer.from(derived.privateKey).toString("hex")}` as Hex;
      address = privateKeyToAccount(privHex).address;
    } else {
      address = publicKeyToAddress(derived.publicKey);
    }

    addresses.push({
      index,
      path: buildPath({ coinType, addressIndex: index }),
      address,
      publicKey: `0x${Buffer.from(derived.publicKey).toString("hex")}` as Hex,
    });
  }

  return addresses;
}

/**
 * Get extended public key (xpub) for a specific coin type
 */
export function getExtendedPublicKey(
  hdKey: HDKey,
  coinType: number = ETH_COIN_TYPE
): string {
  const parentPath = getParentPath(coinType);
  const parentKey = hdKey.depth === 0 ? hdKey.derive(parentPath) : hdKey;

  if (!parentKey.publicExtendedKey) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_XPUB_INVALID,
      message: "Cannot generate extended public key",
    });
  }

  return parentKey.publicExtendedKey;
}

/**
 * Get extended private key (xpriv) for a specific coin type
 */
export function getExtendedPrivateKey(
  hdKey: HDKey,
  coinType: number = ETH_COIN_TYPE
): string {
  const parentPath = getParentPath(coinType);
  const parentKey = hdKey.depth === 0 ? hdKey.derive(parentPath) : hdKey;

  if (!parentKey.privateExtendedKey) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_XPRIV_INVALID,
      message: "Cannot generate extended private key - key may be public only",
    });
  }

  return parentKey.privateExtendedKey;
}
