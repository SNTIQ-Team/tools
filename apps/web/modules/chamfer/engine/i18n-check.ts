/**
 * i18n integrity check — run with
 * `npx tsx modules/chamfer/engine/i18n-check.ts`.
 *
 * 1. Key parity: de/ru/ua must have exactly the EN key set (flattened).
 * 2. Reference check: every i18n key referenced from data/letters.ts,
 *    data/decision-tree.ts and the engine (gate.*, send.*) must exist.
 * Exits non-zero on any failure. Not imported by the app.
 */

import { en } from '../i18n/en';
import { de } from '../i18n/de';
import { ru } from '../i18n/ru';
import { ua } from '../i18n/ua';
import { LETTERS } from '../data/letters';
import { TREE } from '../data/decision-tree';

type Tree = Record<string, unknown>;

function flatten(obj: Tree, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) => {
    const key = prefix ? `${prefix}.${k}` : k;
    return typeof v === 'object' && v !== null
      ? flatten(v as Tree, key)
      : [key];
  });
}

let failures = 0;
const fail = (msg: string) => { failures += 1; console.error(`FAIL ${msg}`); };

// ------------------------------------------------------------- parity
const base = new Set(flatten(en as unknown as Tree));
for (const [name, loc] of [['de', de], ['ru', ru], ['ua', ua]] as const) {
  const keys = new Set(flatten(loc as unknown as Tree));
  for (const k of base) if (!keys.has(k)) fail(`${name}: missing key ${k}`);
  for (const k of keys) if (!base.has(k)) fail(`${name}: extra key ${k}`);
}
console.log(`ok   parity (${base.size} keys × 4 locales)`);

// --------------------------------------------------------- references
const has = (k: string) => base.has(k);
const ref = (k: string, from: string) => {
  if (!has(k)) fail(`missing referenced key ${k} (from ${from})`);
};

for (const l of LETTERS) {
  ref(l.titleKey, l.id);
  ref(l.descriptionKey, l.id);
  for (const q of l.questions ?? []) {
    ref(q.labelKey, l.id);
    if (q.kind === 'choice') for (const o of q.options) ref(o.labelKey, l.id);
  }
  for (const c of l.gate?.confirmations ?? []) {
    ref(`gate.confirm.${c}`, l.id);
  }
  if (l.gate?.interstitialKey) {
    ref(`${l.gate.interstitialKey}.title`, l.id);
    ref(`${l.gate.interstitialKey}.body`, l.id);
  }
}

for (const n of TREE) {
  if (n.kind === 'question') {
    ref(n.questionKey, n.id);
    for (const o of n.options) ref(o.labelKey, n.id);
  } else {
    ref(n.guideKey, n.id);
    for (const k of n.noteKeys ?? []) ref(k, n.id);
  }
}

// gate issue keys emitted by engine/gating.ts
for (const k of [
  'gate.date.required', 'gate.minWait', 'gate.remedy.absent',
  'gate.remedy.verify', 'gate.deadline.passed', 'gate.deadline.oneMonth',
  'gate.deadline.yearRule', 'gate.mahnung.notExpired',
  'gate.scenario.required', 'gate.scenario.titleElsewhere',
  'gate.scenario.renounced', 'gate.regimeRequired', 'gate.deadline.invalidNotification',
  'gate.deadline.unknownInstruction', 'gate.deadline.unknownNotification', 'gate.deadline.unknownCalendar',
]) ref(k, 'gating.ts');

// send hints emitted by engine/compose.ts
for (const k of ['send.letter.title', 'send.letter.body',
                 'send.lawsuit.title', 'send.lawsuit.body']) {
  ref(k, 'compose.ts');
}

console.log(failures === 0 ? 'ALL OK' : `${failures} FAILURES`);
process.exit(failures === 0 ? 0 : 1);
