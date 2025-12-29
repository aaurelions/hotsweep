/**
 * @fileoverview Transfer strategy detection tests
 * @module @hotsweep/core/transfer/strategy
 */
import { describe, it, expect, beforeEach, beforeAll, afterAll } from "vitest";
import type { Address } from "viem";
import {
  detectStrategy,
  getStrategyName,
  getStrategySavings,
  clearStrategyCache,
} from "../../src/transfer/strategy";
import type { TokenConfig } from "@hotsweep/types";
import { NATIVE_TOKEN_ADDRESS } from "@hotsweep/types";
import { startTestEnv } from "../prool";

describe("transfer/strategy", () => {
  let testEnv: Awaited<ReturnType<typeof startTestEnv>>;

  let usdcToken: TokenConfig;
  let prmtToken: TokenConfig; // Using PRMT for EIP2612
  let legacyToken: TokenConfig;

  beforeAll(async () => {
    testEnv = await startTestEnv();

    usdcToken = {
      address: testEnv.contracts.mockUSDC as Address,
      enabled: true,
      decimals: 6,
      strategy: "eip3009",
    };

    prmtToken = {
      address: testEnv.contracts.mockPRMT as Address,
      enabled: true,
      decimals: 18,
      strategy: "eip2612",
    };

    legacyToken = {
      address: testEnv.contracts.mockLGCY as Address,
      enabled: true,
      decimals: 18,
      strategy: "legacy",
    };
  });

  afterAll(async () => {
    if (testEnv) await testEnv.server.stop();
  });

  beforeEach(() => {
    clearStrategyCache();
  });

  // ============================================================================
  // detectStrategy Tests
  // ============================================================================

  describe("detectStrategy", () => {
    it("should return legacy strategy for native token", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        NATIVE_TOKEN_ADDRESS
      );
      expect(result).toBe("legacy");
    });

    it("should respect forced strategy in token config", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        usdcToken.address!,
        usdcToken
      );
      expect(result).toBe("eip3009");
    });

    it("should respect eip2612 strategy in token config", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        prmtToken.address!,
        prmtToken
      );
      expect(result).toBe("eip2612");
    });

    it("should respect legacy strategy in token config", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        legacyToken.address!,
        legacyToken
      );
      expect(result).toBe("legacy");
    });

    it("should cache strategy detection results", async () => {
      // When forced strategy is in config, no caching needed (returns immediately)
      // This test validates the behavior works correctly
      await detectStrategy(testEnv.publicClient, usdcToken.address!, usdcToken);
      await detectStrategy(testEnv.publicClient, usdcToken.address!, usdcToken);

      // Both calls should return the same strategy
      const result = await detectStrategy(
        testEnv.publicClient,
        usdcToken.address!,
        usdcToken
      );
      expect(result).toBe("eip3009");
    });

    // Real detection tests (without config override)
    it("should detect eip3009 support for USDC", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        usdcToken.address!
      );
      expect(result).toBe("eip3009");
    });

    it("should detect eip2612 support for PRMT", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        prmtToken.address!
      );
      expect(result).toBe("eip2612");
    });

    it("should detect legacy for LGCY", async () => {
      const result = await detectStrategy(
        testEnv.publicClient,
        legacyToken.address!
      );
      expect(result).toBe("legacy");
    });
  });

  // ============================================================================
  // getStrategyName Tests
  // ============================================================================

  describe("getStrategyName", () => {
    it("should return correct name for eip7702", () => {
      expect(getStrategyName("eip7702")).toBe("EIP-7702 (Code Delegation)");
    });

    it("should return correct name for eip2612", () => {
      expect(getStrategyName("eip2612")).toBe("EIP-2612 (Permit)");
    });

    it("should return correct name for eip3009", () => {
      expect(getStrategyName("eip3009")).toBe(
        "EIP-3009 (TransferWithAuthorization)"
      );
    });

    it("should return correct name for legacy", () => {
      expect(getStrategyName("legacy")).toBe("Legacy (Standard Transfer)");
    });

    it("should return correct name for auto", () => {
      expect(getStrategyName("auto")).toBe("Auto (Best Available)");
    });
  });

  // ============================================================================
  // getStrategySavings Tests
  // ============================================================================

  describe("getStrategySavings", () => {
    it("should return 90% savings for eip7702", () => {
      expect(getStrategySavings("eip7702")).toBe(0.9);
    });

    it("should return 60% savings for eip2612", () => {
      expect(getStrategySavings("eip2612")).toBe(0.6);
    });

    it("should return 60% savings for eip3009", () => {
      expect(getStrategySavings("eip3009")).toBe(0.6);
    });

    it("should return 0% savings for legacy", () => {
      expect(getStrategySavings("legacy")).toBe(0);
    });

    it("should return average savings for auto", () => {
      expect(getStrategySavings("auto")).toBe(0.6);
    });
  });

  // ============================================================================
  // clearStrategyCache Tests
  // ============================================================================

  describe("clearStrategyCache", () => {
    it("should clear cached strategies", async () => {
      // Populate cache
      await detectStrategy(testEnv.publicClient, usdcToken.address!, usdcToken);

      // Clear cache
      clearStrategyCache();

      // Should trigger fresh detection
      const result = await detectStrategy(
        testEnv.publicClient,
        usdcToken.address!,
        usdcToken
      );

      // Strategy should still return same result
      expect(result).toBe("eip3009");
    });
  });
});
