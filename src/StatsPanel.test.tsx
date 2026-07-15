import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import StatsPanel from "./StatsPanel";
import type { StatsModel } from "./stats";

const stats: StatsModel = {
  overall: { visited: 3, total: 7, percent: 42 },
  byType: [
    { type: "zoo", visited: 2, total: 4 },
    { type: "aquarium", visited: 1, total: 3 },
  ],
  byPref: [
    { pref: "北海道", visited: 2, total: 3 },
    { pref: "東京都", visited: 1, total: 4 },
  ],
  monthly: [
    { month: "2026-01", count: 1 },
    { month: "2026-02", count: 0 },
    { month: "2026-03", count: 2 },
  ],
};

describe("StatsPanel", () => {
  it("shows the overall, type, prefecture, and monthly statistics", () => {
    render(<StatsPanel stats={stats} onBack={() => undefined} />);

    expect(screen.getByRole("heading", { name: "記録の統計" })).toBeInTheDocument();
    expect(screen.getByText("※閉園済みの館は母数から除外しています。")).toBeInTheDocument();
    expect(screen.getByText("42", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("3 / 7 館")).toBeInTheDocument();
    expect(screen.getByText("動物園")).toBeInTheDocument();
    expect(screen.getByText("2 / 4 館")).toBeInTheDocument();
    expect(screen.getByText("北海道")).toBeInTheDocument();
    expect(screen.getByText("2026年1月")).toBeInTheDocument();
    expect(screen.getByText("訪問記録 2件")).toBeInTheDocument();
    expect(screen.getByText("横にスクロールできます")).toBeInTheDocument();
  });

  it("shows an empty state when there are no visits", () => {
    render(<StatsPanel stats={{ ...stats, monthly: [] }} onBack={() => undefined} />);

    expect(screen.getByText("訪問記録がまだありません。")).toBeInTheDocument();
    expect(screen.queryByText("横にスクロールできます")).not.toBeInTheDocument();
  });

  it("returns to the facility list", async () => {
    const user = userEvent.setup();
    const onBack = vi.fn();
    render(<StatsPanel stats={stats} onBack={onBack} />);

    await user.click(screen.getByRole("button", { name: "← 施設一覧" }));
    expect(onBack).toHaveBeenCalledOnce();
  });
});
