export const REMEMBERED_ACCOUNTS_STORAGE_KEY = "zoo-aquarium-log:remembered-accounts:v1";

export interface AccountConfig {
  uid: string;
  email: string;
  label: string;
  configured: boolean;
}

export const ACCOUNTS: AccountConfig[] = [
  {
    uid: "cbs9TeeZukMBRkHg5iIw9aMXw1W2",
    email: "2190agiatotomijuf@gmail.com",
    label: "家族",
    configured: true,
  },
  {
    uid: "__PENDING_HOUSEHOLD_B__",
    email: "",
    label: "世帯B",
    configured: false,
  },
  {
    uid: "__PENDING_HOUSEHOLD_C__",
    email: "",
    label: "世帯C",
    configured: false,
  },
];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function getDefaultStorage(): StorageLike | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function getConfiguredAccounts(accounts: AccountConfig[] = ACCOUNTS) {
  return accounts.filter((account) => account.configured && account.uid && account.email);
}

export function findAccount(uid: string | null | undefined, accounts: AccountConfig[] = ACCOUNTS) {
  return uid ? accounts.find((account) => account.uid === uid) : undefined;
}

export function readRememberedPasswords(
  storage: StorageLike | null = getDefaultStorage(),
  accounts: AccountConfig[] = ACCOUNTS,
) {
  if (!storage) return {} as Record<string, string>;

  try {
    const parsed: unknown = JSON.parse(storage.getItem(REMEMBERED_ACCOUNTS_STORAGE_KEY) ?? "{}");
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    const configuredUids = new Set(getConfiguredAccounts(accounts).map((account) => account.uid));
    return Object.fromEntries(
      Object.entries(parsed).filter(
        ([uid, password]) =>
          configuredUids.has(uid) && typeof password === "string" && password.length > 0,
      ),
    );
  } catch {
    return {};
  }
}

export function rememberPassword(
  uid: string,
  password: string,
  storage: StorageLike | null = getDefaultStorage(),
  accounts: AccountConfig[] = ACCOUNTS,
) {
  if (!storage || !password) return;

  try {
    const remembered = readRememberedPasswords(storage, accounts);
    remembered[uid] = password;
    storage.setItem(REMEMBERED_ACCOUNTS_STORAGE_KEY, JSON.stringify(remembered));
  } catch {
    // localStorage unavailable or blocked: authentication still succeeds.
  }
}

export function forgetRememberedPassword(
  uid: string,
  storage: StorageLike | null = getDefaultStorage(),
  accounts: AccountConfig[] = ACCOUNTS,
) {
  if (!storage) return;

  try {
    const remembered = readRememberedPasswords(storage, accounts);
    delete remembered[uid];
    storage.setItem(REMEMBERED_ACCOUNTS_STORAGE_KEY, JSON.stringify(remembered));
  } catch {
    // localStorage unavailable or blocked: the current session remains active.
  }
}