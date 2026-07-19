import { describe, expect, it, vi } from "vitest";
import {
  ANIMATIONS_STORAGE_KEY,
  applyAnimationsEnabled,
  persistAnimationsEnabled,
  readAnimationsEnabled,
  type AnimationPreferenceStorage,
} from "./animationPreference";

function createStorage(initialValue: string | null = null): AnimationPreferenceStorage & { value: string | null } {
  const storage = {
    value: initialValue,
    getItem: vi.fn(() => {
      return storage.value;
    }),
    setItem: vi.fn((_key: string, value: string) => {
      storage.value = value;
    }),
  };
  return storage;
}

describe("animation preference", () => {
  it("defaults to enabled when no preference is stored", () => {
    expect(readAnimationsEnabled(createStorage())).toBe(true);
  });

  it("only treats an explicit false value as disabled", () => {
    expect(readAnimationsEnabled(createStorage("false"))).toBe(false);
    expect(readAnimationsEnabled(createStorage("invalid"))).toBe(true);
  });

  it("persists the user's choice", () => {
    const storage = createStorage();
    persistAnimationsEnabled(false, storage);
    expect(storage.setItem).toHaveBeenCalledWith(ANIMATIONS_STORAGE_KEY, "false");
    expect(readAnimationsEnabled(storage)).toBe(false);
  });

  it("keeps the session usable when storage throws", () => {
    const storage: AnimationPreferenceStorage = {
      getItem: () => { throw new Error("blocked"); },
      setItem: () => { throw new Error("blocked"); },
    };
    expect(readAnimationsEnabled(storage)).toBe(true);
    expect(() => persistAnimationsEnabled(false, storage)).not.toThrow();
  });

  it("reflects the preference on the document", () => {
    applyAnimationsEnabled(false);
    expect(document.documentElement).toHaveAttribute("data-animations", "off");
    applyAnimationsEnabled(true);
    expect(document.documentElement).toHaveAttribute("data-animations", "on");
  });
});
