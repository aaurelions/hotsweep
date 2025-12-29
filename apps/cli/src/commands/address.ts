/**
 * Address command implementation
 */
import * as fs from "node:fs";
import chalk from "chalk";
import { loadEnv, createHotSweep } from "@hotsweep/core";
import type { AddressOptions, GeneratedAddress } from "@hotsweep/types";

interface AddressCommandOptions {
  index?: number;
  start?: number;
  count?: number;
  end?: number;
  coinType?: number;
  format?: "json" | "csv" | "text";
  output?: string;
}

export async function addressCommand(
  options: AddressCommandOptions
): Promise<void> {
  try {
    // Load environment
    loadEnv();

    // Validate options
    if (
      options.index === undefined &&
      options.count === undefined &&
      options.end === undefined
    ) {
      console.error(
        chalk.red("Error: Must provide --index, --count, or --end")
      );
      console.log(chalk.dim("\nExamples:"));
      console.log(
        chalk.dim("  sweep address --index 42           # Single address")
      );
      console.log(
        chalk.dim(
          "  sweep address --count 100          # Generate 100 addresses"
        )
      );
      console.log(
        chalk.dim("  sweep address --start 1000 --end 1099  # Range")
      );
      process.exit(1);
    }

    // Check for xpub/xpriv/mnemonic
    const xpub = process.env.SWEEP_XPUB;
    const xpriv = process.env.SWEEP_XPRIV;
    const mnemonic = process.env.SWEEP_MNEMONIC;

    if (!xpub && !xpriv && !mnemonic) {
      console.error(chalk.red("Error: No key source configured"));
      console.log(chalk.dim("\nSet one of these environment variables:"));
      console.log(
        chalk.dim(
          "  SWEEP_XPUB     - Extended public key (for address generation only)"
        )
      );
      console.log(chalk.dim("  SWEEP_XPRIV    - Extended private key"));
      console.log(chalk.dim("  SWEEP_MNEMONIC - BIP39 mnemonic phrase"));
      process.exit(1);
    }

    // Create SDK instance
    const sweep = createHotSweep();

    // Build address options
    const addressOptions: AddressOptions = {
      coinType: options.coinType ?? 60,
      format: options.format ?? "json",
      output: options.output,
    };

    if (options.index !== undefined) {
      (addressOptions as AddressOptions & { index: number }).index =
        options.index;
    } else {
      (addressOptions as AddressOptions & { startIndex: number }).startIndex =
        options.start ?? 0;
      if (options.count !== undefined) {
        (addressOptions as AddressOptions & { count: number }).count =
          options.count;
      } else if (options.end !== undefined) {
        (addressOptions as AddressOptions & { endIndex: number }).endIndex =
          options.end;
      }
    }

    // Generate addresses
    const result = sweep.address(addressOptions);

    // Format output
    const output = formatOutput(result.addresses, options.format ?? "json");

    // Write to file or stdout
    if (options.output) {
      fs.writeFileSync(options.output, output, "utf-8");
      console.log(
        chalk.green(
          `✓ Generated ${result.addresses.length} address(es) → ${options.output}`
        )
      );
    } else {
      console.log(output);
    }
  } catch (error) {
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

function formatOutput(addresses: GeneratedAddress[], format: string): string {
  switch (format) {
    case "json":
      if (addresses.length === 1) {
        return JSON.stringify(addresses[0], null, 2);
      }
      return JSON.stringify(addresses, null, 2);

    case "csv": {
      const headers = "index,path,address";
      const rows = addresses.map((a) => `${a.index},${a.path},${a.address}`);
      return [headers, ...rows].join("\n");
    }

    case "text": {
      return addresses
        .map(
          (a) =>
            `Index: ${a.index}\n` +
            `Path:  ${a.path}\n` +
            `Addr:  ${a.address}\n`
        )
        .join("\n");
    }

    default:
      return JSON.stringify(addresses, null, 2);
  }
}
