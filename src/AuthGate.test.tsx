import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AuthGate, { type AuthClient } from "./AuthGate";

class FakeAuthClient implements AuthClient {
  private listener: ((signedIn: boolean) => void) | undefined;
  signInCalls: string[] = [];
  signInError: Error | undefined;
  signOutCalls = 0;
  signOutError: Error | undefined;
  signOutPromise: Promise<void> | undefined;

  onAuthStateChanged(listener: (signedIn: boolean) => void) {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  emit(signedIn: boolean) {
    this.listener?.(signedIn);
  }

  async signIn(password: string) {
    this.signInCalls.push(password);
    if (this.signInError) throw this.signInError;
  }

  async signOut() {
    this.signOutCalls += 1;
    if (this.signOutError) throw this.signOutError;
    await this.signOutPromise;
  }
}

describe("AuthGate", () => {
  it("認証確認中は読込表示を出す", () => {
    render(<AuthGate client={new FakeAuthClient()}>{() => <p>施設一覧</p>}</AuthGate>);

    expect(screen.getByText("記録を読み込んでいます")).toBeInTheDocument();
    expect(screen.queryByText("施設一覧")).not.toBeInTheDocument();
  });

  it("未ログインなら合言葉でサインインできる", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    render(<AuthGate client={client}>{() => <p>施設一覧</p>}</AuthGate>);
    client.emit(false);

    const password = await screen.findByLabelText("合言葉");
    await user.type(password, "family-pass");
    await user.click(screen.getByRole("button", { name: "ログを開く" }));

    expect(client.signInCalls).toEqual(["family-pass"]);
  });

  it("空の合言葉は送信しない", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    render(<AuthGate client={client}>{() => <p>施設一覧</p>}</AuthGate>);
    client.emit(false);

    await user.click(await screen.findByRole("button", { name: "ログを開く" }));

    expect(client.signInCalls).toEqual([]);
    expect(screen.getByText("合言葉を入力してください")).toBeInTheDocument();
  });

  it("認証失敗時は再入力方法を表示する", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    client.signInError = new Error("wrong-password");
    render(<AuthGate client={client}>{() => <p>施設一覧</p>}</AuthGate>);
    client.emit(false);

    await user.type(await screen.findByLabelText("合言葉"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "ログを開く" }));

    expect(await screen.findByText("合言葉が違います。もう一度入力してください")).toBeInTheDocument();
  });

  it("ログイン済みならアプリを表示する", async () => {
    const client = new FakeAuthClient();
    render(<AuthGate client={client}>{() => <p>施設一覧</p>}</AuthGate>);
    client.emit(true);

    expect(await screen.findByText("施設一覧")).toBeInTheDocument();
  });

  it("ログアウトを実行して未ログイン画面へ戻る", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    render(
      <AuthGate client={client}>
        {({ onSignOut }) => <button onClick={onSignOut}>ログアウト</button>}
      </AuthGate>,
    );
    client.emit(true);

    await user.click(await screen.findByRole("button", { name: "ログアウト" }));
    expect(client.signOutCalls).toBe(1);

    client.emit(false);
    expect(await screen.findByLabelText("合言葉")).toBeInTheDocument();
  });

  it("ログアウト中はボタンを無効にする", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    client.signOutPromise = new Promise<void>(() => undefined);
    render(
      <AuthGate client={client}>
        {({ onSignOut, signingOut }) => (
          <button onClick={onSignOut} disabled={signingOut}>ログアウト</button>
        )}
      </AuthGate>,
    );
    client.emit(true);

    await user.click(await screen.findByRole("button", { name: "ログアウト" }));

    expect(screen.getByRole("button", { name: "ログアウト" })).toBeDisabled();
  });

  it("ログアウト失敗時はアプリを表示したままエラーを出す", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    client.signOutError = new Error("network");
    render(
      <AuthGate client={client}>
        {({ onSignOut, signOutError }) => (
          <>
            <p>施設一覧</p>
            <button onClick={onSignOut}>ログアウト</button>
            {signOutError && <p>{signOutError}</p>}
          </>
        )}
      </AuthGate>,
    );
    client.emit(true);

    await user.click(await screen.findByRole("button", { name: "ログアウト" }));

    expect(await screen.findByText("ログアウトできませんでした。もう一度お試しください")).toBeInTheDocument();
    expect(screen.getByText("施設一覧")).toBeInTheDocument();
  });
});
