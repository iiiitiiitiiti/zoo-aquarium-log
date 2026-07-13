import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import AuthGate, { type AuthClient } from "./AuthGate";

class FakeAuthClient implements AuthClient {
  private listener: ((signedIn: boolean) => void) | undefined;
  signInCalls: string[] = [];
  signInError: Error | undefined;

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
}

describe("AuthGate", () => {
  it("認証確認中は読込表示を出す", () => {
    render(<AuthGate client={new FakeAuthClient()}><p>施設一覧</p></AuthGate>);

    expect(screen.getByText("記録を読み込んでいます")).toBeInTheDocument();
    expect(screen.queryByText("施設一覧")).not.toBeInTheDocument();
  });

  it("未ログインなら合言葉でサインインできる", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    render(<AuthGate client={client}><p>施設一覧</p></AuthGate>);
    client.emit(false);

    const password = await screen.findByLabelText("合言葉");
    await user.type(password, "family-pass");
    await user.click(screen.getByRole("button", { name: "ログを開く" }));

    expect(client.signInCalls).toEqual(["family-pass"]);
  });

  it("空の合言葉は送信しない", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    render(<AuthGate client={client}><p>施設一覧</p></AuthGate>);
    client.emit(false);

    await user.click(await screen.findByRole("button", { name: "ログを開く" }));

    expect(client.signInCalls).toEqual([]);
    expect(screen.getByText("合言葉を入力してください")).toBeInTheDocument();
  });

  it("認証失敗時は再入力方法を表示する", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    client.signInError = new Error("wrong-password");
    render(<AuthGate client={client}><p>施設一覧</p></AuthGate>);
    client.emit(false);

    await user.type(await screen.findByLabelText("合言葉"), "wrong-pass");
    await user.click(screen.getByRole("button", { name: "ログを開く" }));

    expect(await screen.findByText("合言葉が違います。もう一度入力してください")).toBeInTheDocument();
  });

  it("ログイン済みならアプリを表示する", async () => {
    const client = new FakeAuthClient();
    render(<AuthGate client={client}><p>施設一覧</p></AuthGate>);
    client.emit(true);

    expect(await screen.findByText("施設一覧")).toBeInTheDocument();
  });
});
