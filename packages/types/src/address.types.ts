/**
 * Address generation types for HotSweep
 */
import type { Address, Hex } from "viem";
import type { OutputFormat, DerivedAddress } from "./common.types";

// ============================================================================
// Address Generation Options
// ============================================================================

export interface AddressOptionsBase {
  /** BIP44 coin type (60 = Ethereum, 0 = Bitcoin) */
  coinType?: number;
  /** Output format */
  format?: OutputFormat;
  /** Save to file path */
  output?: string;
}

export interface AddressSingleOptions extends AddressOptionsBase {
  /** Single address index */
  index: number;
}

export interface AddressBatchOptions extends AddressOptionsBase {
  /** Start index for batch generation */
  startIndex?: number;
  /** Number of addresses to generate */
  count?: number;
  /** End index (inclusive) */
  endIndex?: number;
}

export type AddressOptions = AddressSingleOptions | AddressBatchOptions;

// ============================================================================
// Address Generation Result
// ============================================================================

export interface GeneratedAddress {
  index: number;
  path: string;
  address: Address;
  publicKey?: Hex;
}

export interface AddressResult {
  addresses: GeneratedAddress[];
  coinType: number;
  xpub?: string;
}

// ============================================================================
// Address Context (for SDK internal use)
// ============================================================================

export interface AddressContext {
  /** Extended public key (xpub) for address generation */
  xpub?: string;
  /** Extended private key (xpriv) for signing */
  xpriv?: string;
  /** BIP39 mnemonic */
  mnemonic?: string;
  /** Default coin type */
  defaultCoinType?: number;
}

// ============================================================================
// Re-export DerivedAddress for convenience
// ============================================================================

export type { DerivedAddress };
