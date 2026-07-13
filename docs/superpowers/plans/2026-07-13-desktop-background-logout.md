# PC Background and Logout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PCのコンテンツ幅外へ「深い水辺」の背景を追加し、施設一覧右上から安全にログアウトできるようにする。

**Architecture:** `AuthGate`をrender propへ変更し、認証操作と状態を`App`へ明示的に渡す。Firebaseのサインアウトは`AuthClient`に閉じ込め、背景は`main.tsx`の`site-stage`とCSS疑似要素で描画する。

**Tech Stack:** React 19、TypeScript、Firebase Authentication、Vitest、Testing Library、CSS

## Global Constraints

- アプリ本体の最大幅は480pxを維持する。
- 背景装飾は画面幅481px以上だけで表示する。
- 背景画像と常時アニメーションは追加しない。
- 施設詳細画面にはログアウトボタンを追加しない。
- Firestoreのデータ構造、訪問記録CRUD、施設マスタは変更しない。

---

### Task 1: ログアウト処理と一覧画面の導線

**Files:**
- Modify: `src/AuthGate.test.tsx`
- Modify: `src/AuthGate.tsx`
- Modify: `src/App.test.tsx`
- Modify: `src/App.tsx`
- Modify: `src/firebase.ts`
- Modify: `src/main.tsx`
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: Firebase Authenticationの`signOut(auth): Promise<void>`
- Produces: `AuthClient.signOut(): Promise<void>`、`AuthSessionControls`、`App`の`onSignOut`・`signingOut`・`signOutError` props

- [ ] **Step 1: `AuthGate`の失敗するテストを書く**

`FakeAuthClient`へ`signOutCalls`、`signOutError`、`signOut()`を追加し、childrenを次のrender propで渡す。

```tsx
<AuthGate client={client}>
  {({ onSignOut, signingOut, signOutError }) => (
    <>
      <button onClick={onSignOut} disabled={signingOut}>ログアウト</button>
      {signOutError && <p>{signOutError}</p>}
    </>
  )}
</AuthGate>
```

既存テストのchildrenも同じrender propへ変更し、次の3件を追加する。

```tsx
it("ログアウトを実行して未ログイン画面へ戻る", async () => {
  const user = userEvent.setup();
  const client = new FakeAuthClient();
  render(<AuthGate client={client}>{({ onSignOut }) => <button onClick={onSignOut}>ログアウト</button>}</AuthGate>);
  client.emit(true);
  await user.click(await screen.findByRole("button", { name: "ログアウト" }));
  expect(client.signOutCalls).toBe(1);
  client.emit(false);
  expect(await screen.findByLabelText("合言葉")).toBeInTheDocument();
});

it("ログアウト中はボタンを無効にする", async () => {
  const user = userEvent.setup();
  const client = new FakeAuthClient();
  let release = () => undefined;
  client.signOutPromise = new Promise<void>((resolve) => { release = resolve; });
  render(<AuthGate client={client}>{({ onSignOut, signingOut }) => <button onClick={onSignOut} disabled={signingOut}>ログアウト</button>}</AuthGate>);
  client.emit(true);
  await user.click(await screen.findByRole("button", { name: "ログアウト" }));
  expect(screen.getByRole("button", { name: "ログアウト" })).toBeDisabled();
  release();
});

it("ログアウト失敗時はアプリを表示したままエラーを出す", async () => {
  const user = userEvent.setup();
  const client = new FakeAuthClient();
  client.signOutError = new Error("network");
  render(<AuthGate client={client}>{({ onSignOut, signOutError }) => <><p>施設一覧</p><button onClick={onSignOut}>ログアウト</button>{signOutError && <p>{signOutError}</p>}</>}</AuthGate>);
  client.emit(true);
  await user.click(await screen.findByRole("button", { name: "ログアウト" }));
  expect(await screen.findByText("ログアウトできませんでした。もう一度お試しください")).toBeInTheDocument();
  expect(screen.getByText("施設一覧")).toBeInTheDocument();
});
```

`FakeAuthClient`には次を追加する。

```ts
signOutCalls = 0;
signOutError: Error | undefined;
signOutPromise: Promise<void> | undefined;

async signOut() {
  this.signOutCalls += 1;
  if (this.signOutError) throw this.signOutError;
  await this.signOutPromise;
}
```

- [ ] **Step 2: テストを実行し、未実装理由で失敗することを確認する**

Run: `npm test -- --run src/AuthGate.test.tsx`

Expected: `AuthClient`に`signOut`がなく、childrenが関数として扱われないためFAIL。

- [ ] **Step 3: 最小限の認証実装を書く**

`AuthGate.tsx`に次の型と処理を追加する。

```tsx
export interface AuthClient {
  onAuthStateChanged(listener: (signedIn: boolean) => void): () => void;
  signIn(password: string): Promise<void>;
  signOut(): Promise<void>;
}

export interface AuthSessionControls {
  onSignOut(): Promise<void>;
  signingOut: boolean;
  signOutError: string;
}
```

`children`は`(controls: AuthSessionControls) => ReactNode`とし、次の処理を追加する。ログイン済みの場合は`children({ onSignOut: handleSignOut, signingOut, signOutError })`を返す。

```tsx
const signingOutRef = useRef(false);
const [signingOut, setSigningOut] = useState(false);
const [signOutError, setSignOutError] = useState("");

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
```

`firebase.ts`のクライアントへ次を追加する。

```ts
async signOut() {
  await signOut(auth);
}
```

- [ ] **Step 4: `AuthGate`テストが通ることを確認する**

Run: `npm test -- --run src/AuthGate.test.tsx`

Expected: 追加分を含む全`AuthGate`テストがPASS。

- [ ] **Step 5: `App`の失敗するテストを書く**

`App.test.tsx`へ、`onSignOut`を渡すと施設一覧に右上のログアウトボタンが現れてクリックでき、施設詳細では表示されないテストを追加する。

```tsx
it("施設一覧右上からログアウトでき、詳細画面では表示しない", async () => {
  const user = userEvent.setup();
  const onSignOut = vi.fn(async () => undefined);
  render(<App visitStore={visitStore} onSignOut={onSignOut} />);
  await user.click(screen.getByRole("button", { name: "ログアウト" }));
  expect(onSignOut).toHaveBeenCalledOnce();
  await user.click(screen.getAllByRole("button", { name: "記録を見る" })[0]);
  expect(screen.queryByRole("button", { name: "ログアウト" })).not.toBeInTheDocument();
});
```

- [ ] **Step 6: `App`テストを実行し、props未実装で失敗することを確認する**

Run: `npm test -- --run src/App.test.tsx`

Expected: ログアウトボタンが見つからずFAIL。

- [ ] **Step 7: 一覧ヘッダーのログアウト導線を実装する**

`App`へ次のoptional propsを追加し、`.hero-session`内で`.eyebrow`とボタンを横並びにする。

```tsx
onSignOut?: () => Promise<void>;
signingOut?: boolean;
signOutError?: string;
```

```tsx
<div className="hero-session">
  <p className="eyebrow">FAMILY FIELD NOTE</p>
  {onSignOut && (
    <button className="session-button" type="button" onClick={onSignOut} disabled={signingOut}>
      {signingOut ? "終了中…" : "ログアウト"}
    </button>
  )}
</div>
{signOutError && <p className="session-error" role="alert">{signOutError}</p>}
```

ボタン文言は通常時`ログアウト`、処理中`終了中…`とする。`signOutError`は`role="alert"`でヘッダー内へ表示する。`main.tsx`は次の構成にする。

```tsx
<div className="site-stage">
  <AuthGate client={firebaseAuthClient}>
    {(controls) => <App visitStore={visitStore} {...controls} />}
  </AuthGate>
</div>
```

`AuthSessionControls.onSignOut`と`App.onSignOut`は同名のため、そのまま展開できる。

- [ ] **Step 8: 対象テストと全テストを通す**

Run: `npm test -- --run src/App.test.tsx src/AuthGate.test.tsx`

Expected: 全件PASS。

Run: `npm test -- --run`

Expected: 全テストPASS。

### Task 2: 「深い水辺」のPC背景

**Files:**
- Modify: `src/styles.css`

**Interfaces:**
- Consumes: `main.tsx`の`.site-stage`
- Produces: 481px以上の左右背景と、480px以下の装飾なし表示

- [ ] **Step 1: PC背景をCSSで実装する**

`.site-stage`を中央配置の基準にし、固定疑似要素2枚で青緑の大きな曲面を描く。

```css
.site-stage{position:relative;min-height:100dvh;isolation:isolate}
.site-stage:before,.site-stage:after{content:"";position:fixed;z-index:-1;pointer-events:none;border:1px solid #a8d8d738}
.site-stage:before{inset:-28vh 50% 42vh -18vw;border-radius:0 48% 52% 0;background:#174b52;transform:translateX(-240px) rotate(9deg)}
.site-stage:after{inset:46vh -18vw -30vh 50%;border-radius:52% 0 0 48%;background:#286d72;transform:translateX(240px) rotate(-8deg)}
@media(max-width:480px){.site-stage:before,.site-stage:after{display:none}}
```

既存の`body`背景は暗い深緑を維持し、疑似要素の背面として使う。ログアウトボタンは`.session-button`として透明背景、青緑文字、十分なフォーカス表示を与える。

- [ ] **Step 2: 静的検証を実行する**

Run: `npm run lint`

Expected: エラーなし。

Run: `npm run build`

Expected: ビルド成功。既知のFirebase SDKチャンクサイズ警告のみ許容する。

Run: `git diff --check`

Expected: 出力なし。

- [ ] **Step 3: ブラウザでレスポンシブ表示を確認する**

PC幅1200pxで、アプリ本体が幅480px・中央配置、左右に曲線背景が表示されることを確認する。幅390pxで、背景装飾が非表示、横スクロールなし、ログアウトボタンが右上に収まることを確認する。

- [ ] **Step 4: コミットする**

```bash
git add src/AuthGate.test.tsx src/AuthGate.tsx src/App.test.tsx src/App.tsx src/firebase.ts src/main.tsx src/styles.css
git commit -m "feat: PC背景とログアウト機能を追加"
```

- [ ] **Step 5: GitHub Pagesへ公開する**

featureブランチをpushし、mainへfast-forwardで反映してpushする。GitHub Pages workflow成功後、公開URLでPC背景、ログアウトボタン、合言葉画面への復帰を確認する。
