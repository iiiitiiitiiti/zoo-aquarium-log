import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
afterEach(() => {
  cleanup();
  // App が URL ハッシュへ画面状態を書くため、テスト間で持ち越さない
  window.history.replaceState(null, "", window.location.pathname);
});
