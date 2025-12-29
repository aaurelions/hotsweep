/**
 * @fileoverview Address specification parser tests
 * @module @hotsweep/core/address/parser
 */
import { describe, it, expect } from "vitest";
import type { Address } from "viem";
import {
  parseAddressSpec,
  parseRange,
  resolveToIndices,
  resolveToAddress,
  resolveToAddresses,
} from "../../src/address/parser";
import { HotSweepError } from "@hotsweep/types";
import type { WalletConfig } from "@hotsweep/types";

describe("address/parser", () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  const mockWallets: Record<string, WalletConfig> = {
    "hot-wallet": {
      address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
      chains: ["eip155:1"],
      enabled: true,
    },
    "cold-storage": {
      address: "0x123d35Cc6634C0532925a3b844Bc9e7595f0abc2" as Address,
      chains: ["eip155:1"],
      enabled: true,
    },
  };

  const mockAddressResolver = (index: number): Address => {
    return `0x${index.toString().padStart(40, "0")}` as Address;
  };

  // ============================================================================
  // parseAddressSpec Tests
  // ============================================================================

  describe("parseAddressSpec", () => {
    describe("number input", () => {
      it("should parse number as index", () => {
        const result = parseAddressSpec(42);

        expect(result.type).toBe("index");
        expect((result as any).value).toBe(42);
      });
    });

    describe("string inputs", () => {
      it("should parse numeric string as index", () => {
        const result = parseAddressSpec("42");

        expect(result.type).toBe("index");
        expect((result as any).value).toBe(42);
      });

      it("should parse Ethereum address", () => {
        // Use a valid checksummed address
        const address = "0x742d35Cc6634C0532925a3b844Bc454e4438f44e";
        const result = parseAddressSpec(address);

        expect(result.type).toBe("address");
        expect((result as any).value).toBe(address);
      });

      it("should parse comma-separated indices", () => {
        const result = parseAddressSpec("1,5,10,20");

        expect(result.type).toBe("indices");
        expect((result as any).value).toEqual([1, 5, 10, 20]);
      });

      it("should parse range string", () => {
        const result = parseAddressSpec("0-10");

        expect(result.type).toBe("range");
        expect((result as any).value).toBe("0-10");
      });

      it("should parse complex range string", () => {
        const result = parseAddressSpec("0-10,99,500-505");

        expect(result.type).toBe("range");
        expect((result as any).value).toBe("0-10,99,500-505");
      });

      it("should parse wallet label", () => {
        const result = parseAddressSpec("hot-wallet", mockWallets);

        expect(result.type).toBe("label");
        expect((result as any).value).toBe("hot-wallet");
      });

      it("should treat unknown string as label", () => {
        const result = parseAddressSpec("unknown-label");

        expect(result.type).toBe("label");
        expect((result as any).value).toBe("unknown-label");
      });
    });

    describe("AddressSpec passthrough", () => {
      it("should return AddressSpec object unchanged", () => {
        const input = { type: "index" as const, value: 42 };
        const result = parseAddressSpec(input);

        expect(result).toBe(input);
      });
    });
  });

  // ============================================================================
  // parseRange Tests
  // ============================================================================

  describe("parseRange", () => {
    it("should parse simple range", () => {
      const result = parseRange("0-5");

      expect(result).toEqual([0, 1, 2, 3, 4, 5]);
    });

    it("should parse single number", () => {
      const result = parseRange("42");

      expect(result).toEqual([42]);
    });

    it("should parse comma-separated numbers", () => {
      const result = parseRange("1,5,10");

      expect(result).toEqual([1, 5, 10]);
    });

    it("should parse mixed ranges and numbers", () => {
      const result = parseRange("0-2,10,20-22");

      expect(result).toEqual([0, 1, 2, 10, 20, 21, 22]);
    });

    it("should remove duplicates", () => {
      const result = parseRange("1-3,2-4");

      expect(result).toEqual([1, 2, 3, 4]);
    });

    it("should sort results", () => {
      const result = parseRange("10,5,1,8");

      expect(result).toEqual([1, 5, 8, 10]);
    });

    it("should handle whitespace", () => {
      const result = parseRange("1 , 2 , 3-5");

      expect(result).toEqual([1, 2, 3, 4, 5]);
    });

    it("should throw for invalid range (start > end)", () => {
      expect(() => parseRange("10-5")).toThrow(HotSweepError);
    });

    it("should throw for invalid number", () => {
      expect(() => parseRange("abc")).toThrow(HotSweepError);
    });
  });

  // ============================================================================
  // resolveToIndices Tests
  // ============================================================================

  describe("resolveToIndices", () => {
    it("should resolve index to array", () => {
      const result = resolveToIndices({ type: "index", value: 42 });

      expect(result).toEqual([42]);
    });

    it("should resolve indices", () => {
      const result = resolveToIndices({ type: "indices", value: [1, 5, 10] });

      expect(result).toEqual([1, 5, 10]);
    });

    it("should resolve range", () => {
      const result = resolveToIndices({ type: "range", value: "0-3" });

      expect(result).toEqual([0, 1, 2, 3]);
    });

    it("should throw for address type", () => {
      expect(() =>
        resolveToIndices({
          type: "address",
          value: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address,
        })
      ).toThrow(HotSweepError);
    });

    it("should throw for label type", () => {
      expect(() =>
        resolveToIndices({ type: "label", value: "hot-wallet" })
      ).toThrow(HotSweepError);
    });
  });

  // ============================================================================
  // resolveToAddress Tests
  // ============================================================================

  describe("resolveToAddress", () => {
    it("should return address directly", () => {
      const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address;
      const result = resolveToAddress({ type: "address", value: address });

      expect(result).toBe(address);
    });

    it("should resolve label to address", () => {
      const result = resolveToAddress(
        { type: "label", value: "hot-wallet" },
        mockWallets
      );

      expect(result).toBe(mockWallets["hot-wallet"]!.address);
    });

    it("should resolve index with resolver", () => {
      const result = resolveToAddress(
        { type: "index", value: 42 },
        undefined,
        mockAddressResolver
      );

      expect(result).toBe(mockAddressResolver(42));
    });

    it("should throw for unknown label", () => {
      expect(() =>
        resolveToAddress({ type: "label", value: "unknown" }, mockWallets)
      ).toThrow(HotSweepError);
    });

    it("should throw for index without resolver", () => {
      expect(() => resolveToAddress({ type: "index", value: 42 })).toThrow(
        HotSweepError
      );
    });

    it("should throw for indices type", () => {
      expect(() =>
        resolveToAddress({ type: "indices", value: [1, 2, 3] })
      ).toThrow(HotSweepError);
    });

    it("should throw for range type", () => {
      expect(() => resolveToAddress({ type: "range", value: "0-10" })).toThrow(
        HotSweepError
      );
    });
  });

  // ============================================================================
  // resolveToAddresses Tests
  // ============================================================================

  describe("resolveToAddresses", () => {
    it("should resolve single address", () => {
      const address = "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1" as Address;
      const result = resolveToAddresses({ type: "address", value: address });

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ identifier: address, address });
    });

    it("should resolve label", () => {
      const result = resolveToAddresses(
        { type: "label", value: "hot-wallet" },
        mockWallets
      );

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        identifier: "hot-wallet",
        address: mockWallets["hot-wallet"]!.address,
      });
    });

    it("should resolve index", () => {
      const result = resolveToAddresses(
        { type: "index", value: 5 },
        undefined,
        mockAddressResolver
      );

      expect(result).toHaveLength(1);
      expect(result[0]!.identifier).toBe("5");
    });

    it("should resolve indices", () => {
      const result = resolveToAddresses(
        { type: "indices", value: [1, 5, 10] },
        undefined,
        mockAddressResolver
      );

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.identifier)).toEqual(["1", "5", "10"]);
    });

    it("should resolve range", () => {
      const result = resolveToAddresses(
        { type: "range", value: "0-2" },
        undefined,
        mockAddressResolver
      );

      expect(result).toHaveLength(3);
      expect(result.map((r) => r.identifier)).toEqual(["0", "1", "2"]);
    });
  });
});
