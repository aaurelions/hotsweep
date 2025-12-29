import { HotSweepConfig } from "@hotsweep/types";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { queryBalances } from "../../src/balance/query";

describe("balance/query error handling", () => {
  let config: HotSweepConfig;

  beforeAll(() => {
    config = {
      version: "2.0.0",
      chains: {
        "eip155:1": {
          namespace: "eip155",
          chainId: 1,
          name: "ethereum",
          coinType: 60,
          enabled: true,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: {
              http: ["http://invalid-rpc-url-that-does-not-exist.com"],
            },
          },
        },
      },
      wallets: {
        test: {
          address: "0x0000000000000000000000000000000000000001",
          chains: ["eip155:1"],
          enabled: true,
        },
      },
      tokens: { "eip155:1": {} },
      settings: {
        batchSize: 10,
        parallelChains: true,
        retryAttempts: 0,
        retryDelay: 0,
      },
    };
  });

  it("should handle failed chain query gracefully", async () => {
    const consoleErrorSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    const result = await queryBalances(config, { target: "test" });

    expect(result.success).toBe(true);
    expect(result.data.length).toBe(1);
    expect(result.data[0].assets.length).toBe(0);
    expect(result.data[0].address).toBe(
      "0x0000000000000000000000000000000000000001"
    );
    expect(result.data[0].identifier).toBe("test");

    consoleErrorSpy.mockRestore();
  });

  it("should handle invalid target address spec", async () => {
    const result = await queryBalances(config, { target: "invalid-spec" });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeDefined();
      expect(result.error.code).toBeDefined();
    }
  });
});
