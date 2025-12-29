import { describe, it, expect } from "vitest";
import {
  generateNonce,
  verifyNonce,
  consumeNonce,
  createMessage,
  parseMessage,
  verifySiweSignature,
  createSession,
  getSession,
  deleteSession,
  clearSessionsForAddress,
} from "../src/siwe";
import { mnemonicToAccount } from "viem/accounts";

describe("auth/siwe", () => {
  describe("Nonce Management", () => {
    it("should generate a valid nonce", () => {
      const result = generateNonce();
      expect(result.nonce).toBeDefined();
      expect(result.nonce.length).toBeGreaterThan(0);
      expect(result.issuedAt).toBeDefined();
      expect(result.expiresAt).toBeDefined();
    });

    it("should verify a valid nonce", () => {
      const { nonce } = generateNonce();
      expect(verifyNonce(nonce)).toBe(true);
    });

    it("should fail for invalid nonce", () => {
      expect(verifyNonce("invalid")).toBe(false);
    });

    it("should fail to consume an invalid nonce", () => {
      expect(consumeNonce("invalid")).toBe(false);
    });
  });

  describe("Message Creation & Parsing", () => {
    const address = "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266";
    const domain = "example.com";
    const uri = "https://example.com/login";
    const chainId = 1;

    it("should create a SIWE message", () => {
      const message = createMessage({
        address,
        domain,
        uri,
        chainId,
      });
      expect(message).toContain(domain);
      expect(message).toContain(address);
    });

    it("should parse a SIWE message", () => {
      const message = createMessage({
        address,
        domain,
        uri,
        chainId,
      });
      const parsed = parseMessage(message);
      expect(parsed).not.toBeNull();
      expect(parsed?.address).toBe(address);
      expect(parsed?.domain).toBe(domain);
    });

    it("should return null for invalid message parsing", () => {
      // Viem's parseSiweMessage might return an empty object or throw
      const result = parseMessage("invalid message");
      if (result) {
        expect(Object.keys(result).length).toBe(0);
      } else {
        expect(result).toBeNull();
      }
    });
  });

  describe("Signature Verification", () => {
    const mnemonic =
      "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
    const account = mnemonicToAccount(mnemonic);
    const domain = "example.com";
    const uri = "https://example.com/login";
    const chainId = 1;

    it("should verify a valid signature", async () => {
      const { nonce } = generateNonce();
      const message = createMessage({
        address: account.address,
        domain,
        uri,
        chainId,
        nonce,
      });

      const signature = await account.signMessage({ message });
      const session = await verifySiweSignature({
        message,
        signature,
        expectedDomain: domain,
        expectedChainId: chainId,
      });

      expect(session.isValid).toBe(true);
      expect(session.address).toBe(account.address);
    });

    it("should fail for invalid domain", async () => {
      const { nonce } = generateNonce();
      const message = createMessage({
        address: account.address,
        domain,
        uri,
        chainId,
        nonce,
      });

      const signature = await account.signMessage({ message });
      const session = await verifySiweSignature({
        message,
        signature,
        expectedDomain: "wrong.com",
      });

      expect(session.isValid).toBe(false);
    });

    it("should fail for invalid chainId", async () => {
      const { nonce } = generateNonce();
      const message = createMessage({
        address: account.address,
        domain,
        uri,
        chainId,
        nonce,
      });

      const signature = await account.signMessage({ message });
      const session = await verifySiweSignature({
        message,
        signature,
        expectedChainId: 999,
      });

      expect(session.isValid).toBe(false);
    });

    it("should verify a signature with nonce from store", async () => {
      const { nonce } = generateNonce();
      const message = createMessage({
        address: account.address,
        domain,
        uri,
        chainId,
        nonce,
      });

      const signature = await account.signMessage({ message });
      const session = await verifySiweSignature({
        message,
        signature,
      });

      expect(session.isValid).toBe(true);
    });

    it("should handle session with expiration", async () => {
      const expirationTime = new Date(Date.now() + 3600 * 1000);
      const message = createMessage({
        address: account.address,
        domain,
        uri,
        chainId,
        expirationTime,
      });

      const signature = await account.signMessage({ message });
      const session = await verifySiweSignature({
        message,
        signature,
      });

      expect(session.expiresAt).toBeDefined();
      expect(session.expiresAt?.getTime()).toBeCloseTo(
        expirationTime.getTime(),
        -3
      );
    });

    it("should return invalid session for unparseable message", async () => {
      const session = await verifySiweSignature({
        message: "not a message",
        signature: "0x123",
      });
      expect(session.isValid).toBe(false);
      expect(session.address).toBe("0x0");
    });
  });

  describe("Session Management", () => {
    const sessionData: SiweSession = {
      address: "0x1230000000000000000000000000000000000000" as Address,
      chainId: 1,
      isValid: true,
      data: {
        address: "0x1230000000000000000000000000000000000000" as Address,
        chainId: 1,
        domain: "ex.com",
        nonce: "123",
        issuedAt: new Date().toISOString(),
      },
    };

    it("should create and get a session", () => {
      const sessionId = createSession(sessionData);
      const session = getSession(sessionId);
      expect(session).not.toBeNull();
      expect(session?.address).toBe("0x1230000000000000000000000000000000000000");
    });

    it("should return null for expired session", () => {
      const expiredSession: SiweSession = {
        ...sessionData,
        expiresAt: new Date(Date.now() - 1000),
      };
      const sessionId = createSession(expiredSession);
      expect(getSession(sessionId)).toBeNull();
    });

    it("should delete a session", () => {
      const sessionId = createSession(sessionData);
      expect(deleteSession(sessionId)).toBe(true);
      expect(getSession(sessionId)).toBeNull();
    });

    it("should clear sessions for address", () => {
      const uniqueAddr = "0x4560000000000000000000000000000000000000" as Address;
      const sessionDataUnique: SiweSession = {
        ...sessionData,
        address: uniqueAddr,
        data: { ...sessionData.data, address: uniqueAddr },
      };
      createSession(sessionDataUnique);
      createSession(sessionDataUnique);
      const cleared = clearSessionsForAddress(uniqueAddr);
      expect(cleared).toBe(2);
    });
  });
});
