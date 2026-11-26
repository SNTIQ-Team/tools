'use client';

import React from 'react';
import { AlertTriangle, Loader2, RotateCcw, X } from 'lucide-react';
import { KERF_REQUEST_TIMEOUT_MS, type KerfRequestError } from './kerfRequest';
import { readerCopy } from './readerI18n';
import { useSlowFlag } from './readerResources';
import styles from './reader.module.css';

/** Localised reason for a failed load; never a raw exception text. */
export function loadErrorText(error: KerfRequestError | null | undefined, language: string): string {
  const t = readerCopy(language);
  switch (error?.kind) {
    case 'timeout': return t.errorTimeout.replace('{s}', String(Math.round((error.timeoutMs ?? KERF_REQUEST_TIMEOUT_MS) / 1000)));
    case 'network': return t.errorNetwork;
    case 'not_found': return t.errorNotFound;
    case 'http': return t.errorHttp.replace('{status}', String(error.status ?? '?'));
    case 'invalid': return t.errorInvalid;
    case 'aborted': return t.errorAborted;
    default: return t.errorNetwork;
  }
}

/**
 * The one loading/error presentation of the reader: a spinner with a label,
 * a "server is slow" hint (with Cancel) after KERF_SLOW_HINT_MS, and a typed
 * error with Retry. Renders nothing when the resource is ready.
 */
export default function LoadStatus({ loading, error, language, title, onRetry, onCancel, resetKey, compact = false, label }: {
  loading: boolean; error: KerfRequestError | null | undefined; language: string; title?: string; label?: string;
  onRetry?: () => void; onCancel?: () => void; resetKey?: unknown; compact?: boolean;
}) {
  const t = readerCopy(language);
  const slow = useSlowFlag(loading && !error, resetKey);
  if (error) {
    return <div className={compact ? styles.loadInline : styles.empty} role="alert" data-load-state="error" data-load-error={error.kind}>
      <AlertTriangle size={compact ? 14 : 20} />
      <div className={styles.loadText}>
        {title && <strong>{title}</strong>}
        <span>{loadErrorText(error, language)}</span>
      </div>
      {onRetry && <button type="button" className={styles.textButton} onClick={onRetry} data-load-retry><RotateCcw size={14} />{t.retry}</button>}
    </div>;
  }
  if (!loading) return null;
  return <div className={compact ? styles.loadInline : styles.empty} role="status" aria-live="polite" data-load-state={slow ? 'slow' : 'loading'}>
    <Loader2 size={compact ? 14 : 21} className="animate-spin" />
    <div className={styles.loadText}>
      <span>{label ?? t.loading}</span>
      {slow && <small data-load-slow>{t.slowServer}</small>}
    </div>
    {slow && onCancel && <button type="button" className={styles.textButton} onClick={onCancel} data-load-cancel><X size={14} />{t.cancel}</button>}
  </div>;
}
