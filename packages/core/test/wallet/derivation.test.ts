/**
 * @fileoverview HD wallet derivation tests
 * @module @hotsweep/core/wallet/derivation
 */
import { describe, it, expect, beforeAll } from "vitest";
import { HDKey } from "@scure/bip32";
import {
  hdKeyFromMnemonic,
  hdKeyFromExtendedKey,
  hdKeyFromSeed,
  buildPath,
  getParentPath,
  parsePath,
  deriveAddress,
  deriveAddresses,
  getExtendedPublicKey,
  getExtendedPrivateKey,
  publicKeyToAddress,
  ETH_COIN_TYPE,
  BTC_COIN_TYPE,
  DEFAULT_ETH_PATH,
} from "../../src/wallet/derivation";
import { mnemonicToSeed } from "../../src/wallet/mnemonic";
import { HotSweepError } from "@hotsweep/types";

describe("wallet/derivation", () => {
  // ============================================================================
  // Test Constants & Fixtures
  // ============================================================================

  const TEST_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  let masterKey: HDKey;
  let seed: Uint8Array;

  beforeAll(() => {
    seed = mnemonicToSeed(TEST_MNEMONIC);
    masterKey = hdKeyFromSeed(seed);
  });

  // ============================================================================
  // HDKey Creation Tests
  // ============================================================================

  describe("HDKey creation", () => {
    describe("hdKeyFromMnemonic", () => {
      it("should create HDKey from valid mnemonic", () => {
        const hdKey = hdKeyFromMnemonic(TEST_MNEMONIC);

        expect(hdKey).toBeInstanceOf(HDKey);
        expect(hdKey.privateKey).toBeDefined();
        expect(hdKey.publicKey).toBeDefined();
        expect(hdKey.depth).toBe(0);
      });

      it("should create different HDKey with passphrase", () => {
        const hdKeyNoPass = hdKeyFromMnemonic(TEST_MNEMONIC);
        const hdKeyWithPass = hdKeyFromMnemonic(TEST_MNEMONIC, "password");

        expect(hdKeyNoPass.privateKey).not.toEqual(hdKeyWithPass.privateKey);
      });

      it("should throw for invalid mnemonic", () => {
        expect(() => hdKeyFromMnemonic("invalid mnemonic")).toThrow(
          HotSweepError
        );
      });
    });

    describe("hdKeyFromExtendedKey", () => {
      it("should create HDKey from xpriv", () => {
        const xpriv = masterKey.privateExtendedKey;
        const hdKey = hdKeyFromExtendedKey(xpriv);

        expect(hdKey).toBeInstanceOf(HDKey);
        expect(hdKey.privateKey).toBeDefined();
      });

      it("should create public-only HDKey from xpub", () => {
        const xpub = masterKey.publicExtendedKey;
        const hdKey = hdKeyFromExtendedKey(xpub);

        expect(hdKey).toBeInstanceOf(HDKey);
        expect(hdKey.privateKey).toBeNull();
        expect(hdKey.publicKey).toBeDefined();
      });

      it("should throw for invalid extended key", () => {
        expect(() => hdKeyFromExtendedKey("invalid")).toThrow(HotSweepError);
        expect(() => hdKeyFromExtendedKey("xpub123invalid")).toThrow(
          HotSweepError
        );
      });
    });

    describe("hdKeyFromSeed", () => {
      it("should create HDKey from seed bytes", () => {
        const hdKey = hdKeyFromSeed(seed);

        expect(hdKey).toBeInstanceOf(HDKey);
        expect(hdKey.depth).toBe(0);
      });

      it("should produce same key as hdKeyFromMnemonic", () => {
        const fromMnemonic = hdKeyFromMnemonic(TEST_MNEMONIC);
        const fromSeed = hdKeyFromSeed(seed);

        expect(fromMnemonic.privateKey).toEqual(fromSeed.privateKey);
      });
    });
  });

  // ============================================================================
  // Path Construction Tests
  // ============================================================================

  describe("path construction", () => {
    describe("buildPath", () => {
      it("should build standard BIP44 Ethereum path", () => {
        const path = buildPath({ addressIndex: 0 });
        expect(path).toBe("m/44'/60'/0'/0/0");
      });

      it("should build path with custom parameters", () => {
        const path = buildPath({
          purpose: 44,
          coinType: 0, // Bitcoin
          account: 1,
          change: 1,
          addressIndex: 5,
        });
        expect(path).toBe("m/44'/0'/1'/1/5");
      });

      it("should default to Ethereum coin type", () => {
        const path = buildPath({ addressIndex: 10 });
        expect(path).toContain("/60'/");
      });
    });

    describe("getParentPath", () => {
      it("should return Ethereum parent path by default", () => {
        expect(getParentPath()).toBe("m/44'/60'/0'/0");
      });

      it("should return Bitcoin parent path", () => {
        expect(getParentPath(BTC_COIN_TYPE)).toBe("m/44'/0'/0'/0");
      });
    });

    describe("parsePath", () => {
      it("should parse valid BIP44 path", () => {
        const parsed = parsePath("m/44'/60'/0'/0/42");

        expect(parsed).toEqual({
          purpose: 44,
          coinType: 60,
          account: 0,
          change: 0,
          addressIndex: 42,
        });
      });

      it("should throw for invalid path format", () => {
        expect(() => parsePath("invalid")).toThrow(HotSweepError);
        expect(() => parsePath("m/44/60/0/0/0")).toThrow(HotSweepError); // missing hardened markers
        expect(() => parsePath("44'/60'/0'/0/0")).toThrow(HotSweepError); // missing 'm/'
      });
    });
  });

  // ============================================================================
  // Address Derivation Tests
  // ============================================================================

  describe("address derivation", () => {
    describe("publicKeyToAddress", () => {
      it("should convert public key to valid Ethereum address", () => {
        const derived = masterKey.derive(DEFAULT_ETH_PATH + "/0");
        const address = publicKeyToAddress(derived.publicKey!);

        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    describe("deriveAddress", () => {
      it("should derive valid address at index 0", () => {
        const result = deriveAddress(masterKey, 0);

        expect(result.index).toBe(0);
        expect(result.path).toMatch(/m\/44'\/60'\/0'\/0\/0/);
        expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(result.publicKey).toMatch(/^0x[a-fA-F0-9]+$/);
      });

      it("should derive different addresses for different indices", () => {
        const result0 = deriveAddress(masterKey, 0);
        const result1 = deriveAddress(masterKey, 1);
        const result2 = deriveAddress(masterKey, 2);

        expect(result0.address).not.toBe(result1.address);
        expect(result1.address).not.toBe(result2.address);
        expect(result0.address).not.toBe(result2.address);
      });

      it("should derive different coin type addresses", () => {
        const ethAddress = deriveAddress(masterKey, 0, ETH_COIN_TYPE);
        const btcAddress = deriveAddress(masterKey, 0, BTC_COIN_TYPE);

        expect(ethAddress.address).not.toBe(btcAddress.address);
        expect(ethAddress.path).toContain("/60'/");
        expect(btcAddress.path).toContain("/0'/");
      });

      it("should work with pre-derived parent key", () => {
        const parentKey = masterKey.derive(getParentPath());
        const result = deriveAddress(parentKey, 0);

        expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    describe("deriveAddresses", () => {
      it("should derive multiple addresses in batch", () => {
        const results = deriveAddresses(masterKey, 0, 3);

        expect(results).toHaveLength(3);
        expect(results[0]!.index).toBe(0);
        expect(results[1]!.index).toBe(1);
        expect(results[2]!.index).toBe(2);
      });

      it("should handle large batch efficiently", () => {
        const startTime = Date.now();
        const results = deriveAddresses(masterKey, 0, 100);
        const elapsed = Date.now() - startTime;

        expect(results).toHaveLength(100);
        expect(elapsed).toBeLessThan(5000); // Should complete in under 5 seconds
      });

      it("should derive from custom start index", () => {
        const results = deriveAddresses(masterKey, 10, 3);

        expect(results[0]!.index).toBe(10);
        expect(results[1]!.index).toBe(11);
        expect(results[2]!.index).toBe(12);
      });

      it("should produce unique addresses", () => {
        const results = deriveAddresses(masterKey, 0, 50);
        const addresses = results.map((r) => r.address);
        const uniqueAddresses = new Set(addresses);

        expect(uniqueAddresses.size).toBe(50);
      });
    });
  });

  // ============================================================================
  // Extended Key Tests
  // ============================================================================

  describe("extended keys", () => {
    describe("getExtendedPublicKey", () => {
      it("should return valid xpub", () => {
        const xpub = getExtendedPublicKey(masterKey);

        expect(xpub).toMatch(/^xpub[a-zA-Z0-9]+$/);
      });

      it("should allow address derivation from xpub", () => {
        const xpub = getExtendedPublicKey(masterKey);
        const hdKeyFromXpub = hdKeyFromExtendedKey(xpub);

        // Xpub is at m/44'/60'/0'/0, so we derive just the index
        const derived = hdKeyFromXpub.deriveChild(0);
        const address = publicKeyToAddress(derived.publicKey!);

        expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      });
    });

    describe("getExtendedPrivateKey", () => {
      it("should return valid xpriv", () => {
        const xpriv = getExtendedPrivateKey(masterKey);

        expect(xpriv).toMatch(/^xprv[a-zA-Z0-9]+$/);
      });

      it("should throw for public-only key", () => {
        const xpub = masterKey.publicExtendedKey;
        const publicOnlyKey = hdKeyFromExtendedKey(xpub);

        // Throws because public-only key can't derive private key
        expect(() => getExtendedPrivateKey(publicOnlyKey)).toThrow();
      });
    });
  });

  // ============================================================================
  // Constants Tests
  // ============================================================================

  describe("constants", () => {
    it("should have correct Ethereum coin type", () => {
      expect(ETH_COIN_TYPE).toBe(60);
    });

    it("should have correct Bitcoin coin type", () => {
      expect(BTC_COIN_TYPE).toBe(0);
    });

    it("should have correct default Ethereum path", () => {
      expect(DEFAULT_ETH_PATH).toBe("m/44'/60'/0'/0");
    });
  });

  // ============================================================================
  // Derivation Flow Chart
  // ============================================================================

  describe("derivation flow", () => {
    /**
     * HD Wallet Derivation Flow:
     *
     *     Mnemonic (BIP39)
     *          │
     *          ▼
     *     ┌─────────┐
     *     │  Seed   │  (512 bits)
     *     └────┬────┘
     *          │
     *          ▼
     *     ┌─────────┐
     *     │ Master  │  (depth = 0)
     *     │   Key   │
     *     └────┬────┘
     *          │  m/44'
     *          ▼
     *     ┌─────────┐
     *     │ Purpose │  (BIP44 = 44')
     *     └────┬────┘
     *          │  m/44'/60'
     *          ▼
     *     ┌─────────┐
     *     │ Coin    │  (ETH = 60')
     *     │ Type    │
     *     └────┬────┘
     *          │  m/44'/60'/0'
     *          ▼
     *     ┌─────────┐
     *     │ Account │  (default = 0')
     *     └────┬────┘
     *          │  m/44'/60'/0'/0
     *          ▼
     *     ┌─────────┐
     *     │ Change  │  (external = 0)
     *     └────┬────┘
     *          │  m/44'/60'/0'/0/n
     *          ▼
     *     ┌─────────────────────────────────────┐
     *     │           Address Pool              │
     *     │  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐   │
     *     │  │  0  │ │  1  │ │  2  │ │ ... │   │
     *     │  │     │ │     │ │     │ │     │   │
     *     │  └─────┘ └─────┘ └─────┘ └─────┘   │
     *     └─────────────────────────────────────┘
     */
    it("should document the derivation flow", () => {
      expect(true).toBe(true);
    });
  });
});
