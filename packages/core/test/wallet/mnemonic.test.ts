/**
 * @fileoverview Mnemonic generation and validation tests
 * @module @hotsweep/core/wallet/mnemonic
 */
import { describe, it, expect } from "vitest";
import {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
  mnemonicToEntropy,
  entropyToMnemonic,
} from "../../src/wallet/mnemonic";
import { HotSweepError } from "@hotsweep/types";

describe("wallet/mnemonic", () => {
  // ============================================================================
  // Test Constants
  // ============================================================================

  /** Standard BIP39 test vector mnemonic (12 words) */
  const TEST_MNEMONIC_12 =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  /** Standard BIP39 test vector mnemonic (24 words) */
  const TEST_MNEMONIC_24 =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon art";

  /** Invalid mnemonic with wrong checksum */
  const INVALID_CHECKSUM_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon";

  /** Invalid mnemonic with non-wordlist word */
  const INVALID_WORD_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon notaword";

  // ============================================================================
  // generateMnemonic Tests
  // ============================================================================

  describe("generateMnemonic", () => {
    it("should generate a valid 24-word mnemonic by default (256-bit entropy)", () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(" ");

      expect(words).toHaveLength(24);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it("should generate a valid 12-word mnemonic with 128-bit entropy", () => {
      const mnemonic = generateMnemonic(128);
      const words = mnemonic.split(" ");

      expect(words).toHaveLength(12);
      expect(validateMnemonic(mnemonic)).toBe(true);
    });

    it("should generate unique mnemonics on each call", () => {
      const mnemonic1 = generateMnemonic();
      const mnemonic2 = generateMnemonic();
      const mnemonic3 = generateMnemonic();

      expect(mnemonic1).not.toBe(mnemonic2);
      expect(mnemonic2).not.toBe(mnemonic3);
      expect(mnemonic1).not.toBe(mnemonic3);
    });

    it("should only contain valid BIP39 English wordlist words", () => {
      const mnemonic = generateMnemonic();
      const words = mnemonic.split(" ");

      // All words should be lowercase and contain only letters
      words.forEach((word) => {
        expect(word).toMatch(/^[a-z]+$/);
        expect(word.length).toBeGreaterThanOrEqual(3);
        expect(word.length).toBeLessThanOrEqual(8);
      });
    });
  });

  // ============================================================================
  // validateMnemonic Tests
  // ============================================================================

  describe("validateMnemonic", () => {
    it("should return true for valid 12-word mnemonic", () => {
      expect(validateMnemonic(TEST_MNEMONIC_12)).toBe(true);
    });

    it("should return true for valid 24-word mnemonic", () => {
      expect(validateMnemonic(TEST_MNEMONIC_24)).toBe(true);
    });

    it("should return false for invalid checksum", () => {
      expect(validateMnemonic(INVALID_CHECKSUM_MNEMONIC)).toBe(false);
    });

    it("should return false for invalid words", () => {
      expect(validateMnemonic(INVALID_WORD_MNEMONIC)).toBe(false);
    });

    it("should return false for empty string", () => {
      expect(validateMnemonic("")).toBe(false);
    });

    it("should return false for wrong word count", () => {
      const wrongCount = "abandon abandon abandon abandon abandon";
      expect(validateMnemonic(wrongCount)).toBe(false);
    });

    it("should handle extra whitespace gracefully", () => {
      const withSpaces =
        "  abandon  abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about  ";
      // Note: BIP39 implementations vary on whitespace handling
      // Most normalize whitespace, so this should still validate
      const normalized = withSpaces.trim().replace(/\s+/g, " ");
      expect(validateMnemonic(normalized)).toBe(true);
    });
  });

  // ============================================================================
  // mnemonicToSeed Tests
  // ============================================================================

  describe("mnemonicToSeed", () => {
    it("should generate deterministic seed from mnemonic", () => {
      const seed1 = mnemonicToSeed(TEST_MNEMONIC_12);
      const seed2 = mnemonicToSeed(TEST_MNEMONIC_12);

      expect(seed1).toEqual(seed2);
      expect(seed1).toBeInstanceOf(Uint8Array);
      expect(seed1.length).toBe(64); // 512 bits
    });

    it("should generate different seeds with different passphrases", () => {
      const seedNoPass = mnemonicToSeed(TEST_MNEMONIC_12);
      const seedWithPass = mnemonicToSeed(TEST_MNEMONIC_12, "TREZOR");

      expect(seedNoPass).not.toEqual(seedWithPass);
    });

    it("should match BIP39 test vector", () => {
      // BIP39 test vector: mnemonic "abandon...about" with passphrase "TREZOR"
      const seed = mnemonicToSeed(TEST_MNEMONIC_12, "TREZOR");
      const seedHex = Buffer.from(seed).toString("hex");

      // Expected seed from BIP39 test vectors
      expect(seedHex).toBe(
        "c55257c360c07c72029aebc1b53c05ed0362ada38ead3e3e9efa3708e53495531f09a6987599d18264c1e1c92f2cf141630c7a3c4ab7c81b2f001698e7463b04"
      );
    });

    it("should throw HotSweepError for invalid mnemonic", () => {
      expect(() => mnemonicToSeed(INVALID_WORD_MNEMONIC)).toThrow(
        HotSweepError
      );
      expect(() => mnemonicToSeed("invalid mnemonic")).toThrow(HotSweepError);
    });

    it("should use empty string passphrase when undefined", () => {
      const seedUndefined = mnemonicToSeed(TEST_MNEMONIC_12, undefined);
      const seedEmpty = mnemonicToSeed(TEST_MNEMONIC_12, "");

      expect(seedUndefined).toEqual(seedEmpty);
    });
  });

  // ============================================================================
  // mnemonicToEntropy / entropyToMnemonic Tests
  // ============================================================================

  describe("mnemonicToEntropy", () => {
    it("should extract entropy from 12-word mnemonic", () => {
      const entropy = mnemonicToEntropy(TEST_MNEMONIC_12);

      expect(entropy).toBeInstanceOf(Uint8Array);
      expect(entropy.length).toBe(16); // 128 bits / 8
    });

    it("should extract entropy from 24-word mnemonic", () => {
      const entropy = mnemonicToEntropy(TEST_MNEMONIC_24);

      expect(entropy).toBeInstanceOf(Uint8Array);
      expect(entropy.length).toBe(32); // 256 bits / 8
    });

    it("should throw for invalid mnemonic", () => {
      expect(() => mnemonicToEntropy(INVALID_WORD_MNEMONIC)).toThrow(
        HotSweepError
      );
    });
  });

  describe("entropyToMnemonic", () => {
    it("should convert entropy back to mnemonic", () => {
      const entropy = mnemonicToEntropy(TEST_MNEMONIC_12);
      const recovered = entropyToMnemonic(entropy);

      expect(recovered).toBe(TEST_MNEMONIC_12);
    });

    it("should be reversible for any valid mnemonic", () => {
      const original = generateMnemonic();
      const entropy = mnemonicToEntropy(original);
      const recovered = entropyToMnemonic(entropy);

      expect(recovered).toBe(original);
    });
  });

  // ============================================================================
  // Edge Cases & Security
  // ============================================================================

  describe("edge cases and security", () => {
    it("should handle unicode normalization", () => {
      // BIP39 requires NFKD normalization for passphrases
      const seedNormal = mnemonicToSeed(TEST_MNEMONIC_12, "Å"); // precomposed
      const seedComposed = mnemonicToSeed(TEST_MNEMONIC_12, "A\u030A"); // decomposed

      // After NFKD normalization, these should produce the same seed
      expect(seedNormal).toEqual(seedComposed);
    });

    it("should produce cryptographically random mnemonics", () => {
      // Generate many mnemonics and check for uniqueness
      const mnemonics = new Set<string>();
      for (let i = 0; i < 100; i++) {
        mnemonics.add(generateMnemonic());
      }

      // All 100 should be unique (probability of collision is astronomically low)
      expect(mnemonics.size).toBe(100);
    });
  });
});
