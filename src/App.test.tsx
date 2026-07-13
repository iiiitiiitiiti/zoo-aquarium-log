import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "./App";
describe("App",()=>{
 it("shows, searches and filters facilities",async()=>{
  const user=userEvent.setup(); render(<App />);
  expect(screen.getByText("20施設を掲載")).toBeInTheDocument();
  await user.type(screen.getByRole("searchbox"),"上野");
  expect(screen.getByText("恩賜上野動物園")).toBeInTheDocument();
  expect(screen.queryByText("海遊館")).not.toBeInTheDocument();
  await user.clear(screen.getByRole("searchbox")); await user.click(screen.getByRole("button",{name:"水族館"}));
  expect(screen.getByText("海遊館")).toBeInTheDocument();
 });
 it("shows guidance when there are no results",async()=>{ const user=userEvent.setup(); render(<App />); await user.type(screen.getByRole("searchbox"),"存在しない"); expect(screen.getByText(/見つかりませんでした/)).toBeInTheDocument(); });
 it("opens official sites in a new tab",()=>{ render(<App />); expect(screen.getAllByRole("link",{name:/公式サイト/})[0]).toHaveAttribute("target","_blank"); });
});
