import { type FormEvent, type ReactNode, useEffect, useRef, useState } from "react";
import AccountPicker from "./AccountPicker";
import {
  ACCOUNTS,
  findAccount,
  getConfiguredAccounts,
  readRememberedPasswords,
  rememberPassword,
  forgetRememberedPassword,
  type AccountConfig,
} from "./accounts";

export interface AuthClient {
  onAuthStateChanged(listener: (uid: string | null) => void): () => void;
  signIn(email: string, password: string, expectedUid: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface AuthSessionControls {
  uid: string;
  accounts: AccountConfig[];
  rememberedAccountUids: string[];
  switchTargetUid?: string;
  onSwitchAccount(targetUid: string, password?: string): Promise<void>;
  onForgetRememberedAccount(uid: string): void;
  switching: boolean;
  switchError: string;
  onSignOut(): Promise<void>;
  signingOut: boolean;
  signOutError: string;
}

export default function AuthGate({
  children,
  client,
  accounts = ACCOUNTS,
}: {
  children: (controls: AuthSessionControls) => ReactNode;
  client: AuthClient;
  accounts?: AccountConfig[];
}) {
  const [uid, setUid] = useState<string | null | undefined>();
  const [selectedAccountUid, setSelectedAccountUid] = useState(
    () => getConfiguredAccounts(accounts)[0]?.uid ?? accounts[0]?.uid ?? "",
  );
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [rememberedPasswords, setRememberedPasswords] = useState<Record<string, string>>(() =>
    readRememberedPasswords(undefined, accounts),
  );
  const [switchTargetUid, setSwitchTargetUid] = useState<string>();
  const [switching, setSwitching] = useState(false);
  const [switchError, setSwitchError] = useState("");
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const signingOutRef = useRef(false);
  const switchingRef = useRef(false);
  const lastAuthenticatedUidRef = useRef<string | undefined>(undefined);

  useEffect(() => {
    setRememberedPasswords(readRememberedPasswords(undefined, accounts));
  }, [accounts]);

  useEffect(() => {
    return client.onAuthStateChanged((nextUid) => {
      if (nextUid && !findAccount(nextUid, accounts)?.configured) {
        void client.signOut();
        setUid(null);
        setError("この世帯は利用対象に登録されていません");
        return;
      }

      setUid(nextUid);
      if (nextUid) {
        lastAuthenticatedUidRef.current = nextUid;
        setSelectedAccountUid(nextUid);
      } else if (!switchingRef.current) {
        lastAuthenticatedUidRef.current = undefined;
      }
    });
  }, [client, accounts]);

  useEffect(() => {
    if (uid !== undefined) {
      window.dispatchEvent(new CustomEvent("app:splash-ready"));
    }
  }, [uid]);

  async function signInAccount(account: AccountConfig, nextPassword: string) {
    if (!account.configured || !account.email || !account.uid) {
      setError("この世帯はまだ利用準備中です");
      return;
    }
    if (!nextPassword.trim()) {
      setError("合言葉を入力してください");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await client.signIn(account.email, nextPassword, account.uid);
      rememberPassword(account.uid, nextPassword, undefined, accounts);
      setRememberedPasswords(readRememberedPasswords(undefined, accounts));
      setPassword("");
    } catch {
      setError("合言葉が違います。もう一度入力してください");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const account = findAccount(selectedAccountUid, accounts);
    if (!account) {
      setError("世帯を選択してください");
      return;
    }
    await signInAccount(account, rememberedPasswords[account.uid] ?? password);
  }

  async function handleSwitchAccount(targetUid: string, providedPassword = "") {
    if (switchingRef.current || !uid || targetUid === uid) return;

    const account = findAccount(targetUid, accounts);
    if (!account || !account.configured || !account.email) {
      setSwitchError("この世帯はまだ利用準備中です");
      setSwitchTargetUid(targetUid);
      return;
    }

    const nextPassword = providedPassword || rememberedPasswords[targetUid] || "";
    if (!nextPassword) {
      setSwitchError("この世帯の合言葉を入力してください");
      setSwitchTargetUid(targetUid);
      return;
    }

    switchingRef.current = true;
    setSwitching(true);
    setSwitchTargetUid(targetUid);
    setSwitchError("");
    try {
      await client.signIn(account.email, nextPassword, account.uid);
      rememberPassword(account.uid, nextPassword, undefined, accounts);
      setRememberedPasswords(readRememberedPasswords(undefined, accounts));
      setSwitchTargetUid(undefined);
    } catch {
      setSwitchError("世帯を切り替えられませんでした。合言葉を確認してください");
    } finally {
      switchingRef.current = false;
      setSwitching(false);
    }
  }

  function handleForgetRememberedAccount(accountUid: string) {
    forgetRememberedPassword(accountUid, undefined, accounts);
    setRememberedPasswords(readRememberedPasswords(undefined, accounts));
  }

  async function handleSignOut() {
    if (signingOutRef.current) return;

    signingOutRef.current = true;
    setSigningOut(true);
    setSignOutError("");
    try {
      await client.signOut();
    } catch {
      setSignOutError("ログアウトできませんでした。もう一度お試しください");
    } finally {
      signingOutRef.current = false;
      setSigningOut(false);
    }
  }

  if (uid === undefined) {
    return (
      <main className="auth-shell auth-loading" aria-live="polite">
        <span className="auth-pulse" aria-hidden="true" />
        <p>記録を読み込んでいます</p>
      </main>
    );
  }

  const activeUid = uid ?? lastAuthenticatedUidRef.current;
  if (activeUid && (uid !== null || switching)) {
    return children({
      uid: activeUid,
      accounts,
      rememberedAccountUids: Object.keys(rememberedPasswords),
      switchTargetUid,
      onSwitchAccount: handleSwitchAccount,
      onForgetRememberedAccount: handleForgetRememberedAccount,
      switching,
      switchError,
      onSignOut: handleSignOut,
      signingOut,
      signOutError,
    });
  }

  const selectedAccount = findAccount(selectedAccountUid, accounts);
  return (
    <main className="auth-shell">
      <div className="auth-cover" aria-hidden="true">
        <span className="auth-cover-ring" />
        <span className="auth-cover-dot" />
      </div>
      <section className="auth-panel">
        <p className="eyebrow">FAMILY FIELD NOTE</p>
        <h1>家族のログを<br />開きましょう</h1>
        <p className="auth-copy">家族で決めた合言葉を入力してください。次回からは、そのまま記録を開けます。</p>
        {accounts.length > 1 && (
          <AccountPicker
            accounts={accounts}
            selectedUid={selectedAccountUid}
            onSelect={(nextUid) => {
              setSelectedAccountUid(nextUid);
              setPassword("");
              setError("");
            }}
          />
        )}
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="password">合言葉</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={rememberedPasswords[selectedAccountUid] ? "" : password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={rememberedPasswords[selectedAccountUid] ? "記憶済みの合言葉を使用します" : undefined}
            aria-describedby={error ? "auth-error" : undefined}
          />
          {error && <p id="auth-error" className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting || !selectedAccount?.configured}>
            {submitting ? "確認しています…" : "ログを開く"}
          </button>
        </form>
      </section>
    </main>
  );
}
