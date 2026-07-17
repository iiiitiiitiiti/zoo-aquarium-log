import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import AuthGate, { type AuthClient } from "./AuthGate";
import type { AccountConfig } from "./accounts";
import { REMEMBERED_ACCOUNTS_STORAGE_KEY } from "./accounts";

const accounts: AccountConfig[] = [
  { uid: "household-a", email: "a@example.com", label: "世帯A", configured: true },
  { uid: "household-b", email: "b@example.com", label: "世帯B", configured: true },
];

class FakeAuthClient implements AuthClient {
  private listener: ((uid: string | null) => void) | undefined;
  signInCalls: Array<{ email: string; password: string; expectedUid: string }> = [];
  signInError: Error | undefined;
  signInPromise: Promise<void> | undefined;

  onAuthStateChanged(listener: (uid: string | null) => void) {
    this.listener = listener;
    return () => {
      this.listener = undefined;
    };
  }

  emit(uid: string | null) {
    this.listener?.(uid);
  }

  async signIn(email: string, password: string, expectedUid: string) {
    this.signInCalls.push({ email, password, expectedUid });
    if (this.signInError) throw this.signInError;
    await this.signInPromise;
  }

  async signOut() {}
}

describe("AuthGate multi-account behavior", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("keeps the current app visible during a transient null while switching", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    let release: () => void = () => undefined;
    client.signInPromise = new Promise<void>((resolve) => {
      release = resolve;
    });
    render(
      <AuthGate client={client} accounts={accounts}>
        {(controls) => (
          <>
            <p>施設一覧: {controls.uid}</p>
            <button onClick={() => void controls.onSwitchAccount("household-b", "switch-pass")}>世帯Bへ切替</button>
          </>
        )}
      </AuthGate>,
    );
    act(() => client.emit("household-a"));

    await user.click(screen.getByRole("button", { name: "世帯Bへ切替" }));
    expect(client.signInCalls).toEqual([{
      email: "b@example.com",
      password: "switch-pass",
      expectedUid: "household-b",
    }]);

    act(() => client.emit(null));
    expect(screen.getByText("施設一覧: household-a")).toBeInTheDocument();
    expect(screen.queryByLabelText("合言葉")).not.toBeInTheDocument();

    await act(async () => {
      release();
      await client.signInPromise;
    });
  });

  it("uses a remembered password when switching to another configured household", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    window.localStorage.setItem(
      REMEMBERED_ACCOUNTS_STORAGE_KEY,
      JSON.stringify({ "household-b": "remembered-pass" }),
    );
    render(
      <AuthGate client={client} accounts={accounts}>
        {(controls) => (
          <button onClick={() => void controls.onSwitchAccount("household-b")}>
            世帯Bへ切替
          </button>
        )}
      </AuthGate>,
    );
    act(() => client.emit("household-a"));

    await user.click(screen.getByRole("button", { name: "世帯Bへ切替" }));
    expect(client.signInCalls).toEqual([{
      email: "b@example.com",
      password: "remembered-pass",
      expectedUid: "household-b",
    }]);
  });

  it("keeps the current household and reports a failed switch", async () => {
    const user = userEvent.setup();
    const client = new FakeAuthClient();
    client.signInError = new Error("wrong-password");
    render(
      <AuthGate client={client} accounts={accounts}>
        {(controls) => (
          <>
            <p>現在: {controls.uid}</p>
            {controls.switchError && <p role="alert">{controls.switchError}</p>}
            <button onClick={() => void controls.onSwitchAccount("household-b", "wrong")}>
              世帯Bへ切替
            </button>
          </>
        )}
      </AuthGate>,
    );
    act(() => client.emit("household-a"));

    await user.click(screen.getByRole("button", { name: "世帯Bへ切替" }));
    expect(screen.getByText("現在: household-a")).toBeInTheDocument();
    expect(await screen.findByText("世帯を切り替えられませんでした。合言葉を確認してください")).toBeInTheDocument();
  });
});