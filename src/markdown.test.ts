import { describe, expect, it } from "vitest";
import { renderMarkdown } from "./markdown";

describe("renderMarkdown", () => {
  it("renders common markdown and removes unsafe HTML", () => {
    const html = renderMarkdown("# 見出し\n\n- **重要**\n- [公式](https://example.com)\n\n<script>alert(1)</script>");
    expect(html).toContain("<h1>見出し</h1>");
    expect(html).toContain("<strong>重要</strong>");
    expect(html).toContain('href="https://example.com"');
    expect(html).not.toContain("script");
  });

  it("keeps Japanese, emoji, and line breaks", () => {
    expect(renderMarkdown("ペンギン 🐧\n\n次回も行きたい")).toContain("ペンギン 🐧");
  });
});
