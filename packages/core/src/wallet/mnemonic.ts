/**
 * Mnemonic generation and validation utilities
 */
import {
  generateMnemonic as _generateMnemonic,
  validateMnemonic as _validateMnemonic,
  mnemonicToSeedSync,
  mnemonicToEntropy as _mnemonicToEntropy,
  entropyToMnemonic as _entropyToMnemonic,
} from "@scure/bip39";
// Wordlist import
import { wordlist } from "@scure/bip39/wordlists/english.js";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";

/**
 * Generate a new BIP39 mnemonic phrase
 * @param strength - Entropy strength in bits (128 = 12 words, 256 = 24 words)
 */
export function generateMnemonic(strength: 128 | 256 = 256): string {
  return _generateMnemonic(wordlist, strength);
}

/**
 * Validate a BIP39 mnemonic phrase
 */
export function validateMnemonic(mnemonic: string): boolean {
  return _validateMnemonic(mnemonic, wordlist);
}

/**
 * Convert mnemonic to seed bytes
 * @param mnemonic - BIP39 mnemonic phrase
 * @param passphrase - Optional BIP39 passphrase
 */
export function mnemonicToSeed(
  mnemonic: string,
  passphrase?: string
): Uint8Array {
  if (!validateMnemonic(mnemonic)) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_MNEMONIC_INVALID,
      message: "Invalid mnemonic phrase",
    });
  }
  return mnemonicToSeedSync(mnemonic, passphrase);
}

/**
 * Convert mnemonic to entropy bytes
 */
export function mnemonicToEntropy(mnemonic: string): Uint8Array {
  if (!validateMnemonic(mnemonic)) {
    throw new HotSweepError({
      code: ErrorCodes.WALLET_MNEMONIC_INVALID,
      message: "Invalid mnemonic phrase",
    });
  }
  return _mnemonicToEntropy(mnemonic, wordlist);
}

/**
 * Convert entropy to mnemonic
 */
export function entropyToMnemonic(entropy: Uint8Array): string {
  return _entropyToMnemonic(entropy, wordlist);
}
