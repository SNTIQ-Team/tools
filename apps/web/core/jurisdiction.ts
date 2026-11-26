/**
 * Where a tool's legal facts are anchored. A German form's "today" is the
 * date in Berlin, wherever the person is and whatever their device clock
 * says (the signing date, "not in the future"). Each module names its
 * jurisdiction; another country is one more entry here.
 */
export type Jurisdiction = 'DE';

export const JURISDICTIONS: Record<Jurisdiction, { timeZone: string }> = {
  DE: { timeZone: 'Europe/Berlin' },
};

function todayParts(j: Jurisdiction, now: Date): { y: string; m: string; d: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: JURISDICTIONS[j].timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return { y: get('year'), m: get('month'), d: get('day') };
}

/** Today in the jurisdiction as TT.MM.JJJJ. */
export function todayGerman(j: Jurisdiction, now = new Date()): string {
  const { y, m, d } = todayParts(j, now);
  return `${d}.${m}.${y}`;
}

/** Today in the jurisdiction as YYYY-MM-DD (date picker values). */
export function todayIsoIn(j: Jurisdiction, now = new Date()): string {
  const { y, m, d } = todayParts(j, now);
  return `${y}-${m}-${d}`;
}
