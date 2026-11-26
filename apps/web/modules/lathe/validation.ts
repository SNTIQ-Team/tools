/**
 * Module-local input validation. Amounts and dates end up VERBATIM on a
 * court form (§ 117 ZPO declaration) — malformed values get applications
 * bounced, so parse strictly and reject garbage instead of printing it.
 */
import { todayGerman } from '@/core/jurisdiction';
import { LATHE_JURISDICTION } from './jurisdiction';


/**
 * Parse a German-formatted euro amount. Accepts '1200', '1.200',
 * '1.234,56', '0,5', a leading minus and a plain decimal dot ('1200.50'); returns NaN
 * for malformed/nonfinite amounts or values outside safe cent precision.
 */
export const parseEuroDE = (v: string): number => {
  const input = (v || '').trim();
  const negative = input.startsWith('-');
  const s = negative ? input.slice(1) : input;
  if (!s) return NaN;
  let normalized: string;
  if (s.includes(',')) {
    const parts = s.split(',');
    if (parts.length !== 2 || !/^\d{1,2}$/.test(parts[1])) return NaN;
    const intPart = parts[0];
    if (/^\d+$/.test(intPart)) normalized = `${intPart}.${parts[1]}`;
    else if (/^\d{1,3}(\.\d{3})+$/.test(intPart))
      normalized = `${intPart.replace(/\./g, '')}.${parts[1]}`;
    else return NaN;
  } else if (s.includes('.')) {
    // dot only: decimal when followed by 1–2 digits ('1200.50'),
    // otherwise strictly-grouped thousands separators ('1.200')
    if (/^\d+\.\d{1,2}$/.test(s)) normalized = s;
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) normalized = s.replace(/\./g, '');
    else return NaN;
  } else {
    if (!/^\d+$/.test(s)) return NaN;
    normalized = s;
  }
  const amount = Number(normalized) * (negative ? -1 : 1);
  return Number.isFinite(amount) && Number.isSafeInteger(Math.round(amount * 100))
    ? amount : NaN;
};

/**
 * Canonical German amount ('1.234,56') for parseable input; '' for empty
 * or malformed input — rejecting beats printing garbage on a legal form.
 */
export const normalizeEuroDE = (v: string): string => {
  if (!(v || '').trim()) return '';
  const n = parseEuroDE(v);
  if (Number.isNaN(n)) return '';
  return n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

/** Strict TT.MM.JJJJ check incl. real calendar date ('31.02.2020' fails). */
export const isValidGermanDate = (s: string): boolean => {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return false;
  const [dd, mm, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(yyyy, mm - 1, dd);
  return date.getFullYear() === yyyy && date.getMonth() === mm - 1 && date.getDate() === dd;
};

/** Valid TT.MM.JJJJ that is not in the future (birth dates). */
export const isPastGermanDate = (s: string, today = todayGerman(LATHE_JURISDICTION)): boolean => {
  if (!isValidGermanDate(s)) return false;
  // "Not in the future" against today in Berlin, not the device clock.
  const key = (t: string) => { const [dd, mm, yyyy] = t.split('.'); return `${yyyy}${mm}${dd}`; };
  return key(s) <= key(today);
};
