import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  getPublicClient,
  getWebSocketClient,
  getAllPublicClients,
  clearClientCache,
} from "../../src/chain/client";
import { startTestEnv } from "../prool";
import type { HotSweepConfig } from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";

describe("chain/client", () => {
  let testEnv: Awaited<ReturnType<typeof startTestEnv>>;
  let config: HotSweepConfig;

  beforeAll(async () => {
    testEnv = await startTestEnv();

    config = {
      version: "2.0.0",
      chains: {
        "eip155:31337": {
          namespace: "eip155",
          chainId: 31337,
          name: "anvil",
          coinType: 60,
          enabled: true,
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: {
            default: {
              http: [testEnv.rpcUrl],
              webSocket: ["ws://localhost:8545"],
            },
          },
        },
        "eip155:1": {
          namespace: "eip155",
          chainId: 1,
          name: "ethereum",
          coinType: 60,
          enabled: false, // Disabled chain
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          rpcUrls: { default: { http: ["https://eth.merkle.io"] } },
        },
      },
      wallets: {},
      tokens: {},
      settings: {
        batchSize: 10,
        parallelChains: true,
        retryAttempts: 1,
        retryDelay: 100,
      },
    };
  });

  afterAll(async () => {
    if (testEnv) await testEnv.server.stop();
  });

  it("should get public client for enabled chain", () => {
    const client = getPublicClient(config, "eip155:31337");
    expect(client).toBeDefined();
    expect(client.chain?.id).toBe(31337);
  });

  it("should cache public client", () => {
    clearClientCache();
    const client1 = getPublicClient(config, "eip155:31337");
    const client2 = getPublicClient(config, "eip155:31337");
    expect(client1).toBe(client2); // Same reference
  });

  it("should throw for disabled chain", () => {
    expect(() => getPublicClient(config, "eip155:1")).toThrow(HotSweepError);
    try {
      getPublicClient(config, "eip155:1");
    } catch (e) {
      expect((e as HotSweepError).code).toBe(ErrorCodes.CHAIN_DISABLED);
    }
  });

  it("should throw for unknown chain", () => {
    expect(() => getPublicClient(config, "eip155:999")).toThrow(HotSweepError);
  });

  it("should get all public clients", () => {
    const clients = getAllPublicClients(config);
    expect(clients.size).toBe(1); // Only anvil is enabled
    expect(clients.has("eip155:31337")).toBe(true);
  });

  it("should get websocket client", () => {
    const client = getWebSocketClient(config, "eip155:31337");
    expect(client).toBeDefined();
    expect(client.transport.type).toBe("webSocket");
  });

  it("should throw if no websocket url", () => {
    const configNoWs = { ...config, chains: { ...config.chains } };
    configNoWs.chains["eip155:31337"] = {
      ...config.chains["eip155:31337"]!,
      rpcUrls: { default: { http: [testEnv.rpcUrl] } }, // No WS
    };

    expect(() => getWebSocketClient(configNoWs, "eip155:31337")).toThrow(
      HotSweepError
    );
  });
});
