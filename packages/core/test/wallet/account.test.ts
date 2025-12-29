import { describe, it, expect } from "vitest";
import { hdKeyFromMnemonic } from "../../src/wallet/derivation";
import {
  accountFromPrivateKey,
  accountFromHDKey,
  accountFromMnemonic,
  accountsFromMnemonic,
  getPrivateKey,
  getPrivateKeys,
} from "../../src/wallet/account";
import { privateKeyToAccount } from "viem/accounts";

describe("wallet/account", () => {
  const mnemonic =
    "abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about";
  const hdKey = hdKeyFromMnemonic(mnemonic);

  it("should create account from private key", () => {
    const pk =
      "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";
    const account = accountFromPrivateKey(pk);
    expect(account.address).toBe("0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266");
  });

  it("should create account from HDKey at index 0", () => {
    const account = accountFromHDKey(hdKey, 0);
    // Mnemonic "abandon..." index 0 standard ETH path
    // address: 0x44d... ? No, let's verify.
    // Using viem's mnemonicToAccount to verify
    const expected = accountFromMnemonic(mnemonic, 0);
    expect(account.address).toBe(expected.address);
  });

  it("should create account from HDKey at index 5", () => {
    const account = accountFromHDKey(hdKey, 5);
    const expected = accountFromMnemonic(mnemonic, 5);
    expect(account.address).toBe(expected.address);
    expect(account.address).not.toBe(accountFromHDKey(hdKey, 0).address);
  });

  it("should create account from mnemonic", () => {
    const account = accountFromMnemonic(mnemonic, 0);
    expect(account.address).toBeDefined();
    expect(account.type).toBe("local");
  });

  it("should create multiple accounts from mnemonic", () => {
    const accounts = accountsFromMnemonic(mnemonic, 0, 3);
    expect(accounts).toHaveLength(3);
    expect(accounts[0].address).toBe(accountFromMnemonic(mnemonic, 0).address);
    expect(accounts[1].address).toBe(accountFromMnemonic(mnemonic, 1).address);
    expect(accounts[2].address).toBe(accountFromMnemonic(mnemonic, 2).address);
  });

  it("should get private key from HDKey", () => {
    const pk = getPrivateKey(hdKey, 0);
    const account = privateKeyToAccount(pk);
    const expected = accountFromHDKey(hdKey, 0);
    expect(account.address).toBe(expected.address);
  });

  it("should get multiple private keys", () => {
    const indices = [0, 2, 4];
    const pks = getPrivateKeys(hdKey, indices);

    expect(pks.size).toBe(3);
    expect(pks.get(0)).toBeDefined();
    expect(pks.get(2)).toBeDefined();
    expect(pks.get(4)).toBeDefined();

    const acc0 = privateKeyToAccount(pks.get(0)!);
    expect(acc0.address).toBe(accountFromHDKey(hdKey, 0).address);
  });
});
