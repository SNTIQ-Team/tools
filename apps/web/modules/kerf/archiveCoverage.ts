import type { KerfActArchive } from './client';
import { buildArchiveTimeline } from './retrospectiveTimeline';

export function archiveCoverage(archive: KerfActArchive | null) {
  const timeline = buildArchiveTimeline(archive);
  const events = new Set<object>();
  const states = new Set<string>();
  let eventsFrom: string | null = null;
  let textsFrom: string | null = null;
  for (const item of timeline) {
    if (item.event) {
      events.add(item.event);
      if (!eventsFrom || item.date < eventsFrom) eventsFrom = item.date;
    }
    if (!item.checkoutable || item.kind === 'head') continue;
    if (item.entry && (item.entry.partial === true || item.entry.exact !== true)) continue;
    if (item.interval && (!item.complete || (!item.sourceExact && !item.verifiedReconstruction))) continue;
    const digest = item.interval?.state_sha256
      ?? item.observation?.state_sha256 ?? item.observation?.state_digest
      ?? item.entry?.state_digest;
    if (!digest) continue;
    states.add(digest);
    if (!textsFrom || item.date < textsFrom) textsFrom = item.date;
  }
  return { eventsFrom, eventCount: events.size, textsFrom, textCount: states.size,
    hasEarlierEvents: Boolean(eventsFrom && (!textsFrom || eventsFrom < textsFrom)) };
}
