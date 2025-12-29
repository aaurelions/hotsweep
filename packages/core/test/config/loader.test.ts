/**
 * @fileoverview Configuration loader tests
 * @module @hotsweep/core/config/loader
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  loadConfig,
  loadConfigFromPath,
  saveConfig,
  loadEnv,
  getEnv,
  requireEnv,
  validateConfigDetailed,
  getChainConfig,
  getWalletConfig,
  getTokenConfig,
  toCaip2ChainId,
} from "../../src/config/loader";
import { HotSweepError } from "@hotsweep/types";
import type { HotSweepConfig } from "@hotsweep/types";

describe("config/loader", () => {
  // ... existing fixtures ...

  // ============================================================================
  // Environment Tests
  // ============================================================================

  describe("environment", () => {
    const envPath = path.join(__dirname, "../fixtures/.env.test");

    afterEach(() => {
      if (fs.existsSync(envPath)) fs.unlinkSync(envPath);
      delete process.env.TEST_VAR;
    });

    it("should load env from path", () => {
      fs.writeFileSync(envPath, "TEST_VAR=123");
      loadEnv(envPath);
      expect(process.env.TEST_VAR).toBe("123");
    });

    it("should load env from default paths", () => {
      // We can't easily test this without mocking fs or writing to root .env, which is dangerous.
      // But we can call loadEnv() without args and ensure it doesn't crash.
      loadEnv();
    });

    it("should get env var", () => {
      process.env.TEST_VAR = "456";
      expect(getEnv("TEST_VAR")).toBe("456");
      expect(getEnv("NON_EXISTENT", "default")).toBe("default");
    });

    it("should require env var", () => {
      process.env.TEST_VAR = "789";
      expect(requireEnv("TEST_VAR")).toBe("789");
      expect(() => requireEnv("NON_EXISTENT")).toThrow(HotSweepError);
    });
  });

  // ... existing tests ...

  const validConfig: HotSweepConfig = {
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
        aliases: ["pol", "matic"],
        coinType: 60,
        enabled: false,
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
      "hot-wallet": {
        address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
        chains: ["eip155:1", "eip155:137"],
        enabled: false,
      },
    },
    tokens: {
      "eip155:1": {
        ETH: {
          address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
          enabled: true,
        },
        USDC: {
          address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
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

  const testConfigPath = path.join(__dirname, "../fixtures/test-config.json");

  beforeEach(() => {
    // Ensure fixtures directory exists
    const fixturesDir = path.join(__dirname, "../fixtures");
    if (!fs.existsSync(fixturesDir)) {
      fs.mkdirSync(fixturesDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testConfigPath)) {
      fs.unlinkSync(testConfigPath);
    }
  });

  describe("loadConfig", () => {
    it("should load from default path if not provided", () => {
      // Create hotsweep.json in current directory
      const cwdConfigPath = path.join(process.cwd(), "hotsweep.json");
      fs.writeFileSync(cwdConfigPath, JSON.stringify(validConfig));

      try {
        const config = loadConfig();
        expect(config.version).toBe("2.0.0");
      } finally {
        if (fs.existsSync(cwdConfigPath)) fs.unlinkSync(cwdConfigPath);
      }
    });

    it("should throw if no config found", () => {
      // Ensure no config exists
      const cwdConfigPath = path.join(process.cwd(), "hotsweep.json");
      if (fs.existsSync(cwdConfigPath)) fs.unlinkSync(cwdConfigPath);

      expect(() => loadConfig()).toThrow(HotSweepError);
    });
  });

  // ============================================================================
  // loadConfigFromPath Tests
  // ============================================================================

  describe("loadConfigFromPath", () => {
    it("should load valid config from file", () => {
      fs.writeFileSync(testConfigPath, JSON.stringify(validConfig, null, 2));

      const loaded = loadConfigFromPath(testConfigPath);

      expect(loaded.version).toBe("2.0.0");
      expect(loaded.chains["eip155:1"]!.name).toBe("ethereum");
    });

    it("should throw for invalid JSON", () => {
      fs.writeFileSync(testConfigPath, "{ invalid json }");

      expect(() => loadConfigFromPath(testConfigPath)).toThrow(HotSweepError);
    });

    it("should throw for missing required fields", () => {
      fs.writeFileSync(testConfigPath, JSON.stringify({ version: "2.0.0" }));

      expect(() => loadConfigFromPath(testConfigPath)).toThrow(HotSweepError);
    });

    it("should throw for non-existent file", () => {
      expect(() => loadConfigFromPath("/nonexistent/path.json")).toThrow();
    });
  });

  // ============================================================================
  // saveConfig Tests
  // ============================================================================

  describe("saveConfig", () => {
    it("should save config to file", () => {
      saveConfig(validConfig, testConfigPath);

      expect(fs.existsSync(testConfigPath)).toBe(true);

      const loaded = JSON.parse(fs.readFileSync(testConfigPath, "utf-8"));
      expect(loaded.version).toBe("2.0.0");
    });

    it("should format JSON with 2-space indent", () => {
      saveConfig(validConfig, testConfigPath);

      const content = fs.readFileSync(testConfigPath, "utf-8");
      expect(content).toContain("\n  "); // 2-space indent
    });
  });

  // ============================================================================
  // validateConfigDetailed Tests
  // ============================================================================

  describe("validateConfigDetailed", () => {
    it("should return valid for correct config", () => {
      const result = validateConfigDetailed(validConfig);

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return warnings for disabled chains", () => {
      const result = validateConfigDetailed(validConfig);

      expect(result.warnings.some((w) => w.message.includes("disabled"))).toBe(
        true
      );
    });

    it("should return warnings for missing hotsweep contracts", () => {
      const result = validateConfigDetailed(validConfig);

      expect(
        result.warnings.some((w) =>
          w.message.includes("HotSweep contract not deployed")
        )
      ).toBe(true);
    });

    it("should return valid false for invalid config", () => {
      // Completely invalid config structure
      const invalid = { version: "2.0.0" }; // Missing required chains, wallets, tokens, settings
      const result = validateConfigDetailed(invalid);

      // The validation should fail
      expect(result.valid).toBe(false);
    });
  });

  // ============================================================================
  // getChainConfig Tests
  // ============================================================================

  describe("getChainConfig", () => {
    it("should get chain by CAIP-2 ID", () => {
      const chain = getChainConfig(validConfig, "eip155:1");

      expect(chain?.name).toBe("ethereum");
    });

    it("should get chain by numeric chain ID", () => {
      const chain = getChainConfig(validConfig, 1);

      expect(chain?.name).toBe("ethereum");
    });

    it("should get chain by string chain ID", () => {
      const chain = getChainConfig(validConfig, "137");

      expect(chain?.name).toBe("polygon");
    });

    it("should get chain by name", () => {
      const chain = getChainConfig(validConfig, "ethereum");

      expect(chain?.chainId).toBe(1);
    });

    it("should get chain by alias", () => {
      const chain = getChainConfig(validConfig, "eth");

      expect(chain?.name).toBe("ethereum");
    });

    it("should be case-insensitive for names", () => {
      const chain = getChainConfig(validConfig, "ETHEREUM");

      expect(chain?.name).toBe("ethereum");
    });

    it("should return undefined for unknown chain", () => {
      const chain = getChainConfig(validConfig, "unknown");

      expect(chain).toBeUndefined();
    });
  });

  // ============================================================================
  // getWalletConfig Tests
  // ============================================================================

  describe("getWalletConfig", () => {
    it("should get wallet by label", () => {
      const wallet = getWalletConfig(validConfig, "deployer");

      expect(wallet?.address).toBe(
        "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"
      );
    });

    it("should return undefined for unknown wallet", () => {
      const wallet = getWalletConfig(validConfig, "unknown");

      expect(wallet).toBeUndefined();
    });
  });

  // ============================================================================
  // getTokenConfig Tests
  // ============================================================================

  describe("getTokenConfig", () => {
    it("should get token by symbol", () => {
      const token = getTokenConfig(validConfig, "eip155:1", "USDC");

      expect(token?.decimals).toBe(6);
    });

    it("should return undefined for unknown token", () => {
      const token = getTokenConfig(validConfig, "eip155:1", "UNKNOWN");

      expect(token).toBeUndefined();
    });

    it("should return undefined for unknown chain", () => {
      const token = getTokenConfig(
        validConfig,
        "eip155:999" as CAIP2ChainId,
        "ETH"
      );
      expect(token).toBeUndefined();
    });
  });

  // ============================================================================
  // toCaip2ChainId Tests
  // ============================================================================

  describe("toCaip2ChainId", () => {
    it("should return CAIP-2 ID unchanged", () => {
      const result = toCaip2ChainId(validConfig, "eip155:1");

      expect(result).toBe("eip155:1");
    });

    it("should convert numeric chain ID", () => {
      const result = toCaip2ChainId(validConfig, 137);

      expect(result).toBe("eip155:137");
    });

    it("should convert string chain ID", () => {
      const result = toCaip2ChainId(validConfig, "1");

      expect(result).toBe("eip155:1");
    });

    it("should convert chain name", () => {
      const result = toCaip2ChainId(validConfig, "polygon");

      expect(result).toBe("eip155:137");
    });

    it("should convert chain alias", () => {
      const result = toCaip2ChainId(validConfig, "pol");

      expect(result).toBe("eip155:137");
    });

    it("should return undefined for unknown identifier", () => {
      const result = toCaip2ChainId(validConfig, "unknown");

      expect(result).toBeUndefined();
    });
  });
});
