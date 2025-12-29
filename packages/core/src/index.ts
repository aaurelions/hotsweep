/**
 * @hotsweep/core - Core SDK for HotSweep HD wallet operations
 *
 * Enterprise-Grade Cryptocurrency Sweep System
 * Built on HD Wallets (BIP32/44) with Multi-Strategy Gas Optimization
 */

// ============================================================================
// Module Exports
// ============================================================================

// Wallet operations
export * as wallet from "./wallet";
export {
  generateMnemonic,
  validateMnemonic,
  mnemonicToSeed,
  hdKeyFromMnemonic,
  hdKeyFromExtendedKey,
  deriveAddress,
  deriveAddresses,
  getExtendedPublicKey,
  getExtendedPrivateKey,
  accountFromPrivateKey,
  accountFromMnemonic,
  accountFromHDKey,
  getPrivateKey,
  getPrivateKeys,
  ETH_COIN_TYPE,
  BTC_COIN_TYPE,
  DEFAULT_ETH_PATH,
} from "./wallet";

// Address operations
export * as address from "./address";
export {
  generateAddresses,
  generateAddress,
  generateAddressRange,
  parseAddressSpec,
  parseRange,
  resolveToIndices,
  resolveToAddress,
  resolveToAddresses,
  type AddressGeneratorContext,
} from "./address";

// Config operations
export * as config from "./config";
export {
  loadConfig,
  loadConfigFromPath,
  saveConfig,
  findConfigPath,
  loadEnv,
  getEnv,
  requireEnv,
  validateConfig,
  validateConfigDetailed,
  getChainConfig,
  getWalletConfig,
  getTokenConfig,
  toCaip2ChainId,
  getByPath,
  setByPath,
  deleteByPath,
  hasPath,
  inferType,
} from "./config";

// Chain operations
export * as chain from "./chain";
export {
  getPublicClient,
  getWebSocketClient,
  getAllPublicClients,
  buildChainDefinition,
  clearClientCache,
} from "./chain";

// Balance operations
export * as balance from "./balance";
export { queryBalances } from "./balance";

// Transfer operations
export * as transfer from "./transfer";
export {
  executeTransfer,
  detectStrategy,
  getStrategyName,
  getStrategySavings,
  signPermit,
  signTransferWithAuthorization,
  generateAuthorizationNonce,
  clearStrategyCache,
  type TransferContext,
} from "./transfer";

// Init operations
export * as init from "./init";
export {
  deployContracts,
  initTestEnvironment,
  checkAnvilConnection,
} from "./init";

// ============================================================================
// SDK Entry Point
// ============================================================================

import type {
  HotSweepConfig,
  AddressOptions,
  AddressResult,
  BalanceOptions,
  BalanceQueryResult,
  TransferOptions,
  TransferResult,
  InitOptions,
  InitCommandResult,
} from "@hotsweep/types";
import { loadConfig, loadEnv } from "./config";
import { generateAddresses, type AddressGeneratorContext } from "./address";
import { queryBalances } from "./balance";
import { executeTransfer, type TransferContext } from "./transfer";
import { initTestEnvironment, checkAnvilConnection } from "./init";

/**
 * HotSweep SDK main class
 */
export class HotSweep {
  private config: HotSweepConfig;
  private addressContext?: AddressGeneratorContext;

  constructor(options: { config?: HotSweepConfig; configPath?: string } = {}) {
    // Load environment variables
    loadEnv();

    // Load configuration
    if (options.config) {
      this.config = options.config;
    } else {
      this.config = loadConfig(options.configPath);
    }

    // Initialize address context from environment
    this.initAddressContext();
  }

  /**
   * Initialize address context from environment variables
   */
  private initAddressContext(): void {
    const xpub = process.env.SWEEP_XPUB;
    const xpriv = process.env.SWEEP_XPRIV;
    const mnemonic = process.env.SWEEP_MNEMONIC;

    if (xpub || xpriv || mnemonic) {
      this.addressContext = {
        xpub,
        xpriv,
        mnemonic,
      };
    }
  }

  /**
   * Set address context for address generation and signing
   */
  setAddressContext(context: AddressGeneratorContext): void {
    this.addressContext = context;
  }

  /**
   * Get current configuration
   */
  getConfig(): HotSweepConfig {
    return this.config;
  }

  /**
   * Generate HD wallet addresses
   */
  address(options: AddressOptions): AddressResult {
    if (!this.addressContext) {
      throw new Error(
        "Address context not initialized. Set SWEEP_XPUB or call setAddressContext()"
      );
    }
    return generateAddresses(this.addressContext, options);
  }

  /**
   * Query balances across chains
   */
  async balance(options: BalanceOptions): Promise<BalanceQueryResult> {
    return queryBalances(this.config, options, this.addressContext);
  }

  /**
   * Execute transfers
   */
  async transfer(options: TransferOptions): Promise<TransferResult> {
    const context: TransferContext = {
      config: this.config,
      addressContext: this.addressContext,
    };
    return executeTransfer(context, options);
  }

  /**
   * Initialize environment (test mode)
   */
  async init(options: InitOptions = {}): Promise<InitCommandResult> {
    try {
      if (options.test) {
        // Check Anvil connection
        const isConnected = await checkAnvilConnection();
        if (!isConnected) {
          return {
            success: false,
            error: {
              code: "ERR_ANVIL_NOT_RUNNING",
              message: "Anvil is not running. Start it with: anvil",
            },
          };
        }

        // Initialize test environment
        await initTestEnvironment(this.config);

        return {
          success: true,
          mode: "test",
          config: {
            path: options.config ?? "./hotsweep.json",
            valid: true,
            version: this.config.version,
            chainsConfigured: Object.keys(this.config.chains).length,
            walletsConfigured: Object.keys(this.config.wallets).length,
            tokensConfigured: Object.values(this.config.tokens).reduce(
              (acc, t) => acc + Object.keys(t).length,
              0
            ),
          },
        };
      }

      // Validate mode
      return {
        success: true,
        mode: "validate",
        config: {
          path: options.config ?? "./hotsweep.json",
          valid: true,
          version: this.config.version,
          chainsConfigured: Object.keys(this.config.chains).length,
          walletsConfigured: Object.keys(this.config.wallets).length,
          tokensConfigured: Object.values(this.config.tokens).reduce(
            (acc, t) => acc + Object.keys(t).length,
            0
          ),
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: "ERR_INIT_FAILED",
          message: error instanceof Error ? error.message : String(error),
        },
      };
    }
  }
}

/**
 * Create a new HotSweep SDK instance
 */
export function createHotSweep(options?: {
  config?: HotSweepConfig;
  configPath?: string;
}): HotSweep {
  return new HotSweep(options);
}
