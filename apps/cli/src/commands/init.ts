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

      // Load config or create default for test
      spinner.start("Loading configuration...");
      let config: HotSweepConfig;
      const configPath = options.config ?? "./hotsweep.json";

      try {
        config = loadConfig(options.config);
        spinner.succeed(`Configuration loaded (version ${config.version})`);
      } catch (error) {
        if (
          error instanceof HotSweepError &&
          error.code === ErrorCodes.CONFIG_NOT_FOUND &&
          options.test
        ) {
          spinner.info(
            "Configuration not found, creating full test configuration..."
          );

          config = {
            version: "2.0.0",
            chains: {
              "eip155:31337": {
                namespace: "eip155",
                chainId: 31337,
                name: "ethereum",
                aliases: ["eth", "mainnet"],
                coinType: 60,
                enabled: true,
                nativeCurrency: {
                  decimals: 18,
                  name: "Ether",
                  symbol: "ETH",
                },
                rpcUrls: {
                  default: {
                    http: ["http://127.0.0.1:8545"],
                    webSocket: ["ws://127.0.0.1:8545"],
                  },
                },
                contracts: {
                  hotsweep: {
                    address: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
                    blockCreated: 0,
                  },
                },
              },
            },
            wallets: {
              "hot-wallet": {
                address: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb1", // Corrected address length
                chains: ["eip155:31337"],
                enabled: true,
                keySource: {
                  type: "env",
                  variable: "SWEEP_HOT_WALLET_PRIVATE_KEY",
                },
              },
            },
            tokens: {
              "eip155:31337": {
                ETH: {
                  address: "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE",
                  enabled: true,
                },
                LGCY: {
                  address: "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512",
                  enabled: true,
                },
                DLGT: {
                  address: "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0",
                  enabled: true,
                },
                PRMT: {
                  address: "0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9",
                  enabled: true,
                },
                USDC: {
                  address: "0xDc64a140Aa3E981100a9becA4E685f962f0cF6C9",
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
          saveConfig(config, configPath);
          spinner.succeed(`Created configuration: ${configPath}`);

          // Create .env if missing
          const envPath = ".env";
          if (!fs.existsSync(envPath)) {
            const envContent =
              "SWEEP_HOT_WALLET_PRIVATE_KEY=0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d\n";
            fs.writeFileSync(envPath, envContent);
            spinner.succeed("Created .env file with test credentials");
            // Reload env to ensure it's picked up
            loadEnv();
          } else {
            spinner.info(".env file already exists, skipping creation");
          }
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
