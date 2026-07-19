import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";
// jsdom は window.scrollTo 未実装（呼ぶと Not implemented エラーが出力される）
window.scrollTo = () => {};

// Node 25 の実験的 Web Storage が Vitest/jsdom の localStorage と衝突し、
// 環境によって clear() などの標準メソッドが欠落するため、テスト用に固定する。
const storageValues = new Map<string, string>();
const testLocalStorage: Storage = {
  get length() {
    return storageValues.size;
  },
  clear() {
    storageValues.clear();
  },
  getItem(key) {
    return storageValues.get(key) ?? null;
  },
  key(index) {
    return [...storageValues.keys()][index] ?? null;
  },
  removeItem(key) {
    storageValues.delete(key);
  },
  setItem(key, value) {
    storageValues.set(String(key), String(value));
  },
};
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: testLocalStorage,
});

afterEach(() => {
  cleanup();
  // App が URL ハッシュへ画面状態を書くため、テスト間で持ち越さない
  window.history.replaceState(null, "", window.location.pathname);
});
