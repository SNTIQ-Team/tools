/**
 * Shared wizard state and date logic.
 *
 * Dates are stored ISO (yyyy-mm-dd, as emitted by <input type="date">)
 * and rendered de-DE only when a letter is composed. All deadline
 * arithmetic lives here so gating, templates and UI never disagree.
 */

import { todayIsoIn } from '@/core/jurisdiction';
import type { LetterField } from '../data/letters';
import type { GateConfirmation } from '../data/letters';
import type { LandRemedy } from '../data/remedies';
import type { Profile } from './compose';

// ------------------------------------------------------------- answers

/** boolean follow-up questions a letter may ask */
export type FlagId =
  /** a Sachstandsanfrage was already sent before the Mahnung */
  | 'priorInquirySent'
  /** the Fiktionsbescheinigung is ALSO missing (escalation letters) */
  | 'fiktionAlsoMissing'
  /** Legacy draft flag: the old form combined an unknown instruction with an absent one. */
  | 'hadRechtsbehelfsbelehrung'
  /** DSGVO file-access request is a repeat (erneuter Antrag) */
  | 'repeatRequest';

/** single-choice follow-up questions */
export type ChoiceId =
  /** never_issued | expired */
  | 'fiktionSituation'
  /** refused_to_accept | announced_rejection */
  | 'oralRefusalKind'
  /** scenario matrix LEGAL-REVISION §2:
   *  third_country_stay | applied_elsewhere | title_elsewhere |
   *  renounced_elsewhere | german_verzicht */
  | 'reapplyScenario'
  /** asylblg | sgb2 — decides the legal basis cited */
  | 'benefitRegime'
  /** proper | missing_or_wrong | unknown */
  | 'appealInstruction'
  /** job | benefits | housing | none — adds an urgency paragraph */
  | 'urgencyReason';

export interface Answers {
  fields: Partial<Record<LetterField, string>>;
  flags: Partial<Record<FlagId, boolean>>;
  choices: Partial<Record<ChoiceId, string>>;
  confirmations: Partial<Record<GateConfirmation, boolean>>;
}

export const emptyAnswers = (): Answers =>
  ({ fields: {}, flags: {}, choices: {}, confirmations: {} });

// --------------------------------------------------------------- dates

/** month-only value as emitted by <input type="month"> */
export const isMonthOnly = (v: string | undefined): boolean =>
  Boolean(v && /^(?!0000)\d{4}-(?:0[1-9]|1[0-2])$/.test(v));

/**
 * Accepts yyyy-mm-dd and yyyy-mm. Month-only values resolve to the
 * LAST day of the month — deliberately conservative: every elapsed-time
 * gate (§ 75 VwGO wait) then under-counts rather than over-counts.
 */
export const parseISO = (iso: string | undefined): Date | null => {
  if (!iso) return null;
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]), month = Number(match[2]);
  const day = match[3] ? Number(match[3]) : 0;
  if (year === 0 || month < 1 || month > 12 || (match[3] && (day < 1 || day > 31))) return null;
  // setFullYear avoids Date's special 1900 offset for years below 100.
  const date = new Date(0);
  date.setHours(0, 0, 0, 0);
  date.setFullYear(year, match[3] ? month - 1 : month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1
    || (match[3] && date.getDate() !== day)) return null;
  return date;
};

export const formatDE = (iso: string | undefined): string => {
  if (iso && isMonthOnly(iso)) {
    const [y, m] = iso.split('-');
    return `${m}.${y}`;
  }
  const d = parseISO(iso);
  return d ? d.toLocaleDateString('de-DE',
    { day: '2-digit', month: '2-digit', year: 'numeric' }) : '';
};

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * yyyy-mm-dd from LOCAL date parts. Never use toISOString() for dates:
 * it converts to UTC and is a day early for every user east of it
 * (all of Germany) — fatal for deadline math on legal documents.
 */
export const toLocalISO = (d: Date): string =>
  `${String(d.getFullYear()).padStart(4, '0')}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;

/** Today as yyyy-mm-dd in Berlin: a German letter's date and its deadlines
 *  follow the German calendar, wherever the writer is (core/jurisdiction.ts). */
export const todayISO = (now = new Date()): string =>
  todayIsoIn('DE', now);

/** Today in Berlin as a local-midnight Date, for arithmetic on local date
 *  parts (getDate, getMonth) that must read Berlin's day. */
export const berlinDay = (now = new Date()): Date =>
  parseISO(todayIsoIn('DE', now)) ?? now;

export const addDaysISO = (iso: string, days: number): string => {
  const d = parseISO(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toLocalISO(d);
};

/** whole months elapsed between an ISO date and `now` (negative→0) */
export function monthsSince(iso: string | undefined, now = new Date()):
  number | null {
  const d = parseISO(iso);
  if (!d) return null;
  const today = berlinDay(now);
  let m = (today.getFullYear() - d.getFullYear()) * 12 +
          (today.getMonth() - d.getMonth());
  if (today.getDate() < d.getDate()) m -= 1;
  return Math.max(0, m);
}

/**
 * § 70 VwGO / § 74 VwGO style month deadline: same day next month,
 * end-of-month clamped. Returns ISO.
 */
export function monthDeadlineISO(iso: string, months: number): string | null {
  const d = parseISO(iso);
  if (!d) return null;
  const day = d.getDate();
  d.setDate(1);
  d.setMonth(d.getMonth() + months);
  const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(day, lastDay));
  return toLocalISO(d);
}

/** suggested Fristsetzung for a Mahnung: 14 days from today */
export const suggestMahnungDeadlineISO = (): string =>
  addDaysISO(todayISO(), 14);

/** Complete display dates only; input formatting alone is not validation. */
export function isValidGermanDate(value: string): boolean {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value);
  return Boolean(match && parseISO(`${match[3]}-${match[2]}-${match[1]}`));
}

export function requiredFieldsComplete(
  required: readonly LetterField[],
  fields: Answers['fields'],
  dateFields?: ReadonlySet<LetterField>,
): boolean {
  return required.every((field) => {
    const value = fields[field];
    if (typeof value !== 'string' || !value.trim()) return false;
    if (!dateFields?.has(field)) return true;
    return parseISO(value) !== null
      && (field === 'applicationDate' || !isMonthOnly(value));
  });
}

export function profileComplete(profile: Profile, now = new Date()): boolean {
  const fields = ['name', 'surname', 'dob', 'street', 'plzCity'] as const;
  if (!fields.every((field) => typeof profile[field] === 'string' && profile[field].trim())) return false;
  if (!isValidGermanDate(profile.dob)) return false;
  const [day, month, year] = profile.dob.split('.');
  return `${year}-${month}-${day}` <= todayISO(now);
}

// ------------------------------------------------------------- context

/** evaluation context handed to template blocks and gating */
export interface Ctx {
  f: (field: LetterField) => string | undefined;
  flag: (id: FlagId) => boolean;
  choice: (id: ChoiceId) => string | undefined;
  monthsSince: (field: LetterField) => number | null;
  remedy: LandRemedy;
  now: Date;
}

export function makeCtx(
  answers: Answers, remedy: LandRemedy, now = new Date(),
): Ctx {
  return {
    f: (field) => answers.fields[field],
    flag: (id) => answers.flags[id] === true,
    choice: (id) => answers.choices[id],
    monthsSince: (field) => monthsSince(answers.fields[field], now),
    remedy,
    now,
  };
}
