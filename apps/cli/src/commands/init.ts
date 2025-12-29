/**
 * Init command implementation
 */
import chalk from "chalk";
import ora from "ora";
import * as fs from "node:fs";
import {
  loadConfig,
  saveConfig,
  loadEnv,
  checkAnvilConnection,
  initTestEnvironment,
} from "@hotsweep/core";
import type { InitOptions, HotSweepConfig } from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";

export async function initCommand(options: InitOptions): Promise<void> {
  const spinner = ora();

  try {
    // Load environment
    loadEnv();

    if (options.test) {
      // Test environment initialization
      spinner.start("Connecting to Anvil...");

      const isConnected = await checkAnvilConnection();
      if (!isConnected) {
        spinner.fail("Anvil is not running");
        console.log(chalk.yellow("\n  Start Anvil with: anvil\n"));
        process.exit(1);
      }

      spinner.succeed("Connected to Anvil (chainId: 31337)");

      // Load config
      spinner.start("Loading configuration...");
      let config: HotSweepConfig;
      const configPath = options.config ?? "./hotsweep.json";

      try {
        config = loadConfig(options.config);
        spinner.succeed(`Configuration loaded (version ${config.version})`);
      } catch (error) {
        if (
          error instanceof HotSweepError &&
          error.code === ErrorCodes.CONFIG_NOT_FOUND
        ) {
          spinner.info(
            "Configuration not found, creating default test config..."
          );
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
                  default: { http: ["http://127.0.0.1:8545"] },
                },
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
          saveConfig(config, configPath);
          spinner.succeed(`Created default configuration: ${configPath}`);
        } else {
          throw error;
        }
      }

      // Initialize test environment
      spinner.start("Initializing test environment...");
      const testEnv = await initTestEnvironment(config);
      spinner.succeed("Test environment ready");

      // Display summary
      console.log("");
      console.log(chalk.green("✓ Environment ready for testing"));
      console.log("");
      console.log(chalk.dim("Contracts:"));
      console.log(`  HotSweep:  ${chalk.cyan(testEnv.contracts.hotsweep)}`);
      console.log(`  MockLGCY:  ${chalk.cyan(testEnv.contracts.mockLGCY)}`);
      console.log(`  MockDLGT:  ${chalk.cyan(testEnv.contracts.mockDLGT)}`);
      console.log(`  MockPRMT:  ${chalk.cyan(testEnv.contracts.mockPRMT)}`);
      console.log(`  MockUSDC:  ${chalk.cyan(testEnv.contracts.mockUSDC)}`);
      console.log("");
      console.log(chalk.dim("Accounts:"));
      console.log(
        `  Deployer:   ${chalk.cyan(testEnv.accounts.deployer.address)}`
      );
      console.log(
        `  Hot Wallet: ${chalk.cyan(testEnv.accounts.hotWallet.address)}`
      );
      console.log("");

      return;
    }

    if (options.deploy) {
      // Contract deployment
      const chainIds = options.deploy
        .split(",")
        .map((s) => parseInt(s.trim(), 10));

      spinner.start("Loading configuration...");
      const config = loadConfig(options.config);
      spinner.succeed(`Configuration loaded (version ${config.version})`);

      for (const chainId of chainIds) {
        const caip2Id = `eip155:${chainId}` as const;
        const chainConfig = config.chains[caip2Id];

        if (!chainConfig) {
          console.log(
            chalk.yellow(`⚠ Chain ${chainId} not configured, skipping`)
          );
          continue;
        }

        spinner.start(
          `Deploying to ${chainConfig.name} (chainId: ${chainId})...`
        );

        // Note: Actual deployment is done via forge
        console.log(
          chalk.yellow(`\n  Contract deployment requires Foundry. Run:\n`)
        );
        console.log(
          chalk.cyan(
            `  cd packages/contracts && forge script script/HotSweep.s.sol --rpc-url <RPC_URL> --broadcast\n`
          )
        );

        spinner.info(`Use 'forge script' for contract deployment`);
      }

      return;
    }

    // Validation mode (default)
    spinner.start("Validating configuration...");

    const config = loadConfig(options.config);
    spinner.succeed("Configuration valid");

    // Display summary
    console.log("");
    console.log(chalk.bold("HotSweep Configuration"));
    console.log(chalk.dim(`Version: ${config.version}`));
    console.log(chalk.dim(`File: ${options.config ?? "./hotsweep.json"}`));
    console.log("");

    const enabledChains = Object.entries(config.chains).filter(
      ([, c]) => c.enabled
    );
    const enabledWallets = Object.entries(config.wallets).filter(
      ([, w]) => w.enabled
    );

    console.log(`Chains:  ${chalk.green(enabledChains.length)} enabled`);
    for (const [, chain] of enabledChains) {
      const hasContract = chain.contracts?.hotsweep
        ? chalk.green("✓")
        : chalk.yellow("⚠");
      console.log(`  ${hasContract} ${chain.name} (${chain.chainId})`);
    }

    console.log("");
    console.log(`Wallets: ${chalk.green(enabledWallets.length)} enabled`);
    for (const [label, wallet] of enabledWallets) {
      console.log(`  • ${label}: ${chalk.dim(wallet.address)}`);
    }

    console.log("");

    // Check for warnings
    const warnings: string[] = [];

    for (const [, chain] of Object.entries(config.chains)) {
      if (chain.enabled && (!chain.contracts || !chain.contracts.hotsweep)) {
        warnings.push(`Chain ${chain.name} has no HotSweep contract deployed`);
      }
    }

    if (warnings.length > 0) {
      console.log(chalk.yellow("Warnings:"));
      for (const warning of warnings) {
        console.log(chalk.yellow(`  ⚠ ${warning}`));
      }
      console.log("");
    }
  } catch (error) {
    spinner.fail("Initialization failed");
    console.error(
      chalk.red(`\n${error instanceof Error ? error.message : String(error)}\n`)
    );
    process.exit(1);
  }
}
