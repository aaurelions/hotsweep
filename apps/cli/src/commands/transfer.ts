/**
 * Transfer command implementation
 */
import * as fs from "node:fs";
import chalk from "chalk";
import ora from "ora";
import { loadEnv, createHotSweep, getStrategyName } from "@hotsweep/core";
import type {
  TransferOptions,
  TransferResult,
  SweepStrategy,
} from "@hotsweep/types";

interface TransferCommandOptions {
  batch?: string;
  from?: string;
  to?: string;
  chain?: string;
  token?: string;
  amount?: string;
  ref?: string;
  strategy?: SweepStrategy;
  dryRun?: boolean;
  parallel?: number;
}

export async function transferCommand(
  options: TransferCommandOptions
): Promise<void> {
  const spinner = ora();

  try {
    // Load environment
    loadEnv();

    // Validate options
    if (options.batch) {
      // Batch mode
      await executeBatchTransfer(options);
      return;
    }

    // Single transfer mode
    if (
      !options.from ||
      !options.to ||
      !options.chain ||
      !options.token ||
      !options.amount
    ) {
      console.error(
        chalk.red(
          "Error: --from, --to, --chain, --token, and --amount are required"
        )
      );
      console.log(chalk.dim("\nExamples:"));
      console.log(
        chalk.dim(
          "  sweep transfer --from 42 --to hot-wallet --chain polygon --token USDC --amount all"
        )
      );
      console.log(
        chalk.dim(
          "  sweep transfer --from 0-99 --to 0x... --chain ethereum --token ETH --amount all"
        )
      );
      console.log(
        chalk.dim("  sweep transfer --batch ./sweeps.json --parallel 10")
      );
      process.exit(1);
    }

    // Create SDK instance
    const sweep = createHotSweep();

    // Build transfer options
    const transferOptions: TransferOptions = {
      from: options.from,
      to: options.to,
      chain: options.chain,
      token: options.token,
      amount: options.amount,
      ref: options.ref,
      strategy: options.strategy ?? "auto",
      dryRun: options.dryRun,
      parallel: options.parallel,
    };

    if (options.dryRun) {
      spinner.start("Simulating transfer...");
    } else {
      spinner.start("Executing transfer...");
    }

    // Execute transfer
    const result = await sweep.transfer(transferOptions);

    spinner.stop();

    // Display result
    displayTransferResult(result, options.dryRun);
  } catch (error) {
    spinner.stop();
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

async function executeBatchTransfer(
  options: TransferCommandOptions
): Promise<void> {
  const batchPath = options.batch!;

  if (!fs.existsSync(batchPath)) {
    console.error(chalk.red(`Error: Batch file not found: ${batchPath}`));
    process.exit(1);
  }

  const content = fs.readFileSync(batchPath, "utf-8");
  let batches: any[];

  if (batchPath.endsWith(".csv")) {
    // Parse CSV
    const lines = content.split("\n").filter((l) => l.trim());
    const headers = lines[0]!.split(",").map((h) => h.trim());
    batches = lines.slice(1).map((line) => {
      const values = line.split(",").map((v) => v.trim());
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = values[i] ?? "";
      });
      return obj;
    });
  } else {
    // Parse JSON
    batches = JSON.parse(content);
  }

  console.log(chalk.bold(`Processing ${batches.length} transfers...`));
  console.log("");

  const sweep = createHotSweep();
  const results: TransferResult[] = [];
  const parallel = options.parallel ?? 1;

  let completed = 0;
  let failed = 0;

  for (let i = 0; i < batches.length; i += parallel) {
    const batch = batches.slice(i, i + parallel);

    const promises = batch.map(async (entry: any) => {
      const transferOptions: TransferOptions = {
        from: entry.from?.value ?? entry.from,
        to: entry.to?.value ?? entry.to,
        chain: entry.chainId ?? entry.chain,
        token: entry.token,
        amount: entry.amount,
        ref: entry.reference ?? entry.ref,
        strategy: entry.strategy ?? "auto",
        dryRun: options.dryRun,
      };

      return sweep.transfer(transferOptions);
    });

    const batchResults = await Promise.all(promises);

    for (const result of batchResults) {
      results.push(result);
      if (result.success) {
        completed++;
      } else {
        failed++;
      }
    }

    // Progress
    const progress = Math.round(((i + batch.length) / batches.length) * 100);
    const bar =
      "█".repeat(Math.floor(progress / 5)) +
      "░".repeat(20 - Math.floor(progress / 5));
    process.stdout.write(
      `\r[${bar}] ${progress}% (${completed + failed}/${batches.length}) • ${failed} failed`
    );
  }

  console.log("\n");

  // Summary
  console.log(chalk.bold("Batch Transfer Complete"));
  console.log(`  Total:     ${batches.length}`);
  console.log(`  Success:   ${chalk.green(completed)}`);
  console.log(`  Failed:    ${failed > 0 ? chalk.red(failed) : "0"}`);
}

function displayTransferResult(result: TransferResult, dryRun?: boolean): void {
  console.log("");

  if (result.success) {
    const successResult = result as TransferResult & { success: true };

    console.log(chalk.bold("Transfer Summary"));
    console.log("─".repeat(50));
    console.log(
      `From:     ${successResult.from.identifier} (${shortenAddress(successResult.from.address)})`
    );
    console.log(
      `To:       ${successResult.to.identifier} (${shortenAddress(successResult.to.address)})`
    );
    console.log(
      `Chain:    ${successResult.chain.name} (${successResult.chain.id})`
    );
    console.log(
      `Token:    ${successResult.token.symbol} (${shortenAddress(successResult.token.address)})`
    );
    console.log(
      `Amount:   ${successResult.amount.value} ${successResult.token.symbol}`
    );
    console.log(`Strategy: ${getStrategyName(successResult.strategy)}`);

    if (dryRun) {
      console.log("─".repeat(50));
      console.log(chalk.yellow("Status:   ⚠ Simulation only (dry-run mode)"));
    } else if (successResult.tx.hash) {
      console.log("─".repeat(50));
      console.log(`Status:   ${chalk.green("✓ Confirmed")}`);
      console.log(`Tx Hash:  ${successResult.tx.hash}`);
      if (successResult.tx.gasUsed) {
        console.log(`Gas Used: ${successResult.tx.gasUsed.toString()}`);
      }
    }
  } else {
    console.log(chalk.red("Transfer Failed"));
    console.log("─".repeat(50));
    console.log(`From: ${result.from.identifier} (${result.from.address})`);
    console.log(`To:   ${result.to.identifier} (${result.to.address})`);
    console.log("");
    console.log(chalk.red(`Error: ${result.error.message}`));
    if (result.error.code) {
      console.log(chalk.dim(`Code:  ${result.error.code}`));
    }
  }

  console.log("");
}

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
