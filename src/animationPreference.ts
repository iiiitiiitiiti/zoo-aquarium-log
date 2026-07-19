export const ANIMATIONS_STORAGE_KEY = "zoo-aquarium-log:animations-enabled:v1";

export interface AnimationPreferenceStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function getDefaultStorage(): AnimationPreferenceStorage | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readAnimationsEnabled(
  storage: AnimationPreferenceStorage | null = getDefaultStorage(),
) {
  if (!storage) return true;

  try {
    return storage.getItem(ANIMATIONS_STORAGE_KEY) !== "false";
  } catch {
    return true;
  }
}

export function persistAnimationsEnabled(
  enabled: boolean,
  storage: AnimationPreferenceStorage | null = getDefaultStorage(),
) {
  if (!storage) return;

  try {
    storage.setItem(ANIMATIONS_STORAGE_KEY, String(enabled));
  } catch {
    // localStorage unavailable or blocked: the setting still applies for this session.
  }
}

export function applyAnimationsEnabled(enabled: boolean) {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.animations = enabled ? "on" : "off";
}
