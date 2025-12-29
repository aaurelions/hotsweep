/**
 * @fileoverview Transfer execution integration tests
 * @module @hotsweep/core/transfer/executor
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { parseEther, type Address, formatUnits } from "viem";
import {
  executeTransfer,
  type TransferContext,
} from "../../src/transfer/executor";
import {
  type TransferOptions,
  type HotSweepConfig,
  ErrorCodes,
} from "@hotsweep/types";
import { startTestEnv } from "../prool";
import { clearClientCache } from "../../src/chain/client";

describe("transfer/executor", () => {
  let testEnv: Awaited<ReturnType<typeof startTestEnv>>;
  let mockConfig: HotSweepConfig;
  let testContext: TransferContext;

  // Anvil #0 (Deployer & Source)
  let sourceAddress: Address;
  // Anvil #1 (Hot Wallet)
  const destAddress = "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address;

  beforeAll(async () => {
    clearClientCache();
    testEnv = await startTestEnv();
    sourceAddress = testEnv.accounts.deployer.address;

    // 1. Mint Tokens to Source Address
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

    // Mint LGCY
    await testEnv.walletClient.writeContract({
      address: testEnv.contracts.mockLGCY as Address,
      abi: mintAbi,
      functionName: "mint",
      args: [sourceAddress, parseEther("1000")],
    });

    // Mint PRMT
    await testEnv.walletClient.writeContract({
      address: testEnv.contracts.mockPRMT as Address,
      abi: mintAbi,
      functionName: "mint",
      args: [sourceAddress, parseEther("1000")],
    });

    // Mint USDC (6 decimals)
    await testEnv.walletClient.writeContract({
      address: testEnv.contracts.mockUSDC as Address,
      abi: mintAbi,
      functionName: "mint",
      args: [sourceAddress, 1000000000n], // 1000 USDC
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
          address: destAddress,
          chains: ["eip155:31337"],
          enabled: true,
        },
        deployer: {
          address: sourceAddress,
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
          LGCY: {
            address: testEnv.contracts.mockLGCY as Address,
            enabled: true,
            decimals: 18,
            strategy: "legacy",
          },
          PRMT: {
            address: testEnv.contracts.mockPRMT as Address,
            enabled: true,
            decimals: 18,
            strategy: "eip2612",
          },
          USDC: {
            address: testEnv.contracts.mockUSDC as Address,
            enabled: true,
            decimals: 6,
            strategy: "eip3009",
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

    testContext = {
      config: mockConfig,
      signerAccount: testEnv.accounts.deployer, // Provide the signer directly
    };
  });

  afterAll(async () => {
    if (testEnv) await testEnv.server.stop();
  });

  // ============================================================================
  // Integration Tests
  // ============================================================================

  describe("Integration Tests", () => {
    it("should execute ETH transfer (Legacy)", async () => {
      const amount = "1";
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount,
      };

      const initialBalance = await testEnv.publicClient.getBalance({
        address: destAddress,
      });

      const result = await executeTransfer(testContext, options);

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tx.hash).toBeDefined();
        expect(result.amount.value).toBe(amount);
      }

      const finalBalance = await testEnv.publicClient.getBalance({
        address: destAddress,
      });
      expect(formatUnits(finalBalance - initialBalance, 18)).toBe(amount);
    });

    it("should execute ERC20 transfer (Legacy - LGCY)", async () => {
      const amount = "100";
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "LGCY",
        amount,
      };

      const result = await executeTransfer(testContext, options);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("legacy");

      // Verify balance
      const balance = (await testEnv.publicClient.readContract({
        address: testEnv.contracts.mockLGCY as Address,
        abi: [
          {
            name: "balanceOf",
            inputs: [{ type: "address" }],
            outputs: [{ type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [destAddress],
      })) as bigint;

      expect(formatUnits(balance, 18)).toBe(amount);
    });

    it("should execute ERC20 Permit transfer (EIP-2612 - PRMT)", async () => {
      const amount = "50";
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "PRMT",
        amount,
      };

      const result = await executeTransfer(testContext, options);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("eip2612");

      // Verify balance
      const balance = (await testEnv.publicClient.readContract({
        address: testEnv.contracts.mockPRMT as Address,
        abi: [
          {
            name: "balanceOf",
            inputs: [{ type: "address" }],
            outputs: [{ type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [destAddress],
      })) as bigint;

      expect(formatUnits(balance, 18)).toBe(amount);
    });

    it("should execute ERC20 TransferWithAuthorization (EIP-3009 - USDC)", async () => {
      const amount = "25";
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "USDC",
        amount,
      };

      const result = await executeTransfer(testContext, options);

      expect(result.success).toBe(true);
      expect(result.strategy).toBe("eip3009");

      // Verify balance
      const balance = (await testEnv.publicClient.readContract({
        address: testEnv.contracts.mockUSDC as Address,
        abi: [
          {
            name: "balanceOf",
            inputs: [{ type: "address" }],
            outputs: [{ type: "uint256" }],
            type: "function",
          },
        ],
        functionName: "balanceOf",
        args: [destAddress],
      })) as bigint;

      expect(formatUnits(balance, 6)).toBe(amount);
    });

    it("should handle insufficient balance error", async () => {
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount: "1000000000", // Exceeds balance
      };

      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(
          ErrorCodes.TRANSFER_INSUFFICIENT_BALANCE
        );
      }
    });

    it("should support dry run", async () => {
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount: "1",
        dryRun: true,
      };
      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.tx.hash).toBe("0x");
      }
    });

    it("should fail for invalid chain", async () => {
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "invalid-chain",
        token: "ETH",
        amount: "1",
      };
      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCodes.CHAIN_NOT_FOUND);
      }
    });

    it("should fail for invalid token", async () => {
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "INVALID",
        amount: "1",
      };
      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(false);
      if (!result.success && result.error) {
        expect(result.error.code).toBe(ErrorCodes.TOKEN_NOT_FOUND);
      }
    });

    it("should fail if from address spec is invalid", async () => {
      const options: TransferOptions = {
        from: "invalid-wallet-label",
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount: "1",
      };
      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(false);
      // Error code depends on resolution failure (likely wallet not found)
      expect(result.error).toBeDefined();
    });

    it("should fail for zero transfer amount", async () => {
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount: "0",
      };
      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.TRANSFER_INSUFFICIENT_BALANCE);
    });

    it("should fail if no signer is available", async () => {
      const contextWithoutSigner: TransferContext = {
        config: mockConfig,
      };
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount: "1",
      };
      const result = await executeTransfer(contextWithoutSigner, options);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.code).toBe(ErrorCodes.WALLET_KEY_NOT_FOUND);
      }
    });

    it("should fail for unsupported strategy", async () => {
      const options: TransferOptions = {
        from: sourceAddress,
        to: destAddress,
        chain: "anvil",
        token: "LGCY",
        amount: "1",
        strategy: "unsupported" as unknown as any, // keep for test but cast
      };
      const result = await executeTransfer(testContext, options);
      expect(result.success).toBe(false);
      expect(result.error.code).toBe(ErrorCodes.STRATEGY_UNSUPPORTED);
    });

    it("should use mnemonic from addressContext to sign", async () => {
      const mnemonic =
        "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
      const contextWithMnemonic: TransferContext = {
        config: mockConfig,
        addressContext: {
          mnemonic,
        },
      };

      // Derive address at index 0
      const { generateAddress } = await import("../../src/address/generator");
      const userAddress = generateAddress({ mnemonic }, 0).address;

      // Fund the derived address
      await testEnv.walletClient.sendTransaction({
        to: userAddress,
        value: parseEther("1"),
      });

      const options: TransferOptions = {
        from: "0", // index 0
        to: destAddress,
        chain: "anvil",
        token: "ETH",
        amount: "0.1",
      };

      const result = await executeTransfer(contextWithMnemonic, options);
      expect(result.success).toBe(true);
      expect(result.from.address).toBe(userAddress);
    });
  });
});
