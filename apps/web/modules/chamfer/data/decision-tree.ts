/**
 * Triage decision tree: situation → questions → recommended letters.
 *
 * The tree is deliberately static data — every branch is reviewable by
 * a lawyer without reading code. Dynamic facts hook in two ways:
 *  - `autoAnswer`: the wizard answers a question itself when it already
 *    knows the fact (e.g. months since applicationDate);
 *  - `remedyBranch` on an outcome: the UI consults remedies.ts for the
 *    user's Land and renders the Widerspruch path, the direct-Klage
 *    path, or the conservative double path (LEGAL-REVISION §4).
 *
 * Outcomes RECOMMEND letters; gating (engine/gating.ts) still decides
 * whether each letter may actually be composed. The tree never bypasses
 * a gate.
 */

export interface TreeOption {
  /** i18n key under tree.* */
  labelKey: string;
  next: string;
  /**
   * Answers this option pre-selects (applied when a letter opens) —
   * the user never re-answers in the form what the tree already
   * asked. Ids/values must match engine/logic.ts ChoiceId/FlagId.
   */
  preset?: {
    choices?: Record<string, string>;
    flags?: Record<string, boolean>;
  };
}

export type AutoAnswer =
  /** answer from monthsSince(applicationDate) >= 3 → yes/no option index */
  | { kind: 'monthsSinceApplication'; atLeast: number };

export interface QuestionNode {
  id: string;
  kind: 'question';
  questionKey: string;
  options: TreeOption[];
  /** wizard may answer this question itself; options[0]=yes, [1]=no */
  autoAnswer?: AutoAnswer;
}

export interface OutcomeNode {
  id: string;
  kind: 'outcome';
  /** letter ids in recommendation order (see data/letters.ts) */
  letters: string[];
  /** i18n key of the outcome explanation */
  guideKey: string;
  /** deadline-critical outcomes render a loud banner */
  urgency: 'deadline' | 'high' | 'normal';
  /** extra notes (i18n keys), e.g. channel policy, evidence reminders */
  noteKeys?: string[];
  /** consult remedies.ts for the user's Land before rendering paths */
  remedyBranch?: boolean;
  /** counseling strongly advised before any generated letter */
  counseling?: boolean;
}

export type TreeNode = QuestionNode | OutcomeNode;

export const TREE_ROOT = 'root';

export const TREE: TreeNode[] = [
  // --------------------------------------------- area of law first
  {
    id: 'root',
    kind: 'question',
    questionKey: 'tree.rootArea',
    options: [
      { labelKey: 'tree.area.aufenthalt', next: 'aufenthalt_root' },
      { labelKey: 'tree.area.social', next: 'benefits_regime' },
      { labelKey: 'tree.area.data', next: 'data_kind' },
      { labelKey: 'tree.area.other', next: 'o_browse' },
    ],
  },

  // ------------------------------------------ residence-law triage
  {
    id: 'aufenthalt_root',
    kind: 'question',
    questionKey: 'tree.root',
    options: [
      { labelKey: 'tree.root.waiting', next: 'waiting_fiktion' },
      { labelKey: 'tree.root.oralRefusal', next: 'oral_kind' },
      { labelKey: 'tree.root.writtenBescheid', next: 'bescheid_belehrung' },
      { labelKey: 'tree.root.duldungVerzicht', next: 'reapply_scenario' },
      { labelKey: 'tree.root.noEat', next: 'o_eat' },
      { labelKey: 'tree.root.complaint', next: 'o_aufsicht' },
    ],
  },

  // --------------------------------------------- data-access triage
  {
    id: 'data_kind',
    kind: 'question',
    questionKey: 'tree.dataKind',
    options: [
      { labelKey: 'tree.data.bamf', next: 'o_dsgvo_bamf' },
      { labelKey: 'tree.data.other', next: 'o_dsgvo_other' },
    ],
  },

  // ------------------------------------------------- oral refusal kind
  {
    id: 'oral_kind',
    kind: 'question',
    questionKey: 'q.oralRefusalKind',
    options: [
      { labelKey: 'q.oralRefusalKind.refusedToAccept', next: 'o_oral',
        preset: { choices: { oralRefusalKind: 'refused_to_accept' } } },
      { labelKey: 'q.oralRefusalKind.announcedRejection', next: 'o_oral',
        preset: { choices: { oralRefusalKind: 'announced_rejection' } } },
    ],
  },

  // ----------------------------------- written Bescheid: Belehrung?
  {
    id: 'bescheid_belehrung',
    kind: 'question',
    questionKey: 'tree.bescheidBelehrung',
    options: [
      { labelKey: 'tree.belehrung.yes', next: 'o_bescheid',
        preset: { choices: { appealInstruction: 'proper' } } },
      { labelKey: 'tree.belehrung.missing', next: 'o_bescheid',
        preset: { choices: { appealInstruction: 'missing_or_wrong' } } },
      { labelKey: 'tree.belehrung.unknown', next: 'o_bescheid',
        preset: { choices: { appealInstruction: 'unknown' } } },
    ],
  },

  // -------------------------------------------- benefits: which regime
  {
    id: 'benefits_regime',
    kind: 'question',
    questionKey: 'tree.benefitsRegime',
    options: [
      { labelKey: 'tree.regime.sozialamt', next: 'o_translation',
        preset: { choices: { benefitRegime: 'asylblg' } } },
      { labelKey: 'tree.regime.jobcenter', next: 'o_translation',
        preset: { choices: { benefitRegime: 'sgb2' } } },
      { labelKey: 'tree.regime.unknown', next: 'o_translation_unsure' },
    ],
  },

  // ------------------------------- Duldung/Verzicht: which scenario
  {
    id: 'reapply_scenario',
    kind: 'question',
    questionKey: 'q.reapplyScenario',
    options: [
      { labelKey: 'q.reapplyScenario.germanVerzicht', next: 'o_reapply',
        preset: { choices: { reapplyScenario: 'german_verzicht' } } },
      { labelKey: 'q.reapplyScenario.thirdCountryStay', next: 'o_reapply',
        preset: { choices: { reapplyScenario: 'third_country_stay' } } },
      { labelKey: 'q.reapplyScenario.appliedElsewhere', next: 'o_reapply',
        preset: { choices: { reapplyScenario: 'applied_elsewhere' } } },
      { labelKey: 'q.reapplyScenario.titleElsewhere',
        next: 'o_counsel_title' },
      { labelKey: 'q.reapplyScenario.renouncedElsewhere',
        next: 'o_counsel_renounced' },
      { labelKey: 'tree.scenario.unsure', next: 'o_reapply' },
    ],
  },

  // -------------------------------------------- waiting for decision
  {
    id: 'waiting_fiktion',
    kind: 'question',
    questionKey: 'tree.waitingFiktion',
    options: [
      // no valid Fiktion → that is the acute problem, fix it first
      { labelKey: 'tree.no', next: 'o_fiktion' },
      { labelKey: 'tree.yes', next: 'waiting_3months' },
    ],
  },
  {
    id: 'waiting_3months',
    kind: 'question',
    questionKey: 'tree.waiting3Months',
    autoAnswer: { kind: 'monthsSinceApplication', atLeast: 3 },
    options: [
      { labelKey: 'tree.yes', next: 'waiting_mahnung' },
      { labelKey: 'tree.no', next: 'o_status' },
    ],
  },
  {
    id: 'waiting_mahnung',
    kind: 'question',
    questionKey: 'tree.waitingMahnung',
    options: [
      { labelKey: 'tree.mahnung.notSent', next: 'o_mahnung' },
      { labelKey: 'tree.mahnung.sentExpired', next: 'o_escalate',
        preset: { flags: { priorInquirySent: true } } },
      { labelKey: 'tree.mahnung.sentWaiting', next: 'o_wait_mahnung' },
      // no response / no access, but no Mahnung sent yet: the Mahnung
      // is the reachable next step (fax/Einschreiben needs no personal
      // access) — o_escalate would dead-end on its 'mahnung_sent_expired'
      // gate and tempt a false factual assertion in the complaint
      { labelKey: 'tree.mahnung.unreachable', next: 'o_mahnung' },
    ],
  },

  // ------------------------------------------------------- outcomes
  {
    id: 'o_fiktion',
    kind: 'outcome',
    letters: ['fiktion_demand', 'decision_request'],
    guideKey: 'tree.out.fiktion',
    urgency: 'high',
    noteKeys: ['notes.channel'],
  },
  {
    id: 'o_status',
    kind: 'outcome',
    letters: ['decision_request'],
    guideKey: 'tree.out.status',
    urgency: 'normal',
    noteKeys: ['notes.channel', 'notes.document'],
  },
  {
    id: 'o_mahnung',
    kind: 'outcome',
    letters: ['mahnung_fristsetzung'],
    guideKey: 'tree.out.mahnung',
    urgency: 'normal',
    noteKeys: ['notes.channel', 'notes.document'],
  },
  {
    id: 'o_wait_mahnung',
    kind: 'outcome',
    letters: [],
    guideKey: 'tree.out.waitMahnung',
    urgency: 'normal',
    noteKeys: ['notes.document'],
  },
  {
    id: 'o_escalate',
    kind: 'outcome',
    // softer first: supervisory complaint costs nothing and often
    // unblocks; the lawsuit stays available behind its hard gate
    letters: ['aufsichtsbeschwerde', 'untaetigkeitsklage'],
    guideKey: 'tree.out.escalate',
    urgency: 'high',
    counseling: true,
    noteKeys: ['notes.channel', 'notes.lawsuitLast'],
  },
  {
    id: 'o_oral',
    kind: 'outcome',
    letters: ['oral_refusal'],
    guideKey: 'tree.out.oral',
    urgency: 'high',
    noteKeys: ['notes.channel', 'notes.witness'],
  },
  {
    id: 'o_bescheid',
    kind: 'outcome',
    letters: ['widerspruch_aufenthg'],
    guideKey: 'tree.out.bescheid',
    urgency: 'deadline',
    remedyBranch: true,
    counseling: true,
    noteKeys: ['notes.deadlineOneMonth',
               'notes.channel'],
  },
  {
    id: 'o_reapply',
    kind: 'outcome',
    letters: ['new_application'],
    guideKey: 'tree.out.reapply',
    urgency: 'high',
    counseling: true,
    noteKeys: ['notes.scenarioMatters',
               'notes.channel'],
  },
  {
    id: 'o_eat',
    kind: 'outcome',
    letters: ['eat_demand'],
    guideKey: 'tree.out.eat',
    urgency: 'normal',
    noteKeys: ['notes.channel'],
  },
  {
    id: 'o_translation',
    kind: 'outcome',
    letters: ['translation_costs'],
    guideKey: 'tree.out.translation',
    urgency: 'normal',
    noteKeys: ['notes.rechtskreiswechsel',
               'notes.channel'],
  },
  {
    id: 'o_translation_unsure',
    kind: 'outcome',
    letters: ['translation_costs'],
    guideKey: 'tree.out.translation',
    urgency: 'normal',
    noteKeys: ['notes.regimeHowTell', 'notes.rechtskreiswechsel',
               'notes.channel'],
  },
  {
    // valid title in another EU state: rejection likely (BMI/recital 4
    // of (EU) 2025/1460); binding force under EU law is an OPEN question
    // — counseling outcome, no generated letter (LEGAL-REVISION §2 #3)
    id: 'o_counsel_title',
    kind: 'outcome',
    letters: [],
    guideKey: 'tree.out.counselTitle',
    urgency: 'high',
    counseling: true,
    noteKeys: ['notes.document'],
  },
  {
    // formal renunciation abroad: abuse-of-rights line (BayVGH
    // 19 ZB 25.898) — lawyer-only path (LEGAL-REVISION §2 #4)
    id: 'o_counsel_renounced',
    kind: 'outcome',
    letters: [],
    guideKey: 'tree.out.counselRenounced',
    urgency: 'high',
    counseling: true,
    noteKeys: ['notes.document'],
  },
  {
    // direct path to the supervisory complaint (also reachable via the
    // waiting branch — this entry serves users who come for it directly)
    id: 'o_aufsicht',
    kind: 'outcome',
    letters: ['aufsichtsbeschwerde'],
    guideKey: 'tree.out.aufsicht',
    urgency: 'normal',
    noteKeys: ['notes.channel', 'notes.document'],
  },
  {
    id: 'o_dsgvo_bamf',
    kind: 'outcome',
    letters: ['dsgvo_bamf'],
    guideKey: 'tree.out.dsgvoBamf',
    urgency: 'normal',
    noteKeys: ['notes.channel'],
  },
  {
    id: 'o_dsgvo_other',
    kind: 'outcome',
    letters: ['dsgvo_behoerde'],
    guideKey: 'tree.out.dsgvoOther',
    urgency: 'normal',
    noteKeys: ['notes.channel'],
  },
  {
    // "something else" — guide to the full catalog
    id: 'o_browse',
    kind: 'outcome',
    letters: [],
    guideKey: 'tree.out.browse',
    urgency: 'normal',
  },
];

export const treeNode = (id: string): TreeNode | undefined =>
  TREE.find((n) => n.id === id);

/**
 * Static integrity check, run by tests/CI: every `next` resolves, every
 * outcome letter id exists in the catalog, no orphan nodes.
 */
export function validateTree(letterIds: string[]): string[] {
  const errors: string[] = [];
  const ids = new Set(TREE.map((n) => n.id));
  const reachable = new Set<string>([TREE_ROOT]);
  for (const n of TREE) {
    if (n.kind === 'question') {
      for (const o of n.options) {
        if (!ids.has(o.next)) {
          errors.push(`${n.id}: dangling next '${o.next}'`);
        }
        reachable.add(o.next);
      }
    } else {
      for (const l of n.letters) {
        if (!letterIds.includes(l)) {
          errors.push(`${n.id}: unknown letter '${l}'`);
        }
      }
    }
  }
  for (const n of TREE) {
    if (!reachable.has(n.id)) errors.push(`unreachable node '${n.id}'`);
  }
  return errors;
}
