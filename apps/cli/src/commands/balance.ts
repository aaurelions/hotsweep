/**
 * Balance command implementation
 */
import * as fs from "node:fs";
import chalk from "chalk";
import Table from "cli-table3";
import ora from "ora";
import { loadEnv, createHotSweep } from "@hotsweep/core";
import type { BalanceOptions, AddressBalanceResult } from "@hotsweep/types";

interface BalanceCommandOptions {
  target?: string;
  chain?: string;
  token?: string;
  min?: string;
  format?: "table" | "json" | "csv";
  output?: string;
}

export async function balanceCommand(
  options: BalanceCommandOptions
): Promise<void> {
  const spinner = ora();

  try {
    // Load environment
    loadEnv();

    // Validate options
    if (!options.target) {
      console.error(chalk.red("Error: --target is required"));
      console.log(chalk.dim("\nExamples:"));
      console.log(
        chalk.dim(
          "  sweep balance --target 42                    # Single address"
        )
      );
      console.log(
        chalk.dim(
          "  sweep balance --target 0-99 --token USDC     # Range with filter"
        )
      );
      console.log(
        chalk.dim(
          "  sweep balance --target hot-wallet            # Wallet label"
        )
      );
      process.exit(1);
    }

    // Create SDK instance
    const sweep = createHotSweep();

    // Build balance options
    const balanceOptions: BalanceOptions = {
      target: options.target,
      chain: options.chain,
      token: options.token,
      min: options.min,
      format: options.format ?? "table",
    };

    spinner.start("Querying balances...");

    // Query balances
    const result = await sweep.balance(balanceOptions);

    spinner.stop();

    if (!result.success) {
      console.error(chalk.red(`Error: ${result.error.message}`));
      process.exit(1);
    }

    // Format output
    const output = formatOutput(result.data, options.format ?? "table");

    // Write to file or display
    if (options.output) {
      fs.writeFileSync(options.output, output, "utf-8");
      console.log(chalk.green(`✓ Saved to ${options.output}`));
    } else {
      console.log(output);
    }

    // Summary
    if ((options.format ?? "table") === "table") {
      const totalAddresses = result.data.length;
      const totalAssets = result.data.reduce(
        (sum, r) => sum + r.assets.length,
        0
      );
      const totalValue = result.meta.totalUsdValue ?? 0;

      console.log("");
      console.log(
        chalk.dim(
          `Total: ${totalAddresses} address(es) • ${totalAssets} asset(s)`
        ) +
          (totalValue > 0
            ? chalk.dim(` • $${totalValue.toLocaleString()}`)
            : "")
      );
    }
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

function formatOutput(data: AddressBalanceResult[], format: string): string {
  switch (format) {
    case "json":
      return JSON.stringify({ data }, null, 2);

    case "csv": {
      const headers = "identifier,address,chain,token,balance,usdValue";
      const rows: string[] = [];

      for (const result of data) {
        for (const asset of result.assets) {
          rows.push(
            [
              result.identifier,
              result.address,
              asset.chainName,
              asset.symbol,
              asset.balance,
              asset.usdValue ?? "",
            ].join(",")
          );
        }
      }

      return [headers, ...rows].join("\n");
    }

    case "table":
    default: {
      if (data.length === 0) {
        return chalk.dim("No balances found");
      }

      // Single address - detailed view
      if (data.length === 1 && data[0]) {
        const result = data[0];
        const table = new Table({
          head: [
            chalk.white("Chain"),
            chalk.white("Token"),
            chalk.white("Balance"),
            chalk.white("USD Value"),
          ],
          colWidths: [15, 10, 20, 15],
        });

        for (const asset of result.assets) {
          table.push([
            asset.chainName,
            asset.symbol,
            formatBalance(asset.balance),
            asset.usdValue ? `$${asset.usdValue.toLocaleString()}` : "-",
          ]);
        }

        const header = [
          chalk.bold(
            `Balance Report • ${result.type === "index" ? `Index ${result.identifier}` : result.identifier}`
          ),
          chalk.dim(result.address),
        ].join("\n");

        return header + "\n\n" + table.toString();
      }

      // Multiple addresses - summary view
      const table = new Table({
        head: [
          chalk.white("Index"),
          chalk.white("Address"),
          chalk.white("Token"),
          chalk.white("Balance"),
        ],
        colWidths: [10, 15, 10, 20],
      });

      for (const result of data) {
        for (const asset of result.assets) {
          table.push([
            result.identifier,
            shortenAddress(result.address),
            asset.symbol,
            formatBalance(asset.balance),
          ]);
        }
      }

      return table.toString();
    }
  }
}

function formatBalance(balance: string): string {
  const num = parseFloat(balance);
  if (num === 0) return "0";
  if (num < 0.0001) return "<0.0001";
  return num.toLocaleString(undefined, { maximumFractionDigits: 6 });
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}
