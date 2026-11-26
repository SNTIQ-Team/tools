/**
 * Engine smoke test — run with `npx tsx modules/chamfer/engine/smoke.ts`.
 * Exercises tree integrity, gating branches and template branching;
 * exits non-zero on any failure. Not imported by the app.
 */

import { LETTERS, letterById } from '../data/letters';
import { TREE, validateTree } from '../data/decision-tree';
import { remedyFor } from '../data/remedies';
import type { AuthorityCard } from '../data/recipients';
import { emptyAnswers } from './logic';
import { compose, renderPlainText } from './compose';
import { evaluateGate } from './gating';
import { buildMailto } from './mailto';
import { mock } from 'node:test';

// Freeze the clock underlying compose() as well as explicit gate fixtures.
mock.timers.enable({ apis: ['Date'], now: new Date('2026-06-11T12:00:00') });

let failures = 0;
const check = (name: string, ok: boolean, detail = '') => {
  if (!ok) { failures += 1; console.error(`FAIL ${name} ${detail}`); }
  else console.log(`ok   ${name}`);
};

// ----------------------------------------------------- tree integrity
const treeErrors = validateTree(LETTERS.map((l) => l.id));
check('tree integrity', treeErrors.length === 0, treeErrors.join('; '));
check('tree has outcomes', TREE.some((n) => n.kind === 'outcome'));

// --------------------------------------------------------- fixtures
const abh: AuthorityCard = {
  id: 1, kind: 'auslaenderbehoerde', name: 'Landratsamt Musterstadt',
  legal_form: null, street: 'Amtsweg 1', plz: '80000', city: 'Musterstadt',
  postal_address: null, phone: null, fax: '+49 89 123', email: 'abh@m.de',
  web: null, hours: null, erv_note: null, valid_from: null, valid_to: null,
  external_ids: {}, provenance: { source: 'test', url: null, fetched_at: '' },
};
const profile = { name: 'Olena', surname: 'Mustermann', dob: '01.01.1990',
                  street: 'Musterstr. 5', plzCity: '80331 München' };
const bayern = remedyFor('09');
const brandenburg = remedyFor('12');

// ------------------------------------------------- template branching
{
  const a = emptyAnswers();
  a.fields.applicationDate = '2026-01-15';
  a.choices.fiktionSituation = 'expired';
  a.fields.fiktionExpiry = '2026-05-01';
  a.choices.urgencyReason = 'job';
  const out = compose({ letter: letterById('fiktion_demand')!, profile,
                        answers: a, recipient: abh, remedy: bayern });
  check('fiktion expired branch',
        out.body.includes('abgelaufen') &&
        out.body.includes('am 01.05.2026') &&
        out.body.includes('Arbeitsverhältnis') &&
        !out.body.includes('bisher nicht ausgestellt'));

  a.choices.fiktionSituation = 'never_issued';
  const out2 = compose({ letter: letterById('fiktion_demand')!, profile,
                         answers: a, recipient: abh, remedy: bayern });
  check('fiktion never-issued branch',
        out2.body.includes('bisher nicht ausgestellt') &&
        !out2.body.includes('abgelaufen'));
}

{
  const a = emptyAnswers();
  a.fields.oralRefusalDate = '2026-06-01';
  a.choices.oralRefusalKind = 'refused_to_accept';
  const out = compose({ letter: letterById('oral_refusal')!, profile,
                        answers: a, recipient: abh, remedy: bayern });
  check('oral refusal accept-refusal branch',
        out.body.includes('Entgegennahme') &&
        (out.attachments ?? '').includes('Anlagen: Antrag') &&
        !out.body.includes('nicht entsprochen werde'));
}

{
  // §75 paragraph switches on elapsed months
  const a = emptyAnswers();
  a.fields.applicationDate = '2026-05-20'; // < 3 months before 2026-06-11
  a.fields.mahnungDeadline = '2026-06-30';
  const letter = letterById('mahnung_fristsetzung')!;
  const young = compose({ letter, profile, answers: a, recipient: abh,
                          remedy: bayern });
  check('mahnung <3mo wording', young.body.includes('grundsätzlich zulässig'));
  a.fields.applicationDate = '2025-12-01';
  const old = compose({ letter, profile, answers: a, recipient: abh,
                        remedy: bayern });
  check('mahnung >=3mo wording',
        old.body.includes('bereits verstrichen'));
}

{
  // lawsuit renumbers Anträge with the Fiktion claim
  const a = emptyAnswers();
  a.fields.applicationDate = '2025-12-01';
  a.fields.mahnungDeadline = '2026-05-01';
  a.flags.fiktionAlsoMissing = true;
  const out = compose({ letter: letterById('untaetigkeitsklage')!, profile,
                        answers: a, recipient: abh, remedy: bayern,
                        regardingAuthority: 'Landratsamt Musterstadt' });
  check('lawsuit double Antrag', out.body.includes('1. die Beklagtenseite')
        && out.body.includes('2. die Beklagtenseite'));
}

// --------------------------------------------------------- gating
{
  const a = emptyAnswers();
  const w = letterById('widerspruch_aufenthg')!;
  const inBavaria = evaluateGate(w, a, bayern);
  check('widerspruch blocked in Bayern',
        !inBavaria.allowed &&
        inBavaria.issues.some((i) => i.key === 'gate.remedy.absent'));
  a.fields.bescheidDate = '2026-06-01';
  a.fields.notificationDate = '2026-06-04';
  a.choices.appealInstruction = 'proper';
  const inBB = evaluateGate(w, a, brandenburg,
                            new Date('2026-06-11T12:00:00'));
  check('widerspruch open in Brandenburg (within deadline)',
        inBB.allowed &&
        inBB.issues.some((i) => i.key === 'gate.deadline.oneMonth'));
  const late = evaluateGate(w, a, brandenburg,
                            new Date('2026-08-01T12:00:00'));
  check('widerspruch blocked after deadline',
        !late.allowed &&
        late.issues.some((i) => i.key === 'gate.deadline.passed'));
}

{
  const a = emptyAnswers();
  a.fields.applicationDate = '2026-04-01';
  a.fields.mahnungDeadline = '2026-05-15';
  const k = letterById('untaetigkeitsklage')!;
  const early = evaluateGate(k, a, bayern, new Date('2026-06-11T12:00:00'));
  check('klage blocked before 3 months & confirmations',
        !early.allowed &&
        early.issues.some((i) => i.key === 'gate.minWait') &&
        early.missingConfirmations.length === 3);
  a.fields.applicationDate = '2025-12-01';
  a.confirmations.application_provable = true;
  a.confirmations.mahnung_sent_expired = true;
  a.confirmations.has_basic_evidence = true;
  const ready = evaluateGate(k, a, bayern, new Date('2026-06-11T12:00:00'));
  check('klage allowed when gates met', ready.allowed,
        JSON.stringify(ready.issues));
}

{
  const a = emptyAnswers();
  a.choices.reapplyScenario = 'title_elsewhere';
  const n = letterById('new_application')!;
  const r = evaluateGate(n, a, bayern);
  check('reapply title_elsewhere hard stop',
        !r.allowed &&
        r.issues.some((i) => i.key === 'gate.scenario.titleElsewhere'));
}

// ------------------------------------- month-only dates + signature
{
  const a = emptyAnswers();
  a.fields.applicationDate = '2026-01'; // month-only
  const out = compose({ letter: letterById('fiktion_demand')!, profile,
                        answers: a, recipient: abh, remedy: bayern });
  check('month-only phrase', out.body.includes('im Januar 2026') &&
        !out.body.includes('am im'));
  check('signature extracted',
        out.signatureName === 'Olena Mustermann' &&
        !out.body.includes('Mit freundlichen Grüßen\nOlena'));
  check('ort derived', out.ort === 'München');

  const k = letterById('untaetigkeitsklage')!;
  a.fields.applicationDate = '2026-03';
  a.fields.mahnungDeadline = '2026-05-01';
  a.confirmations.application_provable = true;
  a.confirmations.mahnung_sent_expired = true;
  a.confirmations.has_basic_evidence = true;
  const g = evaluateGate(k, a, bayern, new Date('2026-06-11T12:00:00'));
  check('month-only counts conservatively (end of month)',
        !g.allowed && g.issues.some((i) => i.key === 'gate.minWait') &&
        g.issues.some((i) => i.key === 'gate.date.approx'));
}

{
  const a = emptyAnswers();
  a.fields.applicationDate = '2026-01-15';
  a.choices.reapplyScenario = 'third_country_stay';
  a.confirmations.contested_law_understood = true;
  a.confirmations.counseling_sought = true;
  const out = compose({ letter: letterById('new_application')!, profile,
                        answers: a, recipient: abh, remedy: bayern });
  check('attachments split out',
        out.attachments === 'Anlagen: siehe Anlagenübersicht' &&
        !out.body.includes('Anlagen: siehe'));
  check('scenario citation present',
        out.body.includes('24 K 7223/24'));
}

// --------------------------------------------------------- mailto
{
  const a = emptyAnswers();
  a.fields.applicationDate = '2026-01-15';
  const out = compose({ letter: letterById('decision_request')!, profile,
                        answers: a, recipient: abh, remedy: bayern });
  const m = buildMailto('abh@m.de', out);
  check('mailto built', m.href.startsWith('mailto:abh%40m.de?subject='));
  check('plaintext has subject',
        renderPlainText(out).includes('Betreff: Sachstandsanfrage'));
}

console.log(failures === 0 ? '\nALL OK' : `\n${failures} FAILURES`);
mock.timers.reset();
process.exit(failures === 0 ? 0 : 1);
