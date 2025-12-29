import { parseEther, type Address } from "viem";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
  vi,
  beforeEach,
} from "vitest";
import { startTestEnv } from "./utils/prool";
import { transferCommand } from "../src/commands/transfer";
import { createHotSweep } from "@hotsweep/core";
import fs from "fs";
import path from "path";

// Mock environment variables
const MOCK_MNEMONIC =
  "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
const CONFIG_PATH = path.resolve(process.cwd(), "hotsweep.json");

describe("CLI Benchmark: Transfer Strategy", () => {
  let testEnv: Awaited<ReturnType<typeof startTestEnv>>;
  let sdk: ReturnType<typeof createHotSweep>;

  // Addresses
  const hotWallet = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8"; // Anvil #1

  beforeAll(async () => {
    testEnv = await startTestEnv();

    // Set ENV vars for CLI
    process.env.HOT_SWEEP_MNEMONIC = MOCK_MNEMONIC;
    process.env.SWEEP_MNEMONIC = MOCK_MNEMONIC; // Correct var for HotSweep SDK
    process.env.HOT_SWEEP_RPC = testEnv.rpcUrl;

    // Create config file
    const config = {
      version: "2.0.0",
      chains: {
        "eip155:31337": {
          name: "foundry",
          chainId: 31337,
          namespace: "eip155",
          nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
          coinType: 60,
          rpcUrls: {
            default: { http: [testEnv.rpcUrl] },
          },
          contracts: {
            hotsweep: { address: testEnv.contracts.hotsweep },
          },
          enabled: true,
        },
      },
      wallets: {}, // Empty as we use ENV for source
      tokens: {},
      settings: {},
    };
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));

    // Initialize SDK for address derivation
    sdk = createHotSweep({ configPath: CONFIG_PATH });
  }, 60000);

  afterAll(async () => {
    if (testEnv) await testEnv.server.stop();
    if (fs.existsSync(CONFIG_PATH)) fs.unlinkSync(CONFIG_PATH);
  });

  // Mock console to prevent noise but capture
  const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => {});
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

  beforeEach(() => {
    consoleSpy.mockClear();
    errorSpy.mockClear();
  });

  // Helper to mint tokens
  async function mintTokens(token: Address, to: Address, amount: bigint) {
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

    const hash = await testEnv.walletClient.writeContract({
      address: token,
      abi: mintAbi,
      functionName: "mint",
      args: [to, amount],
    });

    await testEnv.publicClient.waitForTransactionReceipt({ hash });
  }

  // Helper to fund ETH (for legacy)
  async function fundEth(to: Address, amount: bigint) {
    const hash = await testEnv.walletClient.sendTransaction({
      to,
      value: amount,
    });
    await testEnv.publicClient.waitForTransactionReceipt({ hash });
  }

  it("should auto-select EIP-3009 for USDC-like tokens (lowest gas)", async () => {
    const userIndex = 0;
    const userAddress = sdk.address({ index: userIndex }).addresses[0]
      .address as Address;
    const amount = parseEther("100");

    await mintTokens(testEnv.contracts.mockUSDC, userAddress, amount);
    await fundEth(userAddress, parseEther("1")); // Fund relayer

    // Mock process.exit to prevent test termination
    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    try {
      // Execute CLI command
      await transferCommand({
        from: userIndex.toString(),
        to: hotWallet,
        chain: "foundry",
        token: testEnv.contracts.mockUSDC,
        amount: "all",
        strategy: "auto",
      });

      if (exitSpy.mock.calls.length > 0) {
        const errors = errorSpy.mock.calls.map((c) => c.join(" "));
        throw new Error(`CLI exited with error: ${errors.join("\n")}`);
      }

      const calls = consoleSpy.mock.calls.map((c) => c.join(" "));
      const strategyLog = calls.find((l) => l.includes("Strategy:"));
      expect(strategyLog).toContain("EIP-3009");
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("should auto-select EIP-2612 for Permit tokens", async () => {
    const userIndex = 1;
    const userAddress = sdk.address({ index: userIndex }).addresses[0]
      .address as Address;
    const amount = parseEther("100");

    await mintTokens(testEnv.contracts.mockPRMT, userAddress, amount);
    await fundEth(userAddress, parseEther("1")); // Fund relayer

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    try {
      await transferCommand({
        from: userIndex.toString(),
        to: hotWallet,
        chain: "foundry",
        token: testEnv.contracts.mockPRMT,
        amount: "all",
        strategy: "auto",
      });

      if (exitSpy.mock.calls.length > 0) {
        const errors = errorSpy.mock.calls.map((c) => c.join(" "));
        throw new Error(`CLI exited with error: ${errors.join("\n")}`);
      }

      const calls = consoleSpy.mock.calls.map((c) => c.join(" "));
      const has2612 = calls.some(
        (l) => l.includes("Strategy:") && l.includes("EIP-2612")
      );
      expect(has2612).toBe(true);
    } finally {
      exitSpy.mockRestore();
    }
  });

  it("should fallback to Legacy for basic ERC20 (and fail if no ETH)", async () => {
    const userIndex = 2;
    const userAddress = sdk.address({ index: userIndex }).addresses[0]
      .address as Address;
    const amount = parseEther("100");

    await mintTokens(testEnv.contracts.mockLGCY, userAddress, amount);
    // Do NOT fund ETH

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    await transferCommand({
      from: userIndex.toString(),
      to: hotWallet,
      chain: "foundry",
      token: testEnv.contracts.mockLGCY,
      amount: "all",
      strategy: "auto",
    });

    const calls = consoleSpy.mock.calls.map((c) => c.join(" "));
    const failedLog = calls.find((l) => l.includes("Transfer Failed"));
    expect(failedLog).toBeDefined();

    exitSpy.mockRestore();
  });

  it("should succeed with Legacy if ETH is provided", async () => {
    const userIndex = 3;
    const userAddress = sdk.address({ index: userIndex }).addresses[0]
      .address as Address;
    const amount = parseEther("100");

    await mintTokens(testEnv.contracts.mockLGCY, userAddress, amount);
    await fundEth(userAddress, parseEther("0.1"));

    const exitSpy = vi
      .spyOn(process, "exit")
      .mockImplementation((() => {}) as any);

    try {
      await transferCommand({
        from: userIndex.toString(),
        to: hotWallet,
        chain: "foundry",
        token: testEnv.contracts.mockLGCY,
        amount: "all",
        strategy: "auto",
      });

      if (exitSpy.mock.calls.length > 0) {
        const errors = errorSpy.mock.calls.map((c) => c.join(" "));
        throw new Error(`CLI exited with error: ${errors.join("\n")}`);
      }

      const calls = consoleSpy.mock.calls.map((c) => c.join(" "));
      const hasLegacy = calls.some(
        (l) => l.includes("Strategy:") && l.includes("Legacy")
      );
      expect(hasLegacy).toBe(true);
    } finally {
      exitSpy.mockRestore();
    }
  });
});
