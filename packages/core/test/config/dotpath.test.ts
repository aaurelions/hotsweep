/**
 * @fileoverview Dot notation path utilities tests
 * @module @hotsweep/core/config/dotpath
 */
import { describe, it, expect, beforeEach } from "vitest";
import {
  getByPath,
  setByPath,
  deleteByPath,
  hasPath,
  parseDotPath,
  buildDotPath,
  inferType,
} from "../../src/config/dotpath";
import { HotSweepError } from "@hotsweep/types";
import type { HotSweepConfig } from "@hotsweep/types";

describe("config/dotpath", () => {
  // ============================================================================
  // Test Fixtures
  // ============================================================================

  let testConfig: HotSweepConfig;

  beforeEach(() => {
    testConfig = {
      version: "2.0.0",
      chains: {
        "eip155:1": {
          namespace: "eip155",
          chainId: 1,
          name: "ethereum",
          aliases: ["eth", "mainnet"],
          coinType: 60,
          enabled: true,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: { http: ["https://eth.merkle.io"] },
          },
        },
        "eip155:137": {
          namespace: "eip155",
          chainId: 137,
          name: "polygon",
          coinType: 60,
          enabled: true,
          nativeCurrency: { name: "POL", symbol: "POL", decimals: 18 },
          rpcUrls: {
            default: { http: ["https://polygon-rpc.com"] },
          },
        },
      },
      wallets: {
        deployer: {
          address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
          chains: ["eip155:1"],
          enabled: true,
        },
      },
      tokens: {
        "eip155:1": {
          ETH: {
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            enabled: true,
          },
        },
      },
      settings: {
        batchSize: 20,
        parallelChains: true,
        retryAttempts: 3,
        retryDelay: 5000,
      },
    };
  });

  // ============================================================================
  // parseDotPath Tests
  // ============================================================================

  describe("parseDotPath", () => {
    it("should parse simple dot path", () => {
      const result = parseDotPath("settings.batchSize");

      expect(result).toEqual(["settings", "batchSize"]);
    });

    it("should parse CAIP-2 chain IDs", () => {
      const result = parseDotPath("chains.eip155:1.name");

      expect(result).toEqual(["chains", "eip155:1", "name"]);
    });

    it("should handle array indices", () => {
      const result = parseDotPath("chains.eip155:1.rpcUrls.default.http.0");

      expect(result).toEqual([
        "chains",
        "eip155:1",
        "rpcUrls",
        "default",
        "http",
        "0",
      ]);
    });

    it("should handle bracket notation", () => {
      const result = parseDotPath("chains['eip155:1'].name");

      expect(result).toEqual(["chains", "eip155:1", "name"]);
    });

    it("should handle quoted bracket notation", () => {
      const result = parseDotPath('chains["eip155:1"].name');

      expect(result).toEqual(["chains", "eip155:1", "name"]);
    });

    it("should return empty array for empty path", () => {
      expect(parseDotPath("")).toEqual([]);
    });
  });

  // ============================================================================
  // buildDotPath Tests
  // ============================================================================

  describe("buildDotPath", () => {
    it("should build dot path from parts", () => {
      const result = buildDotPath(["chains", "eip155:1", "name"]);

      expect(result).toBe("chains.eip155:1.name");
    });

    it("should handle empty parts", () => {
      expect(buildDotPath([])).toBe("");
    });
  });

  // ============================================================================
  // getByPath Tests
  // ============================================================================

  describe("getByPath", () => {
    it("should get top-level value", () => {
      const result = getByPath(testConfig, "version");

      expect(result).toBe("2.0.0");
    });

    it("should get nested value", () => {
      const result = getByPath(testConfig, "settings.batchSize");

      expect(result).toBe(20);
    });

    it("should get deeply nested value", () => {
      const result = getByPath(
        testConfig,
        "chains.eip155:1.nativeCurrency.symbol"
      );

      expect(result).toBe("ETH");
    });

    it("should get array value", () => {
      const result = getByPath(
        testConfig,
        "chains.eip155:1.rpcUrls.default.http.0"
      );

      expect(result).toBe("https://eth.merkle.io");
    });

    it("should get object value", () => {
      const result = getByPath(testConfig, "chains.eip155:1.nativeCurrency");

      expect(result).toEqual({ name: "Ether", symbol: "ETH", decimals: 18 });
    });

    it("should throw for non-existent path", () => {
      expect(() => getByPath(testConfig, "nonexistent.path")).toThrow(
        HotSweepError
      );
    });

    it("should throw for path through non-object", () => {
      expect(() => getByPath(testConfig, "version.nested")).toThrow(
        HotSweepError
      );
    });
  });

  // ============================================================================
  // hasPath Tests
  // ============================================================================

  describe("hasPath", () => {
    it("should return true for existing path", () => {
      expect(hasPath(testConfig, "settings.batchSize")).toBe(true);
    });

    it("should return false for non-existent path", () => {
      expect(hasPath(testConfig, "settings.nonexistent")).toBe(false);
    });

    it("should return false for undefined value path", () => {
      // hasPath returns false for paths that don't exist
      expect(hasPath(testConfig, "settings.nonExistentField")).toBe(false);
    });
  });

  // ============================================================================
  // setByPath Tests
  // ============================================================================

  describe("setByPath", () => {
    it("should set existing value", () => {
      const result = setByPath(testConfig, "settings.batchSize", 50);

      expect(result.settings.batchSize).toBe(50);
      expect(testConfig.settings.batchSize).toBe(20); // Original unchanged
    });

    it("should create new nested path", () => {
      const result = setByPath(
        testConfig,
        "settings.newSetting.nested",
        "value"
      );

      expect((result.settings as any).newSetting.nested).toBe("value");
    });

    it("should set array value", () => {
      const result = setByPath(
        testConfig,
        "chains.eip155:1.rpcUrls.default.http.1",
        "https://new-rpc.com"
      );

      expect(result.chains["eip155:1"]!.rpcUrls.default.http[1]).toBe(
        "https://new-rpc.com"
      );
    });

    it("should replace object value", () => {
      const newCurrency = { name: "New", symbol: "NEW", decimals: 8 };
      const result = setByPath(
        testConfig,
        "chains.eip155:1.nativeCurrency",
        newCurrency
      );

      expect(result.chains["eip155:1"]!.nativeCurrency).toEqual(newCurrency);
    });

    it("should throw for empty path", () => {
      expect(() => setByPath(testConfig, "", "value")).toThrow(HotSweepError);
    });

    it("should throw when trying to set on non-object", () => {
      expect(() => setByPath(testConfig, "version.nested", "value")).toThrow(
        HotSweepError
      );
    });

    it("should be immutable", () => {
      const original = JSON.parse(JSON.stringify(testConfig));
      setByPath(testConfig, "settings.batchSize", 999);

      expect(testConfig.settings.batchSize).toBe(original.settings.batchSize);
    });
  });

  // ============================================================================
  // deleteByPath Tests
  // ============================================================================

  describe("deleteByPath", () => {
    it("should delete existing key", () => {
      const result = deleteByPath(testConfig, "chains.eip155:137");

      expect(result.chains["eip155:137"]).toBeUndefined();
      expect(testConfig.chains["eip155:137"]).toBeDefined(); // Original unchanged
    });

    it("should delete nested key", () => {
      const result = deleteByPath(testConfig, "chains.eip155:1.aliases");

      expect(result.chains["eip155:1"]!.aliases).toBeUndefined();
    });

    it("should throw for non-existent path", () => {
      expect(() => deleteByPath(testConfig, "nonexistent.path")).toThrow(
        HotSweepError
      );
    });

    it("should throw for empty path", () => {
      expect(() => deleteByPath(testConfig, "")).toThrow(HotSweepError);
    });

    it("should be immutable", () => {
      const originalChainCount = Object.keys(testConfig.chains).length;
      deleteByPath(testConfig, "chains.eip155:137");

      expect(Object.keys(testConfig.chains).length).toBe(originalChainCount);
    });
  });

  // ============================================================================
  // inferType Tests
  // ============================================================================

  describe("inferType", () => {
    it("should infer boolean true", () => {
      expect(inferType("true")).toBe(true);
    });

    it("should infer boolean false", () => {
      expect(inferType("false")).toBe(false);
    });

    it("should infer null", () => {
      expect(inferType("null")).toBe(null);
    });

    it("should infer integer", () => {
      expect(inferType("42")).toBe(42);
      expect(inferType("-10")).toBe(-10);
    });

    it("should infer float", () => {
      expect(inferType("3.14")).toBe(3.14);
      expect(inferType("-2.5")).toBe(-2.5);
    });

    it("should infer JSON array", () => {
      expect(inferType('["a", "b"]')).toEqual(["a", "b"]);
    });

    it("should infer JSON object", () => {
      expect(inferType('{"key": "value"}')).toEqual({ key: "value" });
    });

    it("should return string for plain text", () => {
      expect(inferType("hello")).toBe("hello");
      expect(inferType("some text")).toBe("some text");
    });

    it("should return string for invalid JSON", () => {
      expect(inferType("{invalid}")).toBe("{invalid}");
    });
  });
});
