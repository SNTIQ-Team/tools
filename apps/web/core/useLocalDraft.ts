'use client';

/**
 * Opt-in local drafts — shared by the form-heavy modules (Lathe,
 * Chamfer). Storage is device-local only (localStorage), strictly
 * opt-in (default OFF), deleted with one click; the modules show an
 * honest note that the draft is stored unencrypted on this device.
 * That keeps the platform's "your data is not sent anywhere" promise
 * intact and stays within §25 TTDSG / GDPR data-minimisation as
 * user-requested functional storage.
 *
 * Everything fails silent (SSR, private mode, QuotaExceeded): a draft
 * is a convenience, never a requirement.
 */

import { useCallback, useEffect, useRef } from 'react';

/** Stored wrapper — lets us reject foreign/outdated payloads on read. */
export interface DraftEnvelope<T> {
  v: 1;
  /** ISO timestamp of the last save — shown in the restore row. */
  savedAt: string;
  data: T;
}

const DEBOUNCE_MS = 800;

const dataKey = (key: string) => `sntiq_draft_${key}`;
const optInKey = (key: string) => `sntiq_draft_${key}_optin`;

/**
 * Read a stored draft envelope. Returns null when absent, unparsable,
 * not a v1 envelope, or on the server — callers additionally validate
 * the module-specific shape of `data` before restoring.
 */
export function readDraft<T>(key: string): DraftEnvelope<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(dataKey(key));
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (
      !parsed || typeof parsed !== 'object' ||
      (parsed as DraftEnvelope<T>).v !== 1 ||
      typeof (parsed as DraftEnvelope<T>).savedAt !== 'string' ||
      typeof (parsed as DraftEnvelope<T>).data !== 'object' ||
      (parsed as DraftEnvelope<T>).data === null
    ) {
      return null;
    }
    return parsed as DraftEnvelope<T>;
  } catch {
    return null;
  }
}

/** Delete the stored draft (the opt-in flag is handled separately). */
export function clearDraft(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(dataKey(key));
  } catch {
    /* fail silent */
  }
}

/** Read the persisted opt-in flag (default OFF). */
export function readDraftOptIn(key: string): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(optInKey(key)) === '1';
  } catch {
    return false;
  }
}

/**
 * Persist the opt-in flag. Turning it OFF deletes the stored draft
 * immediately — opting out must leave nothing behind.
 */
export function writeDraftOptIn(key: string, on: boolean): void {
  if (typeof window === 'undefined') return;
  try {
    if (on) localStorage.setItem(optInKey(key), '1');
    else localStorage.removeItem(optInKey(key));
  } catch {
    /* fail silent */
  }
  if (!on) clearDraft(key);
}

/**
 * Deep-merge a restored draft over the module's current defaults:
 * plain objects merge key-by-key (fields added after the draft was
 * saved keep their defaults), everything else — scalars, arrays,
 * null — is taken from the draft wholesale.
 */
export function mergeDraft<T>(base: T, draft: unknown): T {
  const isPlain = (v: unknown): v is Record<string, unknown> =>
    v !== null && typeof v === 'object' && !Array.isArray(v);
  if (!isPlain(base) || !isPlain(draft)) {
    return (draft === undefined ? base : draft) as T;
  }
  const out: Record<string, unknown> = { ...base };
  for (const [k, v] of Object.entries(draft)) {
    out[k] = k in base ? mergeDraft(base[k], v) : v;
  }
  return out as T;
}

/**
 * Debounced draft autosave. While `enabled`, every change of
 * `currentData` is persisted (~800 ms after the last keystroke) under
 * 'sntiq_draft_<key>'. Callers should pass `enabled = false` while an
 * unrestored draft is still offered, so the stored copy is not
 * overwritten before the user decides.
 */
export function useLocalDraft<T>(key: string, currentData: T, enabled: boolean): void {
  const pending = useRef<{ key: string; data: T } | null>(null);
  const flush = useCallback(() => {
    const snapshot = pending.current;
    pending.current = null;
    // Read the persisted choice again: opting out can precede the next render,
    // or happen in another tab while this page still has a pending timer.
    if (!snapshot || !readDraftOptIn(snapshot.key)) return;
    const envelope: DraftEnvelope<T> = {
      v: 1,
      savedAt: new Date().toISOString(),
      data: snapshot.data,
    };
    try {
      localStorage.setItem(dataKey(snapshot.key), JSON.stringify(envelope));
    } catch {
      /* QuotaExceeded / private mode — fail silent */
    }
  }, []);

  useEffect(() => {
    pending.current = enabled ? { key, data: currentData } : null;
    if (!enabled || typeof window === 'undefined') return;
    const timer = window.setTimeout(flush, DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [key, currentData, enabled, flush]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', flush);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', flush);
      document.removeEventListener('visibilitychange', onVisibility);
      // SPA navigation does not dispatch pagehide. Save the pending last edit
      // when the form unmounts instead of dropping its cancelled debounce.
      flush();
    };
  }, [flush]);
}
