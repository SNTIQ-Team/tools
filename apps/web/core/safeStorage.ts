/**
 * Crash-safe localStorage access. Merely touching window.localStorage
 * THROWS a SecurityError when the user blocks site data (Chrome "Block
 * all cookies", some embedded webviews) — and several callers render in
 * the root layout, where an unguarded access white-screens the whole
 * site. Reads return null on any failure, writes/removes fail silent:
 * stored preferences are a convenience, never a requirement.
 */

export function storageGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function storageSet(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* fail silent */
  }
}

export function storageRemove(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    /* fail silent */
  }
}
