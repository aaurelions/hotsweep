/**
 * Transfer strategy detection and selection
 */
import { type Address, type PublicClient } from "viem";
import type { SweepStrategy, TokenConfig } from "@hotsweep/types";
import { NATIVE_TOKEN_ADDRESS } from "@hotsweep/types";

// ============================================================================
// Strategy Detection ABIs
// ============================================================================

const EIP2612_ABI = [
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
      { name: "value", type: "uint256" },
      { name: "deadline", type: "uint256" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    name: "permit",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "nonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "DOMAIN_SEPARATOR",
    outputs: [{ name: "", type: "bytes32" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const EIP3009_ABI = [
  {
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "value", type: "uint256" },
      { name: "validAfter", type: "uint256" },
      { name: "validBefore", type: "uint256" },
      { name: "nonce", type: "bytes32" },
      { name: "v", type: "uint8" },
      { name: "r", type: "bytes32" },
      { name: "s", type: "bytes32" },
    ],
    name: "transferWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "authorizer", type: "address" },
      { name: "nonce", type: "bytes32" },
    ],
    name: "authorizationState",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

// ============================================================================
// Strategy Cache
// ============================================================================

const strategyCache = new Map<string, SweepStrategy>();

function getCacheKey(token: Address, chainId: number): string {
  return `${chainId}:${token.toLowerCase()}`;
}

// ============================================================================
// Strategy Detection
// ============================================================================

/**
 * Detect the best available strategy for a token
 */
export async function detectStrategy(
  client: PublicClient,
  tokenAddress: Address,
  tokenConfig?: TokenConfig
): Promise<SweepStrategy> {
  // Native token - always legacy
  if (tokenAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()) {
    return "legacy";
  }

  // Check token config for forced strategy
  if (tokenConfig?.strategy && tokenConfig.strategy !== "auto") {
    return tokenConfig.strategy;
  }

  const chainId = await client.getChainId();
  const cacheKey = getCacheKey(tokenAddress, chainId);

  // Check cache
  const cached = strategyCache.get(cacheKey);
  if (cached) return cached;

  // Detect supported standards
  const [supportsEIP3009, supportsEIP2612] = await Promise.all([
    checkEIP3009Support(client, tokenAddress),
    checkEIP2612Support(client, tokenAddress),
  ]);

  // Priority: EIP-3009 > EIP-2612 > Legacy
  // (EIP-7702 requires user opt-in and is handled separately)
  let strategy: SweepStrategy;

  if (supportsEIP3009) {
    strategy = "eip3009";
  } else if (supportsEIP2612) {
    strategy = "eip2612";
  } else {
    strategy = "legacy";
  }

  strategyCache.set(cacheKey, strategy);
  return strategy;
}

/**
 * Check if token supports EIP-2612 (permit)
 */
async function checkEIP2612Support(
  client: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    // Check for DOMAIN_SEPARATOR and nonces functions
    const [domainSeparator] = await Promise.all([
      client
        .readContract({
          address: tokenAddress,
          abi: EIP2612_ABI,
          functionName: "DOMAIN_SEPARATOR",
        })
        .catch(() => null),
    ]);

    return domainSeparator !== null;
  } catch {
    return false;
  }
}

/**
 * Check if token supports EIP-3009 (transferWithAuthorization)
 */
async function checkEIP3009Support(
  client: PublicClient,
  tokenAddress: Address
): Promise<boolean> {
  try {
    // Try to get authorization state (will fail if not supported)
    await client.readContract({
      address: tokenAddress,
      abi: EIP3009_ABI,
      functionName: "authorizationState",
      args: [
        tokenAddress,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
      ],
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Get strategy display name
 */
export function getStrategyName(strategy: SweepStrategy): string {
  switch (strategy) {
    case "eip7702":
      return "EIP-7702 (Code Delegation)";
    case "eip2612":
      return "EIP-2612 (Permit)";
    case "eip3009":
      return "EIP-3009 (TransferWithAuthorization)";
    case "legacy":
      return "Legacy (Standard Transfer)";
    case "auto":
      return "Auto (Best Available)";
  }
}

/**
 * Get estimated gas savings for a strategy
 */
export function getStrategySavings(strategy: SweepStrategy): number {
  switch (strategy) {
    case "eip7702":
      return 0.9; // 90% savings
    case "eip2612":
      return 0.6; // 60% savings
    case "eip3009":
      return 0.6; // 60% savings
    case "legacy":
      return 0; // No savings
    case "auto":
      return 0.6; // Average estimate
  }
}

/**
 * Clear strategy cache
 */
export function clearStrategyCache(): void {
  strategyCache.clear();
}
