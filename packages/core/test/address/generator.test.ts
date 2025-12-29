/**
 * @fileoverview Address generation tests
 * @module @hotsweep/core/address/generator
 */
import { describe, it, expect } from "vitest";
import {
  generateAddresses,
  generateAddress,
  generateAddressRange,
  type AddressGeneratorContext,
} from "../../src/address/generator";
import { HotSweepError } from "@hotsweep/types";

describe("address/generator", () => {
  // ============================================================================
  // Test Constants
  // ============================================================================

  const TEST_MNEMONIC =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";

  // xpub derived from TEST_MNEMONIC at m/44'/60'/0'/0
  const TEST_XPUB =
    "xpub6FHa3pjLCk84BayeJxFW2SP4XRrFd1JYnxeLeU8EqN3vDfZmbqBqaGJAyiLjTAwm6ZLRQUMv1ZACTj37sR62cfN7fe5JnJ7dh8zL4fiyLHV";

  const context: AddressGeneratorContext = {
    mnemonic: TEST_MNEMONIC,
  };

  const xpubContext: AddressGeneratorContext = {
    xpub: TEST_XPUB,
  };

  // ============================================================================
  // generateAddresses Tests
  // ============================================================================

  describe("generateAddresses", () => {
    describe("single address mode", () => {
      it("should generate single address by index", () => {
        const result = generateAddresses(context, { index: 0 });

        expect(result.addresses).toHaveLength(1);
        expect(result.addresses[0]!.index).toBe(0);
        expect(result.addresses[0]!.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
        expect(result.coinType).toBe(60);
      });

      it("should generate different addresses for different indices", () => {
        const result0 = generateAddresses(context, { index: 0 });
        const result1 = generateAddresses(context, { index: 1 });

        expect(result0.addresses[0]!.address).not.toBe(
          result1.addresses[0]!.address
        );
      });

      it("should include correct derivation path", () => {
        const result = generateAddresses(context, { index: 42 });

        expect(result.addresses[0]!.path).toBe("m/44'/60'/0'/0/42");
      });
    });

    describe("batch mode with count", () => {
      it("should generate specified number of addresses", () => {
        const result = generateAddresses(context, { count: 10 });

        expect(result.addresses).toHaveLength(10);
      });

      it("should start from index 0 by default", () => {
        const result = generateAddresses(context, { count: 3 });

        expect(result.addresses[0]!.index).toBe(0);
        expect(result.addresses[1]!.index).toBe(1);
        expect(result.addresses[2]!.index).toBe(2);
      });

      it("should start from custom startIndex", () => {
        const result = generateAddresses(context, {
          startIndex: 100,
          count: 3,
        });

        expect(result.addresses[0]!.index).toBe(100);
        expect(result.addresses[1]!.index).toBe(101);
        expect(result.addresses[2]!.index).toBe(102);
      });
    });

    describe("batch mode with endIndex", () => {
      it("should generate addresses up to endIndex (inclusive)", () => {
        const result = generateAddresses(context, {
          startIndex: 5,
          endIndex: 10,
        });

        expect(result.addresses).toHaveLength(6); // 5, 6, 7, 8, 9, 10
        expect(result.addresses[0]!.index).toBe(5);
        expect(result.addresses[5]!.index).toBe(10);
      });
    });

    describe("custom coin type", () => {
      it("should use custom coin type", () => {
        const result = generateAddresses(context, { index: 0, coinType: 0 });

        expect(result.coinType).toBe(0);
        expect(result.addresses[0]!.path).toContain("/0'/");
      });
    });

    describe("error handling", () => {
      it("should throw when no key source provided", () => {
        expect(() => generateAddresses({}, { index: 0 })).toThrow(
          HotSweepError
        );
      });

      it("should throw when neither index nor count/endIndex provided", () => {
        expect(() =>
          generateAddresses(context, {} as unknown as AddressOptions)
        ).toThrow(HotSweepError);
      });

      it("should throw for zero count", () => {
        expect(() => generateAddresses(context, { count: 0 })).toThrow(
          HotSweepError
        );
      });

      it("should throw for negative count", () => {
        expect(() => generateAddresses(context, { count: -1 })).toThrow(
          HotSweepError
        );
      });
    });
  });

  // ============================================================================
  // generateAddress Tests
  // ============================================================================

  describe("generateAddress", () => {
    it("should generate single address", () => {
      const result = generateAddress(context, 0);

      expect(result.index).toBe(0);
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.path).toBe("m/44'/60'/0'/0/0");
    });

    it("should be deterministic", () => {
      const result1 = generateAddress(context, 42);
      const result2 = generateAddress(context, 42);

      expect(result1.address).toBe(result2.address);
    });

    it("should work with xpub context", () => {
      const result = generateAddress(xpubContext, 0);

      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });

  // ============================================================================
  // generateAddressRange Tests
  // ============================================================================

  describe("generateAddressRange", () => {
    it("should generate address range", () => {
      const results = generateAddressRange(context, 0, 5);

      expect(results).toHaveLength(5);
      results.forEach((result, i) => {
        expect(result.index).toBe(i);
      });
    });

    it("should handle large ranges efficiently", () => {
      const startTime = Date.now();
      const results = generateAddressRange(context, 0, 1000);
      const elapsed = Date.now() - startTime;

      expect(results).toHaveLength(1000);
      expect(elapsed).toBeLessThan(10000); // Should complete in under 10 seconds
    });
  });

  // ============================================================================
  // Context Priority Tests
  // ============================================================================

  describe("context priority", () => {
    it("should prefer xpub over mnemonic", () => {
      const combinedContext: AddressGeneratorContext = {
        xpub: TEST_XPUB,
        mnemonic: "different mnemonic that would produce different addresses",
      };

      // This should use xpub, not mnemonic
      const result = generateAddress(combinedContext, 0);
      const xpubResult = generateAddress(xpubContext, 0);

      expect(result.address).toBe(xpubResult.address);
    });

    it("should use xpriv if provided", () => {
      const xprivContext: AddressGeneratorContext = {
        xpriv:
          "xprv9uHRZZhk6KAJC1avXpDAp4MDc3sQKNxDiPvvkX8Br5ngLNv1TxvUxt4cV1rGL5hj6KCesnDYUhd7oWgT11eZG7XnxHrnYeSvkzY7d2bhkJ7",
      };

      const result = generateAddress(xprivContext, 0);
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });
  });
});
