/**
 * @hotsweep/auth - SIWE Authentication for HotSweep
 *
 * Sign-In with Ethereum implementation for secure authentication
 */

// Export all SIWE functions
export * from "./siwe";

// ============================================================================
// Auth Module API
// ============================================================================

import type { PublicClient } from "viem";
import {
  generateNonce as _generateNonce,
  verifySiweSignature,
  createMessage as _createMessage,
  createSession,
  getSession,
  deleteSession,
  type SiweSession,
  type NonceResult,
  type CreateMessageParams,
  type SiweVerifyParams,
} from "./siwe";

/**
 * Auth module providing SIWE authentication
 */
export const auth = {
  /**
   * Generate a new nonce for SIWE
   */
  nonce(): NonceResult {
    return _generateNonce();
  },

  /**
   * Create a SIWE message for signing
   */
  createMessage(params: CreateMessageParams): string {
    return _createMessage(params);
  },

  /**
   * Verify a signed SIWE message
   */
  async verify(
    params: SiweVerifyParams,
    client?: PublicClient
  ): Promise<{ session: SiweSession; sessionId?: string }> {
    const session = await verifySiweSignature(params, client);

    if (session.isValid) {
      const sessionId = createSession(session);
      return { session, sessionId };
    }

    return { session };
  },

  /**
   * Get current session info
   */
  me(sessionId: string): SiweSession | null {
    return getSession(sessionId);
  },

  /**
   * Logout (delete session)
   */
  logout(sessionId: string): boolean {
    return deleteSession(sessionId);
  },
};

// ============================================================================
// Types Re-export
// ============================================================================

export type {
  SiweSession,
  SiweSessionData,
  SiweVerifyParams,
  CreateMessageParams,
  NonceResult,
} from "./siwe";
