/**
 * Error types for HotSweep
 */

// ============================================================================
// Error Codes
// ============================================================================

export const ErrorCodes = {
  // Configuration Errors (1xxx)
  CONFIG_NOT_FOUND: "ERR_1001",
  CONFIG_INVALID: "ERR_1002",
  CONFIG_PARSE_ERROR: "ERR_1003",
  CONFIG_PATH_NOT_FOUND: "ERR_1004",
  CONFIG_TYPE_MISMATCH: "ERR_1005",

  // Wallet Errors (2xxx)
  WALLET_NOT_FOUND: "ERR_2001",
  WALLET_DISABLED: "ERR_2002",
  WALLET_KEY_NOT_FOUND: "ERR_2003",
  WALLET_INVALID_ADDRESS: "ERR_2004",
  WALLET_MNEMONIC_INVALID: "ERR_2005",
  WALLET_XPUB_INVALID: "ERR_2006",
  WALLET_XPRIV_INVALID: "ERR_2007",

  // Chain Errors (3xxx)
  CHAIN_NOT_FOUND: "ERR_3001",
  CHAIN_DISABLED: "ERR_3002",
  CHAIN_RPC_ERROR: "ERR_3003",
  CHAIN_UNSUPPORTED: "ERR_3004",

  // Token Errors (4xxx)
  TOKEN_NOT_FOUND: "ERR_4001",
  TOKEN_DISABLED: "ERR_4002",
  TOKEN_INVALID_ADDRESS: "ERR_4003",

  // Transfer Errors (5xxx)
  TRANSFER_INSUFFICIENT_BALANCE: "ERR_5001",
  TRANSFER_INSUFFICIENT_GAS: "ERR_5002",
  TRANSFER_FAILED: "ERR_5003",
  TRANSFER_SIMULATION_FAILED: "ERR_5004",
  TRANSFER_NONCE_ERROR: "ERR_5005",
  TRANSFER_GAS_ESTIMATION_FAILED: "ERR_5006",

  // Strategy Errors (6xxx)
  STRATEGY_UNSUPPORTED: "ERR_6001",
  STRATEGY_PERMIT_FAILED: "ERR_6002",
  STRATEGY_AUTH_FAILED: "ERR_6003",
  STRATEGY_SIGNATURE_FAILED: "ERR_6004",

  // Contract Errors (7xxx)
  CONTRACT_NOT_DEPLOYED: "ERR_7001",
  CONTRACT_CALL_FAILED: "ERR_7002",
  CONTRACT_DEPLOY_FAILED: "ERR_7003",

  // Balance Errors (8xxx)
  BALANCE_QUERY_FAILED: "ERR_8001",
  BALANCE_MULTICALL_FAILED: "ERR_8002",

  // Address Errors (9xxx)
  ADDRESS_INVALID: "ERR_9001",
  ADDRESS_RANGE_INVALID: "ERR_9002",
  ADDRESS_INDEX_OUT_OF_RANGE: "ERR_9003",
  ADDRESS_LABEL_NOT_FOUND: "ERR_9004",

  // General Errors (0xxx)
  INTERNAL_ERROR: "ERR_0001",
  VALIDATION_ERROR: "ERR_0002",
  NOT_IMPLEMENTED: "ERR_0003",
  RATE_LIMITED: "ERR_0004",
  TIMEOUT: "ERR_0005",
} as const;

export type ErrorCode = (typeof ErrorCodes)[keyof typeof ErrorCodes];

// ============================================================================
// Error Details Interface
// ============================================================================

export interface HotSweepErrorDetails {
  code: ErrorCode;
  message: string;
  context?: Record<string, unknown>;
  cause?: Error;
}

// ============================================================================
// Error Class
// ============================================================================

export class HotSweepError extends Error {
  readonly code: ErrorCode;
  readonly context?: Record<string, unknown>;
  readonly cause?: Error;

  constructor(details: HotSweepErrorDetails) {
    super(details.message);
    this.name = "HotSweepError";
    this.code = details.code;
    this.context = details.context;
    this.cause = details.cause;

    // Maintains proper stack trace in V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, HotSweepError);
    }
  }

  toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      code: this.code,
      message: this.message,
      context: this.context,
      stack: this.stack,
    };
  }
}

// ============================================================================
// Type Guards
// ============================================================================

export function isHotSweepError(error: unknown): error is HotSweepError {
  return error instanceof HotSweepError;
}
