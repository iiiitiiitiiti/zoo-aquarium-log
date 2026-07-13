import { type FormEvent, type ReactNode, useEffect, useState } from "react";

export interface AuthClient {
  onAuthStateChanged(listener: (signedIn: boolean) => void): () => void;
  signIn(password: string): Promise<void>;
}

export default function AuthGate({
  children,
  client,
}: {
  children: ReactNode;
  client: AuthClient;
}) {
  const [signedIn, setSignedIn] = useState<boolean>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => client.onAuthStateChanged(setSignedIn), [client]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password.trim()) {
      setError("合言葉を入力してください");
      return;
    }

    setError("");
    setSubmitting(true);
    try {
      await client.signIn(password);
    } catch {
      setError("合言葉が違います。もう一度入力してください");
      setPassword("");
    } finally {
      setSubmitting(false);
    }
  }

  if (signedIn === undefined) {
    return (
      <main className="auth-shell auth-loading" aria-live="polite">
        <span className="auth-pulse" aria-hidden="true" />
        <p>記録を読み込んでいます</p>
      </main>
    );
  }

  if (signedIn) return children;

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
        <form onSubmit={handleSubmit} noValidate>
          <label htmlFor="password">合言葉</label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby={error ? "auth-error" : undefined}
          />
          {error && <p id="auth-error" className="auth-error" role="alert">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "確認しています…" : "ログを開く"}
          </button>
        </form>
      </section>
    </main>
  );
}
