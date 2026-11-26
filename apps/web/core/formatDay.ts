/**
 * How the site writes a date for reading (docs/DESIGN.md section 4): a day is
 * DD.MM.YYYY in every language, as dates are written in Germany and as every
 * date field takes them (core/DateField.tsx). A moment adds the time in
 * Berlin. Modules format days here, never with Intl's per-language styles
 * ("Jun 26, 2026", "26 июня 2026 г.") or as raw ISO.
 */
const DAY = /^(\d{4})-(\d{2})-(\d{2})/;

/** YYYY-MM-DD (or a stamp that starts with it) → DD.MM.YYYY. A value that is
    not a real day is returned as it came; nothing → ''. */
export function formatDay(value: string | null | undefined): string {
  if (!value) return '';
  const m = DAY.exec(value.trim());
  if (!m) return value;
  const [, y, mo, d] = m;
  const date = new Date(Date.UTC(+y, +mo - 1, +d));
  if (date.getUTCFullYear() !== +y || date.getUTCMonth() !== +mo - 1 || date.getUTCDate() !== +d) return value;
  return `${d}.${mo}.${y}`;
}

/** A timestamp → DD.MM.YYYY, HH:MM in Berlin time; not a timestamp → as it came. */
export function formatStamp(value: string | null | undefined): string {
  if (!value) return '';
  const at = new Date(value);
  if (Number.isNaN(at.getTime())) return value;
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(at);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('day')}.${get('month')}.${get('year')}, ${get('hour')}:${get('minute')}`;
}
