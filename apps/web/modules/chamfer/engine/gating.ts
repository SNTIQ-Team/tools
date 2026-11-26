/**
 * Gate evaluation — the wizard's single source of truth for whether a
 * letter may be composed, and with which warnings.
 *
 * Correctness rules (docs/LEGAL-REVISION.md §§2–4):
 *  - blockers HIDE the compose form; the UI shows the explanation and,
 *    where applicable, the alternative path (e.g. straight to Klage in
 *    direct_klage Länder, counseling for excluded scenarios);
 *  - warnings render above the form and must be visually loud — a
 *    wrong "all good" costs the user a remedy;
 *  - deadline math lives in engine/logic.ts (monthDeadlineISO) so the
 *    letter text, the gate and the UI never disagree.
 */

import type { GateConfirmation, LetterSpec } from '../data/letters';
import type { LandRemedy } from '../data/remedies';
import type { Answers } from './logic';
import { appealDeadlineISO } from './deadline-calendar';
import {
  formatDE, isMonthOnly, monthsSince, parseISO,
  toLocalISO,
  todayISO,
} from './logic';

export interface GateIssue {
  kind: 'blocker' | 'warning';
  /** i18n key under chamfer.gate.* */
  key: string;
  params?: Record<string, string | number>;
  /**
   * stop=true hides the whole form (wrong remedy/scenario — no input
   * can fix it here). Procedural blockers (missing date, § 75 wait)
   * keep the form visible so the user can actually enter the data —
   * they only disable the preview button.
   */
  stop?: boolean;
}

export interface GateResult {
  allowed: boolean;
  issues: GateIssue[];
  /** confirmations the user still has to check (rendered as checkboxes) */
  missingConfirmations: GateConfirmation[];
  /** mandatory interstitial before the form, if the letter declares one */
  interstitialKey?: string;
}

export function evaluateGate(
  letter: LetterSpec,
  answers: Answers,
  remedy: LandRemedy,
  now = new Date(),
  recipientLand = remedy.land,
): GateResult {
  const issues: GateIssue[] = [];
  const missing: GateConfirmation[] = [];
  const gate = letter.gate;

  // ------------------------------------------------- confirmations
  for (const c of gate?.confirmations ?? []) {
    if (answers.confirmations[c] !== true) missing.push(c);
  }

  // ------------------------------------------------------ min wait
  if (gate?.minWait) {
    const { sinceField, months, hard } = gate.minWait;
    const value = answers.fields[sinceField];
    const elapsed = monthsSince(value, now);
    if (elapsed === null) {
      issues.push({ kind: 'blocker', key: 'gate.date.required',
                    params: { field: sinceField } });
    } else if (elapsed < months) {
      issues.push({
        kind: hard ? 'blocker' : 'warning',
        key: 'gate.minWait',
        params: { months, elapsed },
      });
    }
    if (isMonthOnly(value)) {
      // month-only dates are counted from the END of the month
      // (conservative) — tell the user why the wait looks longer
      issues.push({ kind: 'warning', key: 'gate.date.approx' });
    }
  }

  // ----------------------------------------------- per-Land remedy
  if (gate?.remedy === 'widerspruch_exists') {
    if (remedy.status === 'direct_klage' && remedy.confidence === 'confirmed') {
      // no Widerspruch in this Land — the alternative (Klage, 1 month)
      // is rendered by the UI from this blocker
      issues.push({ kind: 'blocker', stop: true, key: 'gate.remedy.absent',
                    params: { land: remedy.name } });
    } else if (remedy.status !== 'widerspruch' ||
               remedy.confidence !== 'confirmed') {
      // unverified or mixed regime — conservative double path
      issues.push({ kind: 'warning', key: 'gate.remedy.verify',
                    params: { land: remedy.name } });
    }
  }

  // ------------------------------------- letter-specific deadlines
  if (letter.id === 'widerspruch_aufenthg') {
    const { bescheidDate, notificationDate } = answers.fields;
    const instruction = answers.choices.appealInstruction;
    if (notificationDate && (!parseISO(notificationDate) || isMonthOnly(notificationDate)
      || (bescheidDate && notificationDate < bescheidDate) || notificationDate > todayISO(now))) {
      issues.push({ kind: 'blocker', key: 'gate.deadline.invalidNotification' });
    } else if (instruction !== 'proper' && instruction !== 'missing_or_wrong') {
      // Legacy 'no / unsure' and unopened choices carry no reliable diagnosis.
      issues.push({ kind: 'warning', key: 'gate.deadline.unknownInstruction' });
    } else if (!notificationDate) {
      issues.push({ kind: 'warning', key: 'gate.deadline.unknownNotification' });
    } else {
      const months = instruction === 'proper' ? 1 : 12;
      const deadline = appealDeadlineISO(notificationDate, months, recipientLand);
      if (!deadline) {
        issues.push({ kind: 'warning', key: 'gate.deadline.unknownCalendar' });
      } else if (todayISO(now) > deadline) {
        issues.push({ kind: 'blocker', key: 'gate.deadline.passed',
                      params: { deadline: formatDE(deadline) } });
      } else {
        issues.push({ kind: 'warning',
                      key: months === 1 ? 'gate.deadline.oneMonth' : 'gate.deadline.yearRule',
                      params: { deadline: formatDE(deadline) } });
      }
    }
  }

  if (letter.id === 'translation_costs' &&
      !['asylblg', 'sgb2'].includes(answers.choices.benefitRegime ?? '')) {
    issues.push({ kind: 'blocker', key: 'gate.regimeRequired' });
  }

  if (letter.id === 'untaetigkeitsklage') {
    const md = parseISO(answers.fields.mahnungDeadline);
    // the deadline runs until the END of its day — "fruchtlos
    // verstrichen" is only true from the following day on; do not let
    // a premature lawsuit through while the Frist still runs
    if (md && toLocalISO(md) >= todayISO(now)) {
      issues.push({ kind: 'blocker', key: 'gate.mahnung.notExpired' });
    }
  }

  if (letter.id === 'new_application') {
    const scenario = answers.choices.reapplyScenario;
    if (!scenario) {
      issues.push({ kind: 'blocker', key: 'gate.scenario.required' });
    } else if (scenario === 'title_elsewhere') {
      // EU-law exclusion for applications after 13.08.2025 with a valid
      // title elsewhere (Durchführungsbeschluss (EU) 2025/1460 +
      // EuGH C-753/23) — counseling, not a generated letter
      issues.push({ kind: 'blocker', stop: true, key: 'gate.scenario.titleElsewhere' });
    } else if (scenario === 'renounced_elsewhere') {
      // abuse-of-rights line (BayVGH 19 ZB 25.898) — lawyer first
      issues.push({ kind: 'blocker', stop: true, key: 'gate.scenario.renounced' });
    }
  }

  const allowed =
    missing.length === 0 &&
    !issues.some((i) => i.kind === 'blocker');

  return {
    allowed,
    issues,
    missingConfirmations: missing,
    interstitialKey: gate?.interstitialKey,
  };
}
