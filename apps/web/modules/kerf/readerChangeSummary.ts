'use client';

import { useEffect, useState } from 'react';
import type { KerfActDetail } from './client';
import { actChangeSummaryFrom, normalizeChangeSummary, type KerfChangeSummary } from './changeHistory';
import { kerfNormChanges, kerfResolveNorm } from './normHistoryClient';
import { berlinToday } from './kerfLabels';
import { isKerfRequestError } from './kerfRequest';

const normSummaries = new Map<string, Promise<KerfChangeSummary | null>>();
/** Set once the deployed API proves it has no /changes route: no further probes. */
let changesRouteMissing = false;

/** Served norm-level change summary (`/norms/{id}/changes?limit=0`), or null
 * when the deployed API does not serve one. One request pair per norm. */
export function loadNormSummary(actId: string, norm: string): Promise<KerfChangeSummary | null> {
  if (changesRouteMissing) return Promise.resolve(null);
  const key = `${actId}\u0000${norm}`;
  const cached = normSummaries.get(key);
  if (cached) return cached;
  const promise = kerfResolveNorm(actId, norm)
    .then(resolved => resolved.status === 'ok' && resolved.evidence[0]?.canonical_id ? kerfNormChanges(resolved.evidence[0].canonical_id, { limit: 0 }) : null)
    .then(page => page ? normalizeChangeSummary(page.change_summary) : null)
    .catch(error => { if (isKerfRequestError(error) && error.kind === 'not_found') changesRouteMissing = true; return null; });
  normSummaries.set(key, promise);
  void promise.then(value => { if (value === null) normSummaries.delete(key); });
  if (normSummaries.size > 64) normSummaries.delete(normSummaries.keys().next().value!);
  return promise;
}

/** Only the act's GII notes, restated for a single provision (never the act's
 * last/next change, which may concern other provisions). */
export function actNotesForNorm(act: KerfActDetail, today = berlinToday()): KerfChangeSummary | null {
  const summary = actChangeSummaryFrom(act, today);
  if (!summary || (!summary.act_stand_note && !summary.documentation_notes.length)) return null;
  return { ...summary, scope: 'norm', subject: act.id, last_change: null, next_pending_change: null, pending_changes: [], counts: null, last_incorporated_undated: null, unknown_dates: [], completeness: null, derived: 'legacy' };
}

/** Change summary for the reader header of an act or a single provision. */
export function useReaderChangeSummary(act: KerfActDetail | null, norm: string | null): KerfChangeSummary | null {
  const [served, setServed] = useState<{ key: string; summary: KerfChangeSummary | null } | null>(null);
  const key = act && norm ? `${act.id}\u0000${norm}` : null;
  useEffect(() => {
    let alive = true;
    if (act && norm) void loadNormSummary(act.id, norm).then(summary => { if (alive) setServed({ key: `${act.id}\u0000${norm}`, summary }); });
    return () => { alive = false; };
  }, [act, norm]);
  if (!act) return null;
  if (!norm) return actChangeSummaryFrom(act, berlinToday());
  const current = served?.key === key ? served.summary : null;
  return current ?? actNotesForNorm(act);
}
