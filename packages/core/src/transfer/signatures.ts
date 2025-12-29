/**
 * EIP-2612 and EIP-3009 signature generation
 */
import {
  type Address,
  type Hex,
  type PublicClient,
  type LocalAccount,
  maxUint256,
} from "viem";
import type { PermitData, AuthorizationData } from "@hotsweep/types";

// ============================================================================
// EIP-2612 Permit Signature
// ============================================================================

/**
 * Sign an EIP-2612 permit
 */
export async function signPermit(
  account: LocalAccount,
  client: PublicClient,
  params: {
    tokenAddress: Address;
    tokenName: string;
    tokenVersion?: string;
    spender: Address;
    value: bigint;
    nonce: bigint;
    deadline?: bigint;
  }
): Promise<PermitData> {
  const chainId = await client.getChainId();
  const deadline = params.deadline ?? maxUint256;

  const domain = {
    name: params.tokenName,
    version: params.tokenVersion ?? "1",
    chainId: BigInt(chainId),
    verifyingContract: params.tokenAddress,
  };

  const types = {
    Permit: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "nonce", type: "uint256" },
      { name: "deadline", type: "uint256" },
    ],
  };

  const message = {
    owner: account.address,
    spender: params.spender,
    value: params.value,
    nonce: params.nonce,
    deadline,
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "Permit",
    message,
  });

  // Parse signature components
  const { r, s, v } = parseSignature(signature);

  return {
    owner: account.address,
    spender: params.spender,
    value: params.value,
    deadline,
    v,
    r,
    s,
  };
}

// ============================================================================
// EIP-3009 Authorization Signature
// ============================================================================

/**
 * Generate a random nonce for EIP-3009
 */
export function generateAuthorizationNonce(): Hex {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return `0x${Buffer.from(bytes).toString("hex")}` as Hex;
}

/**
 * Sign an EIP-3009 transferWithAuthorization
 */
export async function signTransferWithAuthorization(
  account: LocalAccount,
  client: PublicClient,
  params: {
    tokenAddress: Address;
    tokenName: string;
    tokenVersion?: string;
    to: Address;
    value: bigint;
    validAfter?: bigint;
    validBefore?: bigint;
    nonce?: Hex;
  }
): Promise<AuthorizationData> {
  const chainId = await client.getChainId();
  const validAfter = params.validAfter ?? 0n;
  const validBefore = params.validBefore ?? maxUint256;
  const nonce = params.nonce ?? generateAuthorizationNonce();

  const domain = {
    name: params.tokenName,
    version: params.tokenVersion ?? "2",
    chainId: BigInt(chainId),
    verifyingContract: params.tokenAddress,
  };

  const types = {
    TransferWithAuthorization: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
    ],
  };

  const message = {
    from: account.address,
    to: params.to,
    value: params.value,
    validAfter,
    validBefore,
    nonce,
  };

  const signature = await account.signTypedData({
    domain,
    types,
    primaryType: "TransferWithAuthorization",
    message,
  });

  const { r, s, v } = parseSignature(signature);

  return {
    from: account.address,
    to: params.to,
    value: params.value,
    validAfter,
    validBefore,
    nonce,
    v,
    r,
    s,
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse an Ethereum signature into r, s, v components
 */
function parseSignature(signature: Hex): { r: Hex; s: Hex; v: number } {
  const sig = signature.slice(2);
  const r = `0x${sig.slice(0, 64)}` as Hex;
  const s = `0x${sig.slice(64, 128)}` as Hex;
  const v = parseInt(sig.slice(128, 130), 16);

  return { r, s, v };
}
