import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import AccountPicker from "./AccountPicker";
import type { AccountConfig } from "./accounts";

const accounts: AccountConfig[] = [
  { uid: "household-a", email: "a@example.com", label: "世帯A", configured: true },
  { uid: "household-b", email: "b@example.com", label: "世帯B", configured: true },
  { uid: "pending", email: "", label: "世帯C", configured: false },
];

describe("AccountPicker", () => {
  it("shows configured and pending households and reports selection", async () => {
    const user = userEvent.setup();
    const onSelect = vi.fn();
    render(
      <AccountPicker
        accounts={accounts}
        selectedUid="household-a"
        onSelect={onSelect}
      />,
    );

    expect(screen.getByRole("button", { name: "世帯A" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "世帯C（準備中）" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "世帯B" }));
    expect(onSelect).toHaveBeenCalledWith("household-b");
  });

  it("requests a password for an unremembered household switch", async () => {
    const user = userEvent.setup();
    const onSwitchAccount = vi.fn(async () => undefined);
    render(
      <AccountPicker
        accounts={accounts}
        selectedUid="household-a"
        currentUid="household-a"
        rememberedAccountUids={[]}
        onSelect={() => undefined}
        onSwitchAccount={onSwitchAccount}
      />,
    );

    await user.click(screen.getByRole("button", { name: "世帯B" }));
    await user.type(screen.getByLabelText("世帯Bの合言葉"), "switch-pass");
    await user.click(screen.getByRole("button", { name: "世帯Bへ切り替える" }));

    expect(onSwitchAccount).toHaveBeenCalledWith("household-b", "switch-pass");
  });

  it("does not ask for a password for a remembered household and can forget it", async () => {
    const user = userEvent.setup();
    const onSwitchAccount = vi.fn(async () => undefined);
    const onForget = vi.fn();
    render(
      <AccountPicker
        accounts={accounts}
        selectedUid="household-a"
        currentUid="household-a"
        rememberedAccountUids={["household-b"]}
        onSelect={() => undefined}
        onSwitchAccount={onSwitchAccount}
        onForgetRememberedAccount={onForget}
      />,
    );

    await user.click(screen.getByRole("button", { name: "世帯B" }));
    expect(screen.queryByLabelText("世帯Bの合言葉")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "世帯Bへ切り替える" }));
    expect(onSwitchAccount).toHaveBeenCalledWith("household-b", undefined);

    await user.click(screen.getByRole("button", { name: "世帯Bの記憶を削除" }));
    expect(onForget).toHaveBeenCalledWith("household-b");
  });
});