// Deutsche Bundesbank, "Feiertage in Deutschland", annual calendars for
// 2025–2027 (gesetzliche Feiertage only; 24/31 December are bank closures).
// https://www.bundesbank.de/de/aufgaben/unbarer-zahlungsverkehr/target/feiertagskalender-2027-749314
// For Bavaria's municipal holidays see Art. 1 FTG; for Corpus Christi in
// parts of Saxony and Thuringia the Land alone does not resolve the date.
import { isMonthOnly, monthDeadlineISO, parseISO, toLocalISO } from './logic';

type YearCalendar = { nationwide: string[]; corpusChristi: string; repentance: string };
const calendar: Record<number, YearCalendar> = {
  2025: { nationwide: ['04-18', '04-21', '05-29', '06-09'], corpusChristi: '06-19', repentance: '11-19' },
  2026: { nationwide: ['04-03', '04-06', '05-14', '05-25'], corpusChristi: '06-04', repentance: '11-18' },
  2027: { nationwide: ['03-26', '03-29', '05-06', '05-17'], corpusChristi: '05-27', repentance: '11-17' },
};
const nationwide = ['01-01', '05-01', '10-03', '12-25', '12-26'];
const fixedLandHolidays: Record<string, string[]> = {
  '01-06': ['08', '09', '15'],
  '03-08': ['11', '13'],
  '08-15': ['10'],
  '09-20': ['16'],
  '10-31': ['01', '02', '03', '04', '12', '13', '14', '15', '16'],
  '11-01': ['05', '07', '08', '09', '10'],
};
const corpusChristiLands = ['05', '06', '07', '08', '09', '10'];

/** Null when the year, Land or local public-holiday status cannot be verified. */
export function appealDeadlineISO(notification: string, months: number, land: string): string | null {
  if (isMonthOnly(notification) || !/^(0[1-9]|1[0-6])$/.test(land)) return null;
  const nominal = monthDeadlineISO(notification, months);
  const day = parseISO(nominal ?? undefined);
  if (!day) return null;
  for (;;) {
    const year = day.getFullYear();
    const dates = calendar[year];
    if (!dates) return null;
    const iso = toLocalISO(day);
    const md = iso.slice(5);
    const closed = day.getDay() === 0 || day.getDay() === 6
      || nationwide.includes(md) || dates.nationwide.includes(md)
      || fixedLandHolidays[md]?.includes(land)
      || (md === dates.corpusChristi && corpusChristiLands.includes(land))
      || (md === dates.repentance && land === '14')
      || (iso === '2025-05-08' && land === '11');
    if (!closed) {
      const localHoliday = (md === dates.corpusChristi && ['14', '16'].includes(land))
        || (land === '09' && ['08-08', '08-15'].includes(md));
      return localHoliday ? null : iso;
    }
    day.setDate(day.getDate() + 1);
  }
}
