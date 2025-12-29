/**
 * Chain client factory for multi-chain support
 */
import {
  createPublicClient,
  http,
  webSocket,
  type PublicClient,
  type WalletClient,
  type Chain,
  type WebSocketTransport,
} from "viem";
import type {
  ChainConfig,
  CAIP2ChainId,
  HotSweepConfig,
} from "@hotsweep/types";
import { HotSweepError, ErrorCodes } from "@hotsweep/types";
import { LRUCache } from "lru-cache";
import { toCaip2ChainId } from "../config";

// ============================================================================
// Client Cache
// ============================================================================

const publicClientCache = new LRUCache<string, PublicClient>({
  max: 50,
  ttl: 1000 * 60 * 30, // 30 minutes
});

const walletClientCache = new LRUCache<string, WalletClient>({
  max: 20,
  ttl: 1000 * 60 * 30, // 30 minutes
});

// ============================================================================
// Chain Definition Builder
// ============================================================================

/**
 * Build a viem Chain definition from ChainConfig
 */
export function buildChainDefinition(
  chainConfig: ChainConfig,
  caip2Id: CAIP2ChainId
): Chain {
  if (chainConfig.namespace !== "eip155" || !chainConfig.chainId) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_UNSUPPORTED,
      message: `Non-EVM chains not supported yet: ${caip2Id}`,
    });
  }

  const rpcUrls: Record<
    string,
    { http: readonly string[]; webSocket?: readonly string[] }
  > = {};

  for (const [key, value] of Object.entries(chainConfig.rpcUrls)) {
    rpcUrls[key] = {
      http: value.http as readonly string[],
      webSocket: value.webSocket as readonly string[],
    };
  }

  const chain: Chain = {
    id: chainConfig.chainId,
    name: chainConfig.name,
    nativeCurrency: chainConfig.nativeCurrency,
    rpcUrls: rpcUrls as Chain["rpcUrls"],
    blockExplorers: chainConfig.blockExplorers as Chain["blockExplorers"],
    contracts: chainConfig.contracts
      ? Object.fromEntries(
          Object.entries(chainConfig.contracts)
            .filter(([, v]) => v)
            .map(([k, v]) => [
              k,
              { address: v!.address, blockCreated: v!.blockCreated },
            ])
        )
      : undefined,
  };

  return chain;
}

// ============================================================================
// Public Client Factory
// ============================================================================

/**
 * Get or create a public client for a chain
 */
export function getPublicClient(
  config: HotSweepConfig,
  chainIdentifier: string | number | CAIP2ChainId
): PublicClient {
  const caip2Id = toCaip2ChainId(config, chainIdentifier);
  if (!caip2Id) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_NOT_FOUND,
      message: `Chain not found: ${chainIdentifier}`,
    });
  }

  const cached = publicClientCache.get(caip2Id);
  if (cached) return cached;

  const chainConfig = config.chains[caip2Id];
  if (!chainConfig) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_NOT_FOUND,
      message: `Chain configuration not found: ${caip2Id}`,
    });
  }

  if (!chainConfig.enabled) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_DISABLED,
      message: `Chain is disabled: ${chainConfig.name}`,
    });
  }

  const chain = buildChainDefinition(chainConfig, caip2Id);
  const rpcUrl = chainConfig.rpcUrls.default.http[0];

  if (!rpcUrl) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_RPC_ERROR,
      message: `No RPC URL configured for chain: ${chainConfig.name}`,
    });
  }

  const client = createPublicClient({
    chain,
    transport: http(rpcUrl),
    batch: {
      multicall: {
        wait: 50,
      },
    },
  });

  publicClientCache.set(caip2Id, client);
  return client;
}

/**
 * Create a public client with WebSocket transport
 */
export function getWebSocketClient(
  config: HotSweepConfig,
  chainIdentifier: string | number | CAIP2ChainId
): PublicClient<WebSocketTransport> {
  const caip2Id = toCaip2ChainId(config, chainIdentifier);
  if (!caip2Id) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_NOT_FOUND,
      message: `Chain not found: ${chainIdentifier}`,
    });
  }

  const chainConfig = config.chains[caip2Id];
  if (!chainConfig) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_NOT_FOUND,
      message: `Chain configuration not found: ${caip2Id}`,
    });
  }

  const wsUrl = chainConfig.rpcUrls.default.webSocket?.[0];
  if (!wsUrl) {
    throw new HotSweepError({
      code: ErrorCodes.CHAIN_RPC_ERROR,
      message: `No WebSocket URL configured for chain: ${chainConfig.name}`,
    });
  }

  const chain = buildChainDefinition(chainConfig, caip2Id);

  return createPublicClient({
    chain,
    transport: webSocket(wsUrl),
  }) as PublicClient<WebSocketTransport>;
}

// ============================================================================
// Multi-Chain Operations
// ============================================================================

/**
 * Get public clients for all enabled chains
 */
export function getAllPublicClients(
  config: HotSweepConfig
): Map<CAIP2ChainId, PublicClient> {
  const clients = new Map<CAIP2ChainId, PublicClient>();

  for (const [caip2Id, chainConfig] of Object.entries(config.chains)) {
    if (chainConfig.enabled && chainConfig.namespace === "eip155") {
      try {
        const client = getPublicClient(config, caip2Id as CAIP2ChainId);
        clients.set(caip2Id as CAIP2ChainId, client);
      } catch {
        // Skip chains that fail to initialize
      }
    }
  }

  return clients;
}

/**
 * Clear client cache
 */
export function clearClientCache(): void {
  publicClientCache.clear();
  walletClientCache.clear();
}
