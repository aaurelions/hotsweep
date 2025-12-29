#!/usr/bin/env node
/**
 * HotSweep CLI - Command Line Interface
 */
import { program } from "commander";
import chalk from "chalk";
import { version } from "../../package.json";

// Import commands
import { initCommand } from "../commands/init";
import { addressCommand } from "../commands/address";
import { transferCommand } from "../commands/transfer";
import { balanceCommand } from "../commands/balance";
import { configCommand } from "../commands/config";

// ============================================================================
// CLI Configuration
// ============================================================================

program
  .name("sweep")
  .description(
    chalk.bold("HotSweep CLI") +
      " - Enterprise-Grade Cryptocurrency Sweep System\n\n" +
      "Built on HD Wallets (BIP32/44) with Multi-Strategy Gas Optimization"
  )
  .version(version, "-v, --version", "Output the current version");

// ============================================================================
// Register Commands
// ============================================================================

// Init command
program
  .command("init")
  .description("Initialize environment (contracts + config)")
  .option("--deploy <chains>", "Deploy contracts to chains (e.g., 1,137,42161)")
  .option("--test", "Initialize test environment (Anvil)")
  .option("--config <path>", "Config file path", "./hotsweep.json")
  .option("--force", "Overwrite existing deployments")
  .action(initCommand);

// Address command
program
  .command("address")
  .description("Generate HD deposit addresses")
  .option("-i, --index <n>", "Single address index", parseInt)
  .option("-s, --start <n>", "Start index for batch", parseInt)
  .option("-c, --count <n>", "Number of addresses to generate", parseInt)
  .option("-e, --end <n>", "End index (inclusive)", parseInt)
  .option("-t, --coin-type <n>", "BIP44 coin type (60=Ethereum)", parseInt)
  .option("-f, --format <type>", "Output format (json, csv, text)", "json")
  .option("-o, --output <path>", "Save to file")
  .action(addressCommand);

// Transfer command
program
  .command("transfer")
  .description("Execute batch payments/sweeps")
  .option("--batch <path>", "Batch file path (JSON/CSV)")
  .option("--from <val>", "Source (index, range, or label)")
  .option("--to <val>", "Destination (address, index, or label)")
  .option("--chain <id>", "Chain ID or name")
  .option("--token <symbol>", "Token symbol or address")
  .option("--amount <val>", "Amount or 'all'")
  .option("--ref <text>", "Transaction reference ID")
  .option(
    "--strategy <type>",
    "Strategy (auto, eip7702, eip2612, eip3009, legacy)"
  )
  .option("--dry-run", "Simulate without broadcasting")
  .option("--parallel <n>", "Concurrent transfers", parseInt)
  .action(transferCommand);

// Balance command
program
  .command("balance")
  .description("Query multi-chain balances")
  .option("--target <val>", "Target (index, range, address, or label)")
  .option("--chain <id>", "Filter by chain")
  .option("--token <symbol>", "Filter by token")
  .option("--min <amount>", "Minimum balance threshold")
  .option("-f, --format <type>", "Output format (table, json, csv)", "table")
  .option("-o, --output <path>", "Save to file")
  .action(balanceCommand);

// Config command group
const configCmd = program.command("config").description("Manage configuration");

configCmd
  .command("get [key]")
  .description("Get configuration value")
  .option("--json", "Output raw JSON")
  .option("--file <path>", "Config file path")
  .action(async (key, options) => {
    const { configGetCommand } = await import("../commands/config");
    return configGetCommand(key, options);
  });

configCmd
  .command("set <key> <value>")
  .description("Set configuration value")
  .option("--file <path>", "Config file path")
  .action(async (key, value, options) => {
    const { configSetCommand } = await import("../commands/config");
    return configSetCommand(key, value, options);
  });

configCmd
  .command("del <key>")
  .description("Delete configuration key")
  .option("--file <path>", "Config file path")
  .action(async (key, options) => {
    const { configDelCommand } = await import("../commands/config");
    return configDelCommand(key, options);
  });

configCmd
  .command("validate")
  .description("Validate configuration")
  .option("--file <path>", "Config file path")
  .action(async (options) => {
    const { configValidateCommand } = await import("../commands/config");
    return configValidateCommand(options);
  });

configCmd
  .command("path")
  .description("Print config file path")
  .action(async () => {
    const { configPathCommand } = await import("../commands/config");
    return configPathCommand();
  });

// Default config command (display full config)
configCmd.action(configCommand);

// ============================================================================
// Error Handling
// ============================================================================

program.exitOverride((err) => {
  if (err.code === "commander.helpDisplayed") {
    process.exit(0);
  }
  console.error(chalk.red(`Error: ${err.message}`));
  process.exit(1);
});

// ============================================================================
// Parse and Execute
// ============================================================================

program.parse();
