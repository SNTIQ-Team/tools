/**
 * The bridge between the system date picker (`<input type="date">`, value
 * YYYY-MM-DD) and the answers, which stay in the German TT.MM.JJJJ form that
 * validation, drafts and the PDF already use.
 */
import { isValidGermanDate } from '@/modules/lathe/validation';

const pad = (n: number) => String(n).padStart(2, '0');

/** Stored TT.MM.JJJJ → picker value; anything incomplete or invalid → '' (empty picker). */
export function germanToIso(s: string): string {
  if (!isValidGermanDate(s)) return '';
  const [dd, mm, yyyy] = s.split('.');
  return `${yyyy}-${mm}-${dd}`;
}

/** Picker value → stored TT.MM.JJJJ; a cleared picker clears the answer. */
export function isoToGerman(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
}

/** Today in local time as YYYY-MM-DD (the picker's `max` for birth dates). */
export function todayIso(now = new Date()): string {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
