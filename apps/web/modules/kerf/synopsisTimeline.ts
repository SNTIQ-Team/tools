import type { KerfActDetail, KerfPatch, KerfRetrospectiveCommand, KerfRetrospectiveEvent, KerfVersion } from './client';

export type SynopsisItem =
  | { kind: 'patch'; sort: string; p: KerfPatch }
  | { kind: 'version'; sort: string; v: KerfVersion }
  | { kind: 'event'; sort: string; event: KerfRetrospectiveEvent };

export const normKey = (value?: string | null) => (value ?? '')
  .replace(/^(?:§+|Art\.?)\s*/iu, '').replace(/\s+/gu, '').toLowerCase();

export const commandMatchesNorm = (command: KerfRetrospectiveCommand, norm: string) => !norm
  || [command.ref?.para, ...(command.ref?.paras ?? [])]
    .some((ref) => normKey(ref) === normKey(norm));

/** Official commands are useful history even without a complete state pair. */
export function buildSynopsisTimeline(
  detail: KerfActDetail,
  events: KerfRetrospectiveEvent[] = [],
  norm = '',
): SynopsisItem[] {
  const key = normKey(norm);
  const items: SynopsisItem[] = [];
  for (const p of detail.patches ?? []) {
    if (p.status === 'rejected' || p.status === 'not_merged') continue;
    if (key && normKey(p.para) !== key) continue;
    items.push({
      kind: 'patch',
      sort: p.status === 'proposed' || p.status === 'adopted'
        ? '9999-99-99' : p.valid_from_verified ? p.valid_from ?? '' : '',
      p,
    });
  }
  for (const version of detail.versions ?? []) {
    const changes = key
      ? (version.changes ?? []).filter((change) => normKey(change.para) === key)
      : version.changes;
    if (key && !changes?.length) continue;
    items.push({
      kind: 'version',
      sort: version.legal_effect_verified && version.effective_at
        ? version.effective_at : version.date,
      v: key ? { ...version, changes } : version,
    });
  }
  for (const event of events) {
    if (event.knowledge_to) continue;
    if (key && !(event.affected_norms ?? []).some((value) => normKey(value) === key)
      && !(event.commands ?? []).some((command) => commandMatchesNorm(command, norm))) continue;
    items.push({ kind: 'event', sort: event.effective_at ?? event.published_at ?? event.date, event });
  }
  return items.sort((a, b) => b.sort.localeCompare(a.sort));
}
