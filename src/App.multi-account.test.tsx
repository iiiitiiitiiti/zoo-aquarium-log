import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { AccountConfig } from "./accounts";

const accounts: AccountConfig[] = [
  { uid: "household-a", email: "a@example.com", label: "世帯A", configured: true },
  { uid: "household-b", email: "b@example.com", label: "世帯B", configured: true },
];

describe("App multi-account controls", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", window.location.pathname);
  });

  it("shows a household switcher and delegates a switch", async () => {
    const user = userEvent.setup();
    const onSwitchAccount = vi.fn(async () => undefined);
    render(
      <App
        accounts={accounts}
        currentUid="household-a"
        rememberedAccountUids={[]}
        onSwitchAccount={onSwitchAccount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "世帯B" }));
    await user.type(screen.getByLabelText("世帯Bの合言葉"), "switch-pass");
    await user.click(screen.getByRole("button", { name: "世帯Bへ切り替える" }));

    expect(onSwitchAccount).toHaveBeenCalledWith("household-b", "switch-pass");
  });

  it("keeps the existing App test API without account controls", () => {
    render(<App />);
    expect(screen.queryByRole("region", { name: "世帯を選択" })).not.toBeInTheDocument();
  });
});