import type {
  KerfActArchive, KerfActArchiveEntry, KerfRetrospectiveEvent,
  KerfRetrospectiveInterval, KerfRetrospectiveObservation,
} from './client';

export type ArchiveTimelineKind =
  | 'publication'
  | 'effective'
  | 'legal'
  | 'observed'
  | 'event'
  | 'head';

export interface ArchiveTimelineItem {
  id: string;
  date: string;
  kind: ArchiveTimelineKind;
  label?: string | null;
  /** Only text states may be sent to the Markdown checkout endpoint. A
   * publication/effect marker is evidence, not a consolidated state. */
  checkoutable: boolean;
  /** A complete body may be replay-verified without being source-exact. */
  complete?: boolean;
  sourceExact?: boolean;
  verifiedReconstruction?: boolean;
  /** Effective markers after the archive HEAD are scheduled future facts. */
  future?: boolean;
  interval?: KerfRetrospectiveInterval;
  entry?: KerfActArchiveEntry;
  event?: KerfRetrospectiveEvent;
  observation?: KerfRetrospectiveObservation;
}

const retrievalBasis = (value?: string | null) =>
  Boolean(value && /(?:retrieval|observed|observation|capture)/iu.test(value));

const legacyKind = (entry: KerfActArchiveEntry): ArchiveTimelineKind => {
  if (/^(?:head|current)/iu.test(entry.label ?? '')) return 'head';
  if (entry.legal_effect_verified || entry.effective_at || entry.effective_from) {
    return 'legal';
  }
  if (entry.observed_at || retrievalBasis(entry.date_basis)) return 'observed';
  return 'event';
};

const KIND_ORDER: Record<ArchiveTimelineKind, number> = {
  publication: 0,
  effective: 1,
  legal: 2,
  observed: 3,
  event: 4,
  head: 5,
};

const isIsoDay = (value?: string | null): value is string =>
  Boolean(value && /^\d{4}-\d{2}-\d{2}$/u.test(value));

const eventIdentity = (entry: KerfRetrospectiveEvent, index: number) =>
  entry.id ?? entry.event_id ?? entry.document_id ?? `${entry.date}:${index}`;

export const isVerifiedReconstruction = (
  interval: KerfRetrospectiveInterval,
) => (interval.body_complete === true || interval.complete === true)
  && interval.source_exact === false
  && (interval.verified_reconstruction === true
    || (interval.text_status === 'derived_verified'
      && interval.reverse_replay_verified === true));

/** Build the visible legal chronology without ever keying solely by date.
 * A publication, effective event and observation may all happen on one day. */
export const buildArchiveTimeline = (
  archive: KerfActArchive | null,
): ArchiveTimelineItem[] => {
  if (!archive) return [];
  const intervals = archive.retrospective?.intervals ?? [];
  const intervalItems: ArchiveTimelineItem[] = intervals
      .filter((interval): interval is KerfRetrospectiveInterval & {
        effective_from: string;
      } => typeof interval.effective_from === 'string'
        && /^\d{4}-\d{2}-\d{2}$/u.test(interval.effective_from))
      .map((interval, index) => {
        const verifiedReconstruction = isVerifiedReconstruction(interval);
        const sourceExact = interval.source_exact
          ?? interval.text_status === 'official_exact';
        const complete = interval.complete ?? interval.body_complete
          ?? (sourceExact || verifiedReconstruction);
        return {
          id: `legal:${interval.segment_id ?? interval.version_id ?? interval.id
            ?? interval.state_sha256 ?? index}:${index}`,
          date: interval.effective_from,
          kind: 'legal' as const,
          label: interval.verification ?? interval.date_basis ?? null,
          checkoutable: Boolean(interval.state_sha256 && complete),
          complete,
          sourceExact,
          verifiedReconstruction,
          interval,
        };
      });
  const eventItems: ArchiveTimelineItem[] =
    (archive.retrospective?.events ?? []).flatMap((event, index) => {
      const identity = eventIdentity(event, index);
      const publicationDate = isIsoDay(event.published_at)
        ? event.published_at
        : !isIsoDay(event.effective_at) && isIsoDay(event.date)
          ? event.date : null;
      const effectiveDate = isIsoDay(event.effective_at)
        ? event.effective_at
        : null;
      const items: ArchiveTimelineItem[] = [];
      if (publicationDate) {
        items.push({
          id: `retro-publication:${identity}:${index}`,
          date: publicationDate,
          kind: event.published_at ? 'publication' : 'event',
          label: event.procedure_title ?? event.article_heading ?? event.label,
          checkoutable: false,
          event,
        });
      }
      if (effectiveDate) {
        items.push({
          id: `retro-effective:${identity}:${index}`,
          date: effectiveDate,
          kind: 'effective',
          label: event.procedure_title ?? event.article_heading ?? event.label,
          checkoutable: false,
          future: Boolean(archive.head_date && effectiveDate > archive.head_date),
          event,
        });
      }
      return items;
    });
  const retrospectiveItems: ArchiveTimelineItem[] = [
    ...eventItems,
    ...(archive.retrospective?.observations ?? []).map((entry, index) => ({
      id: `retro-observation:${entry.id ?? entry.state_sha256
        ?? entry.state_digest ?? entry.observed_at ?? entry.date}:${index}`,
      date: entry.observed_at || entry.date || '',
      kind: 'observed' as const,
      label: entry.label,
      checkoutable: Boolean(entry.state_sha256 ?? entry.state_digest),
      observation: entry,
    })),
  ].filter((item) => /^\d{4}-\d{2}-\d{2}$/u.test(item.date));
  const legacyItems: ArchiveTimelineItem[] = (archive.entries ?? [])
      .filter((entry) => Boolean(entry?.date))
      .map((entry, index) => ({
        id: `legacy:${entry.id ?? `${entry.date}:${legacyKind(entry)}`}:${index}`,
        date: entry.date,
        kind: legacyKind(entry),
        label: entry.label,
        checkoutable: legacyKind(entry) === 'head'
          || legacyKind(entry) === 'legal'
          || (legacyKind(entry) === 'observed' && Boolean(entry.state_digest)),
        entry,
      }));
  const hasRetrospective = Boolean(archive.retrospective)
    && (intervalItems.length > 0 || retrospectiveItems.length > 0);
  const observations = new Set(retrospectiveItems.filter(item => item.observation).map(item =>
    JSON.stringify([item.date, item.observation?.state_sha256 ?? item.observation?.state_digest])));
  // Event-only backfill is still real chronology. Do not hide it because no
  // full historical state pair has passed the stricter checkout gate yet.
  // Retain independent official captures (including Bavarian archives), while
  // avoiding a second copy of a capture already in the retrospective store.
  const items: ArchiveTimelineItem[] = hasRetrospective
    ? [
        ...intervalItems,
        ...retrospectiveItems,
        ...legacyItems.filter(item => item.kind === 'head'
          || item.kind === 'observed' && item.entry?.state_digest
            && !observations.has(JSON.stringify([item.date, item.entry.state_digest]))),
      ]
    : legacyItems;

  return items.sort((left, right) =>
    left.date.localeCompare(right.date)
    || KIND_ORDER[left.kind] - KIND_ORDER[right.kind]
    || left.id.localeCompare(right.id));
};

export const intervalContains = (
  interval: KerfRetrospectiveInterval,
  date: string,
) => Boolean(interval.effective_from)
  && interval.effective_from! <= date
  && (!interval.effective_to || date < interval.effective_to)
  // An open legal interval is only verified through the last observed state.
  // Treating it as infinite silently invents history after the evidence ends.
  && (Boolean(interval.effective_to) || !interval.verified_through_observed_at
    || date <= interval.verified_through_observed_at.slice(0, 10));

/** Resolve a selected rail item, or the legal interval containing a freely
 * entered date. The item id wins so same-day evidence rows stay selectable. */
export const resolveArchiveTimelineItem = (
  items: ArchiveTimelineItem[],
  selectedId: string,
  selectedDate: string,
): ArchiveTimelineItem | null => {
  if (selectedId) {
    const selected = items.find((item) => item.id === selectedId);
    if (selected) return selected;
  }
  const interval = items.find((item) =>
    item.interval && intervalContains(item.interval, selectedDate));
  if (interval) return interval;
  return items.find((item) => item.date === selectedDate) ?? null;
};
