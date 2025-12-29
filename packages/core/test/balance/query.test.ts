/**
 * @fileoverview Balance query tests
 * @module @hotsweep/core/balance/query
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { formatUnits, type Address } from "viem";
import { queryBalances } from "../../src/balance/query";
import type { HotSweepConfig } from "@hotsweep/types";
import { startTestEnv } from "../prool";
import { clearClientCache } from "../../src/chain/client";

describe("balance/query", () => {
  let testEnv: Awaited<ReturnType<typeof startTestEnv>>;
  let mockConfig: HotSweepConfig;

  // Anvil #1
  const testAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;
  // Anvil #2 (hot wallet)
  const hotWalletAddress =
    "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address;

  beforeAll(async () => {
    clearClientCache();
    testEnv = await startTestEnv();

    // Mint USDC to testAddress (Anvil #1 already has ETH)
    const mintAbi = [
      {
        name: "mint",
        type: "function",
        stateMutability: "nonpayable",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
        ],
        outputs: [],
      },
    ] as const;

    await testEnv.walletClient.writeContract({
      address: testEnv.contracts.mockUSDC as Address,
      abi: mintAbi,
      functionName: "mint",
      args: [testAddress, 5000000n], // 5 USDC
    });

    mockConfig = {
      version: "2.0.0",
      chains: {
        "eip155:31337": {
          namespace: "eip155",
          chainId: 31337,
          name: "anvil",
          coinType: 60,
          enabled: true,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: [testEnv.rpcUrl] } },
        },
      },
      wallets: {
        "hot-wallet": {
          address: hotWalletAddress,
          chains: ["eip155:31337"],
          enabled: true,
        },
      },
      tokens: {
        "eip155:31337": {
          ETH: {
            address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
            enabled: true,
          },
          USDC: {
            address: testEnv.contracts.mockUSDC as Address,
            enabled: true,
            decimals: 6,
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

  afterAll(async () => {
    if (testEnv) await testEnv.server.stop();
  });

  // ============================================================================
  // formatUnits Tests (viem utility)
  // ============================================================================

  describe("formatUnits (viem)", () => {
    it("should format wei to ether with 18 decimals", () => {
      const result = formatUnits(1000000000000000000n, 18);
      expect(result).toBe("1");
    });

    it("should format USDC with 6 decimals", () => {
      const result = formatUnits(1000000n, 6);
      expect(result).toBe("1");
    });

    it("should handle fractional values", () => {
      const result = formatUnits(1500000000000000000n, 18);
      expect(result).toBe("1.5");
    });

    it("should handle very small values", () => {
      const result = formatUnits(1n, 18);
      expect(result).toBe("0.000000000000000001");
    });

    it("should handle zero balance", () => {
      const result = formatUnits(0n, 18);
      expect(result).toBe("0");
    });

    it("should handle large balances", () => {
      const result = formatUnits(1000000000000000000000000n, 18);
      expect(result).toBe("1000000");
    });
  });

  // ============================================================================
  // queryBalances Tests
  // ============================================================================

  describe("queryBalances", () => {
    it("should return success result with data", async () => {
      const result = await queryBalances(mockConfig, {
        target: "hot-wallet",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBeDefined();
        expect(result.meta).toBeDefined();
        expect(result.meta.timestamp).toBeGreaterThan(0);

        // Should find ETH balance (Anvil default is 10000 ETH)
        const ethAsset = result.data[0]?.assets.find((a) => a.symbol === "ETH");
        expect(ethAsset).toBeDefined();
        expect(Number(ethAsset?.balance)).toBeGreaterThan(0);
      }
    });

    it("should include address identifier in result", async () => {
      const result = await queryBalances(mockConfig, {
        target: "hot-wallet",
      });

      if (result.success) {
        expect(result.data[0]?.identifier).toBe("hot-wallet");
        expect(result.data[0]?.type).toBe("label");
      }
    });

    it("should filter by chain when specified", async () => {
      const result = await queryBalances(mockConfig, {
        target: "hot-wallet",
        chain: "anvil",
      });

      expect(result.success).toBe(true);
    });

    it("should filter by token when specified", async () => {
      const result = await queryBalances(mockConfig, {
        target: "hot-wallet",
        token: "ETH",
      });

      expect(result.success).toBe(true);
      if (result.success) {
        // Should only contain ETH
        expect(result.data[0]?.assets.length).toBe(1);
        expect(result.data[0]?.assets[0]?.symbol).toBe("ETH");
      }
    });

    it("should filter by minimum balance", async () => {
      // Hot wallet has 10000 ETH. Filter min 10001 should exclude it.
      const result = await queryBalances(mockConfig, {
        target: "hot-wallet",
        min: "10001",
      });

      expect(result.success).toBe(true);
      // Data might be empty or asset list empty
      if (result.success) {
        // It filters assets. If all assets filtered, address entry might remain or not depending on implementation.
        // Usually if no assets, it might still return the address with empty assets?
        // Let's check logic: queryBalances likely filters assets.
        const assets = result.data[0]?.assets || [];
        expect(assets.length).toBe(0);
      }
    });
  });
});
