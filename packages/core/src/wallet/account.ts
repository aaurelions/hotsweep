/**
 * Account management for signing operations
 */
import { HDKey } from "@scure/bip32";
import type { Hex, LocalAccount, PrivateKeyAccount } from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";
import { hdKeyFromMnemonic, getParentPath } from "./derivation";

// ============================================================================
// Account Creation
// ============================================================================

/**
 * Create a viem account from a private key
 */
export function accountFromPrivateKey(privateKey: Hex): PrivateKeyAccount {
  return privateKeyToAccount(privateKey);
}

/**
 * Create a viem account from an HDKey at a specific index
 */
export function accountFromHDKey(
  hdKey: HDKey,
  index: number,
  coinType: number = 60
): LocalAccount {
  // Derive to the specific index
  let key: HDKey;
  if (hdKey.depth === 0) {
    const path = `${getParentPath(coinType)}/${index}`;
    key = hdKey.derive(path);
  } else {
    key = hdKey.deriveChild(index);
  }

  if (!key.privateKey) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_KEY_NOT_FOUND,
      message: "Cannot extract private key from HDKey",
    });
  }

  const privateKey = `0x${Buffer.from(key.privateKey).toString("hex")}` as Hex;
  return privateKeyToAccount(privateKey);
}

/**
 * Create a viem account from a mnemonic at a specific index
 */
export function accountFromMnemonic(
  mnemonic: string,
  index: number = 0,
  passphrase?: string
): LocalAccount {
  const hdKey = hdKeyFromMnemonic(mnemonic, passphrase);
  return accountFromHDKey(hdKey, index);
}

/**
 * Get multiple accounts from a mnemonic for batch signing
 */
export function accountsFromMnemonic(
  mnemonic: string,
  startIndex: number,
  count: number,
  coinType: number = 60,
  passphrase?: string
): LocalAccount[] {
  const hdKey = hdKeyFromMnemonic(mnemonic, passphrase);
  const parentPath = getParentPath(coinType);
  const parentKey = hdKey.derive(parentPath);

  const accounts: LocalAccount[] = [];
  for (let i = 0; i < count; i++) {
    const derived = parentKey.deriveChild(startIndex + i);
    if (!derived.privateKey) {
      throw new HotSweepError({
        code: ErrorCodes.WALLET_KEY_NOT_FOUND,
        message: `Cannot extract private key at index ${startIndex + i}`,
      });
    }
    const privateKey =
      `0x${Buffer.from(derived.privateKey).toString("hex")}` as Hex;
    accounts.push(privateKeyToAccount(privateKey));
  }

  return accounts;
}

/**
 * Get the private key for a specific index from an HDKey
 */
export function getPrivateKey(
  hdKey: HDKey,
  index: number,
  coinType: number = 60
): Hex {
  let key: HDKey;
  if (hdKey.depth === 0) {
    const path = `${getParentPath(coinType)}/${index}`;
    key = hdKey.derive(path);
  } else {
    key = hdKey.deriveChild(index);
  }

  if (!key.privateKey) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_KEY_NOT_FOUND,
      message: "Cannot extract private key - key may be public only",
    });
  }

  return `0x${Buffer.from(key.privateKey).toString("hex")}` as Hex;
}

/**
 * Get multiple private keys for batch operations
 */
export function getPrivateKeys(
  hdKey: HDKey,
  indices: number[],
  coinType: number = 60
): Map<number, Hex> {
  const privateKeys = new Map<number, Hex>();

  const parentPath = getParentPath(coinType);
  const parentKey = hdKey.depth === 0 ? hdKey.derive(parentPath) : hdKey;

  for (const index of indices) {
    const derived = parentKey.deriveChild(index);
    if (!derived.privateKey) {
      throw new HotSweepError({
        code: ErrorCodes.WALLET_KEY_NOT_FOUND,
        message: `Cannot extract private key at index ${index}`,
      });
    }
    privateKeys.set(
      index,
      `0x${Buffer.from(derived.privateKey).toString("hex")}` as Hex
    );
  }

  return privateKeys;
}
