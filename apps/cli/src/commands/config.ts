/**
 * Config command implementation
 */
import chalk from "chalk";
import {
  loadConfig,
  loadEnv,
  saveConfig,
  findConfigPath,
  validateConfigDetailed,
  getByPath,
  setByPath,
  deleteByPath,
  inferType,
} from "@hotsweep/core";
import type { HotSweepConfig } from "@hotsweep/types";

interface ConfigCommandOptions {
  file?: string;
  json?: boolean;
}

/**
 * Display full configuration
 */
export async function configCommand(
  options: ConfigCommandOptions
): Promise<void> {
  try {
    loadEnv();
    const config = loadConfig(options.file);

    console.log("");
    console.log(chalk.bold("HotSweep Configuration"));
    console.log(chalk.dim(`Version: ${config.version}`));
    console.log(
      chalk.dim(
        `File: ${options.file ?? findConfigPath() ?? "./hotsweep.json"}`
      )
    );
    console.log("");

    // Chains summary
    const enabledChains = Object.entries(config.chains).filter(
      ([, c]) => c.enabled
    );
    const disabledChains = Object.entries(config.chains).filter(
      ([, c]) => !c.enabled
    );

    console.log(
      `Chains:    ${chalk.green(enabledChains.length)} enabled` +
        (disabledChains.length > 0
          ? `, ${chalk.dim(disabledChains.length + " disabled")}`
          : "")
    );

    // Wallets summary
    const enabledWallets = Object.entries(config.wallets).filter(
      ([, w]) => w.enabled
    );
    console.log(`Wallets:   ${chalk.green(enabledWallets.length)} enabled`);

    // Tokens summary
    const tokenCount = Object.values(config.tokens).reduce(
      (acc, t) => acc + Object.keys(t).length,
      0
    );
    console.log(`Tokens:    ${chalk.green(tokenCount)}`);

    console.log("");
  } catch (error) {
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Get configuration value
 */
export async function configGetCommand(
  key: string | undefined,
  options: ConfigCommandOptions
): Promise<void> {
  try {
    loadEnv();
    const config = loadConfig(options.file);

    if (!key) {
      // Display full config
      if (options.json) {
        console.log(JSON.stringify(config, null, 2));
      } else {
        await configCommand(options);
      }
      return;
    }

    // Get specific value
    const value = getByPath(config, key);

    if (options.json || typeof value === "object") {
      console.log(JSON.stringify(value, null, 2));
    } else {
      console.log(value);
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

/**
 * Set configuration value
 */
export async function configSetCommand(
  key: string,
  value: string,
  options: ConfigCommandOptions
): Promise<void> {
  try {
    loadEnv();
    const configPath = options.file ?? findConfigPath() ?? "./hotsweep.json";
    const config = loadConfig(configPath);

    // Get old value for display
    let oldValue: unknown;
    try {
      oldValue = getByPath(config, key);
    } catch {
      oldValue = undefined;
    }

    // Infer type and set new value
    const typedValue = inferType(value);
    const newConfig = setByPath(config, key, typedValue);

    // Save
    saveConfig(newConfig, configPath);

    console.log(
      chalk.green("✓ Updated ") +
        chalk.bold(key) +
        (oldValue !== undefined
          ? chalk.dim(
              `: ${JSON.stringify(oldValue)} → ${JSON.stringify(typedValue)}`
            )
          : chalk.dim(`: ${JSON.stringify(typedValue)}`))
    );
  } catch (error) {
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Delete configuration key
 */
export async function configDelCommand(
  key: string,
  options: ConfigCommandOptions
): Promise<void> {
  try {
    loadEnv();
    const configPath = options.file ?? findConfigPath() ?? "./hotsweep.json";
    const config = loadConfig(configPath);

    // Delete key
    const newConfig = deleteByPath(config, key);

    // Save
    saveConfig(newConfig, configPath);

    console.log(chalk.green("✓ Removed ") + chalk.bold(key));
  } catch (error) {
    console.error(
      chalk.red(
        `Error: ${error instanceof Error ? error.message : String(error)}`
      )
    );
    process.exit(1);
  }
}

/**
 * Validate configuration
 */
export async function configValidateCommand(
  options: ConfigCommandOptions
): Promise<void> {
  try {
    loadEnv();
    const configPath = options.file ?? findConfigPath() ?? "./hotsweep.json";
    const config = loadConfig(configPath);

    const result = validateConfigDetailed(config);

    if (result.valid) {
      console.log(chalk.green("✓ Configuration valid"));
      console.log(
        chalk.dim(`  Version: ${(config as HotSweepConfig).version}`)
      );
      console.log(
        chalk.dim(
          `  Chains:  ${Object.keys((config as HotSweepConfig).chains).length}`
        )
      );
      console.log(
        chalk.dim(
          `  Wallets: ${Object.keys((config as HotSweepConfig).wallets).length}`
        )
      );
    } else {
      console.log(chalk.red("✗ Configuration invalid"));
      console.log("");

      for (const error of result.errors) {
        console.log(chalk.red(`  ✗ ${error.path}: ${error.message}`));
      }
    }

    if (result.warnings.length > 0) {
      console.log("");
      console.log(chalk.yellow("Warnings:"));
      for (const warning of result.warnings) {
        console.log(chalk.yellow(`  ⚠ ${warning.path}: ${warning.message}`));
      }
    }

    if (!result.valid) {
      process.exit(1);
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

/**
 * Print config file path
 */
export async function configPathCommand(): Promise<void> {
  loadEnv();
  const path = findConfigPath();

  if (path) {
    console.log(path);
  } else {
    console.log(chalk.dim("No configuration file found"));
    process.exit(1);
  }
}
