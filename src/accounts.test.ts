import { describe, expect, it } from "vitest";
import {
  ACCOUNTS,
  REMEMBERED_ACCOUNTS_STORAGE_KEY,
  getConfiguredAccounts,
  readRememberedPasswords,
  rememberPassword,
  forgetRememberedPassword,
} from "./accounts";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("account configuration", () => {
  it("keeps the current household configured and future households pending", () => {
    expect(ACCOUNTS).toHaveLength(3);
    expect(getConfiguredAccounts()).toHaveLength(1);
    expect(ACCOUNTS.filter((account) => !account.configured)).toHaveLength(2);
  });

  it("remembers and removes a password by account UID", () => {
    const storage = new MemoryStorage();
    const uid = ACCOUNTS[0].uid;

    rememberPassword(uid, "secret", storage);
    expect(storage.getItem(REMEMBERED_ACCOUNTS_STORAGE_KEY)).toContain(uid);
    expect(readRememberedPasswords(storage)).toEqual({ [uid]: "secret" });

    forgetRememberedPassword(uid, storage);
    expect(readRememberedPasswords(storage)).toEqual({});
  });

  it("ignores malformed or empty remembered account data", () => {
    const storage = new MemoryStorage();
    storage.setItem(REMEMBERED_ACCOUNTS_STORAGE_KEY, JSON.stringify({
      [ACCOUNTS[0].uid]: "valid",
      [ACCOUNTS[1].uid]: "pending-is-not-used",
      invalid: 123,
      empty: "",
    }));

    expect(readRememberedPasswords(storage)).toEqual({ [ACCOUNTS[0].uid]: "valid" });
  });

  it("falls back safely when storage is unavailable", () => {
    const unavailableStorage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    };

    expect(readRememberedPasswords(unavailableStorage)).toEqual({});
    expect(() => rememberPassword(ACCOUNTS[0].uid, "secret", unavailableStorage)).not.toThrow();
    expect(() => forgetRememberedPassword(ACCOUNTS[0].uid, unavailableStorage)).not.toThrow();
  });
});
