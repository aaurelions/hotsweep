import { parseEther, type Address } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { signAuthorization } from "viem/experimental";
/*
TODO: fix see: VIEM.doc.md file
'signAuthorization' is deprecated.ts(6385)
index.d.ts(53, 5): The declaration was marked as deprecated here.
*/
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { clearClientCache } from "../src/chain/client";
import {
  signPermit,
  signTransferWithAuthorization,
} from "../src/transfer/signatures";
import { generateMnemonic } from "../src/wallet/mnemonic";
import { startTestEnv } from "./prool";

interface BenchmarkResult {
  strategy: string;
  token: string;
  usersProcessed: number;
  totalGas: bigint;
  perUserGas: number;
  transactions: number;
  totalSwept: bigint;
  fundingCost: bigint;
  sweepCost: bigint;
  breakdown: string;
}

interface UserDeposit {
  account: ReturnType<typeof mnemonicToAccount>;
  depositAmount: bigint;
}

describe("Real-World Token Sweep Benchmark", () => {
  let testEnv: Awaited<ReturnType<typeof startTestEnv>>;

  const hotWallets = {
    legacy: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8" as Address,
    permit: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC" as Address,
    auth: "0x90F79bf6EB2c4f870365E785982E1f101E93b906" as Address,
    eip7702: "0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65" as Address,
  };

  const BATCH_SIZES = [1, 5, 10, 25, 50, 100];

  beforeAll(async () => {
    clearClientCache();
    testEnv = await startTestEnv();
  }, 60000);

  afterAll(async () => {
    if (testEnv) await testEnv.server.stop();
  });

  function generateUserDeposits(
    count: number,
    offset: number = 0
  ): UserDeposit[] {
    const mnemonic = generateMnemonic();
    const deposits: UserDeposit[] = [];

    for (let i = 0; i < count; i++) {
      const account = mnemonicToAccount(mnemonic, { addressIndex: i + offset });
      const baseAmount = Math.floor(1 + Math.random() * 99);
      const depositAmount = parseEther(baseAmount.toString());
      deposits.push({ account, depositAmount });
    }

    return deposits;
  }

  async function mintTokensSequential(
    deposits: UserDeposit[],
    tokenAddress: Address
  ): Promise<void> {
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

    for (const deposit of deposits) {
      await testEnv.walletClient.writeContract({
        address: tokenAddress,
        abi: mintAbi,
        functionName: "mint",
        args: [deposit.account.address, deposit.depositAmount],
      });
    }
  }

  async function getBalance(
    tokenAddress: Address,
    owner: Address
  ): Promise<bigint> {
    const balanceAbi = [
      {
        name: "balanceOf",
        type: "function",
        stateMutability: "view",
        inputs: [{ name: "account", type: "address" }],
        outputs: [{ name: "", type: "uint256" }],
      },
    ] as const;

    return await testEnv.publicClient.readContract({
      address: tokenAddress,
      abi: balanceAbi,
      functionName: "balanceOf",
      args: [owner],
    });
  }

  BATCH_SIZES.forEach((BATCH_SIZE) => {
    it(`should sweep ${BATCH_SIZE} user deposits using optimal strategies`, async () => {
      const results: BenchmarkResult[] = [];

      console.log(`\n${"=".repeat(100)}`);
      console.log(
        `REAL-WORLD SCENARIO: ${BATCH_SIZE} users deposited ERC20 → sweep to hot wallet`
      );
      console.log(
        `Context: Users have ONLY tokens (no ETH), custodian must sweep efficiently`
      );
      console.log("=".repeat(100));

      // =======================================================================
      // STRATEGY 1: LEGACY - Standard ERC20 Transfer
      // =======================================================================
      // Use case: Basic ERC20 tokens without any extensions
      // Flow: 1) Fund each user with ETH for gas, 2) Each user transfers tokens
      // Realistic?: YES - This is how most custodial wallets work today
      // Cost: Exchange pays gas for funding + users pay for transfers
      // =======================================================================

      console.log(`\n[1/4] Testing LEGACY (Basic ERC20 Transfer)...`);

      const legacyDeposits = generateUserDeposits(BATCH_SIZE, 0);
      await mintTokensSequential(legacyDeposits, testEnv.contracts.mockLGCY);

      let legacyFundingGas = 0n;
      let legacySweepGas = 0n;
      const transferAbi = [
        {
          name: "transfer",
          type: "function",
          inputs: [
            { name: "to", type: "address" },
            { name: "val", type: "uint256" },
          ],
          outputs: [{ name: "", type: "bool" }],
          stateMutability: "nonpayable",
        },
      ] as const;

      for (const deposit of legacyDeposits) {
        const fundHash = await testEnv.walletClient.sendTransaction({
          to: deposit.account.address,
          value: parseEther("0.01"),
        });
        const fundReceipt =
          await testEnv.publicClient.waitForTransactionReceipt({
            hash: fundHash,
          });
        legacyFundingGas += fundReceipt.gasUsed;
      }

      for (const deposit of legacyDeposits) {
        const hash = await testEnv.walletClient.writeContract({
          account: deposit.account,
          chain: null,
          address: testEnv.contracts.mockLGCY as Address,
          abi: transferAbi,
          functionName: "transfer",
          args: [hotWallets.legacy, deposit.depositAmount],
        });

        const receipt = await testEnv.publicClient.waitForTransactionReceipt({
          hash,
        });
        legacySweepGas += receipt.gasUsed;
      }

      const legacySwept = await getBalance(
        testEnv.contracts.mockLGCY,
        hotWallets.legacy
      );

      results.push({
        strategy: "LEGACY",
        token: "MockLGCY (Basic ERC20)",
        usersProcessed: BATCH_SIZE,
        totalGas: legacyFundingGas + legacySweepGas,
        perUserGas: Number(legacyFundingGas + legacySweepGas) / BATCH_SIZE,
        transactions: BATCH_SIZE * 2,
        totalSwept: legacySwept,
        fundingCost: legacyFundingGas,
        sweepCost: legacySweepGas,
        breakdown: `${BATCH_SIZE} funding + ${BATCH_SIZE} transfers`,
      });

      // =======================================================================
      // STRATEGY 2: EIP-2612 - Gasless Permit + Batch Sweep
      // =======================================================================
      // Use case: Tokens with permit() support (ERC20Permit)
      // Flow: 1) Users sign permits off-chain, 2) Relayer executes batch sweep
      // Realistic?: YES - Used by Uniswap, 1inch, and many modern DeFi protocols
      // Cost: Exchange pays gas ONLY for batch sweep (no funding needed)
      // =======================================================================

      console.log(`[2/4] Testing EIP-2612 (Permit + Batch Sweep)...`);

      const permitDeposits = generateUserDeposits(BATCH_SIZE, 1000);
      await mintTokensSequential(permitDeposits, testEnv.contracts.mockPRMT);

      const permitBatches = [];
      const currentTime = Math.floor(Date.now() / 1000);

      for (const deposit of permitDeposits) {
        const permit = await signPermit(deposit.account, testEnv.publicClient, {
          tokenAddress: testEnv.contracts.mockPRMT as Address,
          tokenName: "Permit Token",
          spender: testEnv.contracts.hotsweep as Address,
          value: deposit.depositAmount,
          nonce: 0n,
          deadline: BigInt(currentTime + 3600),
        });

        permitBatches.push({
          token: testEnv.contracts.mockPRMT,
          owner: deposit.account.address,
          amount: permit.value,
          deadline: permit.deadline,
          v: permit.v,
          r: permit.r,
          s: permit.s,
        });
      }

      const permitHash = await testEnv.walletClient.writeContract({
        address: testEnv.contracts.hotsweep as Address,
        abi: [
          {
            name: "executeBatchPermitSweep",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              {
                components: [
                  { name: "token", type: "address" },
                  { name: "owner", type: "address" },
                  { name: "amount", type: "uint256" },
                  { name: "deadline", type: "uint256" },
                  { name: "v", type: "uint8" },
                  { name: "r", type: "bytes32" },
                  { name: "s", type: "bytes32" },
                ],
                name: "batches",
                type: "tuple[]",
              },
              { name: "recipient", type: "address" },
            ],
            outputs: [],
          },
        ],
        functionName: "executeBatchPermitSweep",
        args: [permitBatches, hotWallets.permit],
      });

      const permitReceipt =
        await testEnv.publicClient.waitForTransactionReceipt({
          hash: permitHash,
        });

      const permitSwept = await getBalance(
        testEnv.contracts.mockPRMT,
        hotWallets.permit
      );

      results.push({
        strategy: "EIP-2612",
        token: "MockPRMT (ERC20Permit)",
        usersProcessed: BATCH_SIZE,
        totalGas: permitReceipt.gasUsed,
        perUserGas: Number(permitReceipt.gasUsed) / BATCH_SIZE,
        transactions: 1,
        totalSwept: permitSwept,
        fundingCost: 0n,
        sweepCost: permitReceipt.gasUsed,
        breakdown: `1 batch sweep (${BATCH_SIZE} permits)`,
      });

      // =======================================================================
      // STRATEGY 3: EIP-3009 - Transfer Authorization + Batch Sweep
      // =======================================================================
      // Use case: USDC, USDT, and other tokens with transferWithAuthorization
      // Flow: 1) Users sign authorizations off-chain, 2) Relayer executes batch
      // Realistic?: YES - This is how Circle's USDC and many stablecoins work
      // Cost: Exchange pays gas ONLY for batch sweep (no funding needed)
      // Note: Direct transfer to hot wallet (not via intermediate contract)
      // =======================================================================

      console.log(`[3/4] Testing EIP-3009 (Transfer Authorization)...`);

      const authDeposits = generateUserDeposits(BATCH_SIZE, 2000);

      const authDepositsUSDC = authDeposits.map((d) => ({
        ...d,
        depositAmount: d.depositAmount / 10n ** 12n,
      }));

      await mintTokensSequential(authDepositsUSDC, testEnv.contracts.mockUSDC);

      const authBatches = [];

      for (const deposit of authDepositsUSDC) {
        const auth = await signTransferWithAuthorization(
          deposit.account,
          testEnv.publicClient,
          {
            tokenAddress: testEnv.contracts.mockUSDC as Address,
            tokenName: "USD Coin",
            to: hotWallets.auth,
            value: deposit.depositAmount,
            validAfter: 0n,
            validBefore: BigInt(currentTime + 3600),
          }
        );

        authBatches.push({
          token: testEnv.contracts.mockUSDC,
          from: auth.from,
          to: auth.to,
          value: auth.value,
          validAfter: auth.validAfter,
          validBefore: auth.validBefore,
          nonce: auth.nonce,
          v: auth.v,
          r: auth.r,
          s: auth.s,
        });
      }

      const authHash = await testEnv.walletClient.writeContract({
        address: testEnv.contracts.hotsweep as Address,
        abi: [
          {
            name: "executeBatchAuthSweep",
            type: "function",
            stateMutability: "nonpayable",
            inputs: [
              {
                components: [
                  { name: "token", type: "address" },
                  { name: "from", type: "address" },
                  { name: "to", type: "address" },
                  { name: "value", type: "uint256" },
                  { name: "validAfter", type: "uint256" },
                  { name: "validBefore", type: "uint256" },
                  { name: "nonce", type: "bytes32" },
                  { name: "v", type: "uint8" },
                  { name: "r", type: "bytes32" },
                  { name: "s", type: "bytes32" },
                ],
                name: "batches",
                type: "tuple[]",
              },
            ],
            outputs: [],
          },
        ],
        functionName: "executeBatchAuthSweep",
        args: [authBatches],
      });

      const authReceipt = await testEnv.publicClient.waitForTransactionReceipt({
        hash: authHash,
      });

      const authSwept = await getBalance(
        testEnv.contracts.mockUSDC,
        hotWallets.auth
      );

      results.push({
        strategy: "EIP-3009",
        token: "MockUSDC (6 decimals, USDC-like)",
        usersProcessed: BATCH_SIZE,
        totalGas: authReceipt.gasUsed,
        perUserGas: Number(authReceipt.gasUsed) / BATCH_SIZE,
        transactions: 1,
        totalSwept: authSwept,
        fundingCost: 0n,
        sweepCost: authReceipt.gasUsed,
        breakdown: `1 batch sweep (${BATCH_SIZE} authorizations)`,
      });

      // =======================================================================
      // STRATEGY 4: EIP-7702 - Account Delegation
      // =======================================================================
      // Use case: Next-gen wallets with account abstraction features
      // Flow: 1) Users sign delegations, 2) Relayer calls user EOAs directly
      // Realistic?: PARTIAL - EIP-7702 is not yet widely deployed on mainnet
      // Cost: Exchange pays gas for delegated calls (no funding needed)
      // =======================================================================

      console.log(`[4/4] Testing EIP-7702 (Account Delegation)...`);

      const eip7702Deposits = generateUserDeposits(BATCH_SIZE, 3000);
      await mintTokensSequential(eip7702Deposits, testEnv.contracts.mockDLGT);

      let eip7702TotalGas = 0n;

      const sweepTokenAbi = [
        {
          name: "sweepAllTokens",
          type: "function",
          inputs: [
            { name: "token", type: "address" },
            { name: "recipient", type: "address" },
          ],
          outputs: [],
          stateMutability: "nonpayable",
        },
      ] as const;

      for (const deposit of eip7702Deposits) {
        const authorization = await signAuthorization(testEnv.walletClient, {
          contractAddress: testEnv.contracts.hotsweep as Address,
          chainId: 31337,
          nonce: 0,
          account: deposit.account,
        });

        const hash = await testEnv.walletClient.writeContract({
          account: testEnv.accounts.deployer,
          address: deposit.account.address,
          abi: sweepTokenAbi,
          functionName: "sweepAllTokens",
          args: [testEnv.contracts.mockDLGT as Address, hotWallets.eip7702],
          authorizationList: [authorization],
          chain: null,
        });

        const receipt = await testEnv.publicClient.waitForTransactionReceipt({
          hash,
        });
        eip7702TotalGas += receipt.gasUsed;
      }

      const eip7702Swept = await getBalance(
        testEnv.contracts.mockDLGT,
        hotWallets.eip7702
      );

      results.push({
        strategy: "EIP-7702",
        token: "MockDLGT (Basic ERC20)",
        usersProcessed: BATCH_SIZE,
        totalGas: eip7702TotalGas,
        perUserGas: Number(eip7702TotalGas) / BATCH_SIZE,
        transactions: BATCH_SIZE,
        totalSwept: eip7702Swept,
        fundingCost: 0n,
        sweepCost: eip7702TotalGas,
        breakdown: `${BATCH_SIZE} delegated calls`,
      });

      // =======================================================================
      // RESULTS ANALYSIS
      // =======================================================================

      console.log(`\n${"=".repeat(100)}`);
      console.log(`RESULTS: ${BATCH_SIZE} Users`);
      console.log("=".repeat(100));

      const table = results.map((r) => {
        const displaySwept = r.token.includes("USDC")
          ? (Number(r.totalSwept) / 1e6).toFixed(2)
          : (Number(r.totalSwept) / 1e18).toFixed(2);

        return {
          Strategy: r.strategy,
          Token: r.token,
          "Total Gas": Number(r.totalGas).toLocaleString(),
          "Gas/User": Math.round(r.perUserGas).toLocaleString(),
          Funding: Number(r.fundingCost).toLocaleString(),
          Sweep: Number(r.sweepCost).toLocaleString(),
          Txs: r.transactions,
          Swept: displaySwept,
        };
      });

      console.table(table);

      console.log(`\n📊 SCENARIO ANALYSIS:\n`);

      const totalCostRanked = [...results]
        .sort((a, b) => Number(a.totalGas) - Number(b.totalGas))
        .map((r, index) => ({
          rank: index + 1,
          strategy: r.strategy,
          totalGas: Number(r.totalGas),
          fundingGas: Number(r.fundingCost),
          sweepGas: Number(r.sweepCost),
        }));

      console.log(`🏆 Total Gas Cost (Funding + Sweep):`);
      totalCostRanked.forEach((r) => {
        const medal =
          r.rank === 1
            ? "🥇"
            : r.rank === 2
              ? "🥈"
              : r.rank === 3
                ? "🥉"
                : "  ";
        console.log(
          `${medal} #${r.rank} ${r.strategy.padEnd(10)} | ${r.totalGas.toLocaleString().padStart(12)} gas ` +
            `(fund: ${r.fundingGas.toLocaleString().padStart(9)}, sweep: ${r.sweepGas.toLocaleString().padStart(9)})`
        );
      });

      const sweepOnlyRanked = [...results]
        .filter((r) => r.fundingCost === 0n)
        .sort((a, b) => Number(a.sweepCost) - Number(b.sweepCost));

      if (sweepOnlyRanked.length > 0) {
        console.log(`\n⚡ Gasless Strategies (No Funding Required):`);
        sweepOnlyRanked.forEach((r, index) => {
          const medal =
            index === 0 ? "🥇" : index === 1 ? "🥈" : index === 2 ? "🥉" : "  ";
          console.log(
            `${medal} #${index + 1} ${r.strategy.padEnd(10)} | ${Number(r.sweepCost).toLocaleString().padStart(12)} gas | ` +
              `${Math.round(r.perUserGas).toLocaleString().padStart(8)} per user | ${r.transactions} tx`
          );
        });
      }

      const legacyResult = results.find((r) => r.strategy === "LEGACY");
      if (legacyResult) {
        console.log(`\n💰 Cost Savings vs LEGACY (${BATCH_SIZE} users):\n`);
        results
          .filter((r) => r.strategy !== "LEGACY")
          .forEach((r) => {
            const savings = Number(legacyResult.totalGas) - Number(r.totalGas);
            const savingsPercent = (
              (savings / Number(legacyResult.totalGas)) *
              100
            ).toFixed(1);
            const indicator = savings > 0 ? "✅" : "❌";
            const sign = savings > 0 ? "↓" : "↑";
            console.log(
              `   ${indicator} ${r.strategy.padEnd(10)} ${sign}${Math.abs(parseFloat(savingsPercent)).toFixed(1)}% ` +
                `(${savings > 0 ? "saves" : "costs"} ${Math.abs(savings).toLocaleString()} gas)`
            );
          });
      }

      console.log(`\n💡 PRODUCTION RECOMMENDATIONS:\n`);

      const winner = totalCostRanked[0];
      const winnerResult = results.find((r) => r.strategy === winner.strategy);
      if (winnerResult) {
        console.log(`   ⭐ MOST EFFICIENT OVERALL: ${winner.strategy}`);
        console.log(
          `      • ${winner.totalGas.toLocaleString()} total gas for ${BATCH_SIZE} users`
        );
        console.log(
          `      • ${Math.round(winnerResult.perUserGas).toLocaleString()} gas per user`
        );
        console.log(`      • ${winnerResult.transactions} transaction(s)`);
      }

      if (BATCH_SIZE >= 10) {
        console.log(`\n   📦 BATCH PROCESSING ADVANTAGES:`);
        const batchStrategies = results.filter((r) => r.transactions === 1);
        if (batchStrategies.length > 0) {
          const avgBatchGas =
            batchStrategies.reduce((sum, r) => sum + Number(r.totalGas), 0) /
            batchStrategies.length;
          console.log(
            `      • Single atomic transaction (all-or-nothing execution)`
          );
          console.log(`      • No funding overhead for gasless patterns`);
          console.log(
            `      • Average ${Math.round(avgBatchGas / BATCH_SIZE).toLocaleString()} gas/user for batch strategies`
          );
        }
      }

      console.log(`\n   🎯 TOKEN-SPECIFIC RECOMMENDATIONS:`);
      console.log(
        `      Token Type                              Strategy      Why`
      );
      console.log(`      ${"─".repeat(80)}`);
      console.log(
        `      Basic ERC20 (DAI, LINK, UNI)            LEGACY        Only option`
      );
      console.log(
        `      ERC20Permit (modern tokens)             EIP-2612      Gasless + batch`
      );
      console.log(
        `      USDC/USDT (EIP-3009 support)            EIP-3009      Lowest gas/user`
      );
      console.log(
        `      Future AA wallets                       EIP-7702      Experimental`
      );

      console.log(`\n   ⚠️  CRITICAL IMPLEMENTATION NOTES:`);
      console.log(
        `      • LEGACY: Only option for basic ERC20 without extensions`
      );
      console.log(
        `      • EIP-3009: transferWithAuthorization allows any relayer to execute`
      );
      console.log(
        `      • EIP-2612: Check token has permit() before implementing`
      );
      console.log(
        `      • Gasless strategies eliminate ~${Math.round((Number(legacyResult?.fundingCost || 0n) / Number(legacyResult?.totalGas || 1n)) * 100)}% overhead by avoiding funding txs`
      );

      console.log(`\n${"=".repeat(100)}\n`);

      expect(results.length).toBe(4);
      results.forEach((result) => {
        expect(result.totalGas).toBeGreaterThan(0n);
        expect(result.totalSwept).toBeGreaterThan(0n);
        expect(result.fundingCost + result.sweepCost).toBe(result.totalGas);
      });
    }, 300000);
  });
});
