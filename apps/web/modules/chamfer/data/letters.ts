/**
 * Letter catalog — nationwide, recipient-agnostic.
 *
 * Derived from the 7 letter types of deutschlandtogether.github.io but
 * redesigned (docs/LEGAL-REVISION.md):
 *  - recipients are NEVER hardcoded — resolved via Taper
 *    (api.sntiq.com) from the user's place (data/recipients.ts);
 *  - the old "Untaetigkeitsklage" template was actually a Mahnung mit
 *    Fristsetzung — split into `mahnung_fristsetzung` (letter to the
 *    ABH) and `untaetigkeitsklage` (lawsuit to the VG, hard-gated);
 *  - new: `widerspruch_aufenthg` (only in Länder where the remedy
 *    exists — data/remedies.ts), `aufsichtsbeschwerde` (supervisory
 *    complaint, addressed via the Taper supervision edges, rank 1);
 *  - every letter declares preconditions; the wizard MUST NOT render a
 *    compose form while a hard gate is unmet. Soft gates render as
 *    mandatory interstitials the user has to acknowledge.
 *
 * Channel policy (LEGAL-REVISION §8): all letters carry
 * `channelPolicy` — UI shows "fax / tracked letter first, e-mail only
 * as supplementary notice" next to every send action.
 */

/** profile fields are collected once (name, surname, dob, address …) */
export type LetterField =
  /** date the § 24 (or other) application was filed */
  | 'applicationDate'
  /** date of the oral refusal at the counter */
  | 'oralRefusalDate'
  /** deadline the user set in a prior Mahnung */
  | 'mahnungDeadline'
  /** date of the Bescheid being contested */
  | 'bescheidDate'
  /** Effective date of notification, separately from the printed decision date. */
  | 'notificationDate'
  /** file number (Aktenzeichen / Geschäftszeichen), if known */
  | 'aktenzeichen'
  /** date of the authority letter that triggered translation costs */
  | 'authorityLetterDate'
  /** date of an earlier Sachstandsanfrage (referenced by the Mahnung) */
  | 'inquiryDate'
  /** expiry date of the last Fiktionsbescheinigung (renewal case) */
  | 'fiktionExpiry';

/** who the letter goes to — resolved per place via Taper */
export type RecipientKind =
  | 'auslaenderbehoerde'
  /** Sozialamt or dedicated AsylbLG office — resolver decides */
  | 'asylblg_traeger'
  /** Jobcenter (SGB II) — e.g. translation costs, § 21 Abs. 6 SGB II */
  | 'jobcenter'
  | 'verwaltungsgericht'
  /** supervisory authority of the ABH (Taper edge, rank 1) */
  | 'aufsichtsbehoerde'
  /** BAMF incl. its Datenschutzbeauftragter — static address */
  | 'bamf'
  /** user picks which authority (ABH / AsylbLG / manual) in the wizard */
  | 'any_authority';

/** user-checkable confirmations (i18n keys under gate.confirm.*) */
export type GateConfirmation =
  /** written application demonstrably filed (copy/receipt/fax report) */
  | 'application_provable'
  /** Mahnung mit Fristsetzung sent and the deadline expired */
  | 'mahnung_sent_expired'
  /** ≥ basic evidence of residence in Ukraine / legal prerequisites */
  | 'has_basic_evidence'
  /** counseling obtained or at least sought (Flüchtlingsrat, RA …) */
  | 'counseling_sought'
  /** user read the contested-law interstitial (courts decide both ways) */
  | 'contested_law_understood';

export interface LetterGate {
  /** all must be checked before the compose form unlocks */
  confirmations?: GateConfirmation[];
  /**
   * months that must have elapsed since `sinceField` before the letter
   * is appropriate (e.g. § 75 VwGO: 3 months). The wizard computes it
   * from the entered date and blocks early filing with an explanation
   * (hard) or warns (soft).
   */
  minWait?: { sinceField: LetterField; months: number; hard: boolean };
  /**
   * per-Land remedy gating (data/remedies.ts):
   *  - 'widerspruch_exists'  → only offered where status is
   *    'widerspruch' (confirmed) or 'mixed' (then with double-path
   *    warning);
   *  - 'never_in_direct_klage' → hidden where status is 'direct_klage'
   *    (confirmed).
   */
  remedy?: 'widerspruch_exists';
  /** mandatory interstitial screen (i18n key) before the form */
  interstitialKey?: string;
}

/**
 * Follow-up questions that drive the dynamic template blocks
 * (engine/compose.ts) and gating (engine/gating.ts). Flag/choice ids
 * are typed in engine/logic.ts; i18n keys under q.*.
 */
export type LetterQuestion =
  | { kind: 'flag'; id: string; labelKey: string;
      /** show only when another choice has this value */
      whenChoice?: { id: string; value: string } }
  | { kind: 'choice'; id: string; labelKey: string;
      options: { value: string; labelKey: string }[] };

export interface LetterSpec {
  id: string;
  /** i18n keys (letters.<id>.*) */
  titleKey: string;
  descriptionKey: string;
  recipient: RecipientKind;
  /** per-letter fields on top of the profile fields */
  fields: LetterField[];
  optionalFields?: LetterField[];
  /** follow-up questions; answers select template blocks */
  questions?: LetterQuestion[];
  /** German subject line; {NAME} {SURNAME} {DOB} {AZ} placeholders */
  subject: string;
  gate?: LetterGate;
  /**
   * 'letter'  → DIN 5008 letter (PDF service template `letter`)
   * 'lawsuit' → court filing layout (template `lawsuit`, 3 copies hint)
   */
  layout: 'letter' | 'lawsuit';
}

/** shared "why is it urgent" question — selects an urgency paragraph */
const URGENCY_QUESTION: LetterQuestion = {
  kind: 'choice',
  id: 'urgencyReason',
  labelKey: 'q.urgencyReason',
  options: [
    { value: 'none', labelKey: 'q.urgencyReason.none' },
    { value: 'job', labelKey: 'q.urgencyReason.job' },
    { value: 'benefits', labelKey: 'q.urgencyReason.benefits' },
    { value: 'housing', labelKey: 'q.urgencyReason.housing' },
  ],
};

export const LETTERS: LetterSpec[] = [
  {
    id: 'fiktion_demand',
    titleKey: 'letters.fiktion_demand.title',
    descriptionKey: 'letters.fiktion_demand.description',
    recipient: 'auslaenderbehoerde',
    fields: ['applicationDate'],
    optionalFields: ['aktenzeichen', 'fiktionExpiry'],
    questions: [
      {
        kind: 'choice',
        id: 'fiktionSituation',
        labelKey: 'q.fiktionSituation',
        options: [
          { value: 'never_issued',
            labelKey: 'q.fiktionSituation.never' },
          { value: 'expired',
            labelKey: 'q.fiktionSituation.expired' },
        ],
      },
      URGENCY_QUESTION,
    ],
    subject:
      'Antrag auf Ausstellung einer Fiktionsbescheinigung (§ 81 Abs. 5 ' +
      'AufenthG) – {NAME} {SURNAME}, geb. {DOB}',
    layout: 'letter',
  },
  {
    id: 'decision_request',
    titleKey: 'letters.decision_request.title',
    descriptionKey: 'letters.decision_request.description',
    recipient: 'auslaenderbehoerde',
    fields: ['applicationDate'],
    optionalFields: ['aktenzeichen'],
    questions: [URGENCY_QUESTION],
    subject:
      'Sachstandsanfrage und Bitte um Bescheidung meines Antrags nach ' +
      '§ 24 AufenthG – {NAME} {SURNAME}, geb. {DOB}',
    layout: 'letter',
  },
  {
    id: 'oral_refusal',
    titleKey: 'letters.oral_refusal.title',
    descriptionKey: 'letters.oral_refusal.description',
    recipient: 'auslaenderbehoerde',
    // date is optional: not everyone remembers it; the template degrades
    fields: [],
    optionalFields: ['oralRefusalDate'],
    questions: [
      {
        kind: 'choice',
        id: 'oralRefusalKind',
        labelKey: 'q.oralRefusalKind',
        options: [
          { value: 'refused_to_accept',
            labelKey: 'q.oralRefusalKind.refusedToAccept' },
          { value: 'announced_rejection',
            labelKey: 'q.oralRefusalKind.announcedRejection' },
        ],
      },
    ],
    subject:
      'Aufforderung zur schriftlichen Bescheidung mit ' +
      'Rechtsbehelfsbelehrung – {NAME} {SURNAME}, geb. {DOB}',
    layout: 'letter',
  },
  {
    id: 'eat_demand',
    titleKey: 'letters.eat_demand.title',
    descriptionKey: 'letters.eat_demand.description',
    recipient: 'auslaenderbehoerde',
    fields: [],
    optionalFields: ['aktenzeichen'],
    subject:
      'Antrag auf Ausstellung des elektronischen Aufenthaltstitels ' +
      '(eAT) – {NAME} {SURNAME}, geb. {DOB}',
    layout: 'letter',
  },
  {
    id: 'mahnung_fristsetzung',
    titleKey: 'letters.mahnung_fristsetzung.title',
    descriptionKey: 'letters.mahnung_fristsetzung.description',
    recipient: 'auslaenderbehoerde',
    fields: ['applicationDate', 'mahnungDeadline'],
    optionalFields: ['aktenzeichen', 'inquiryDate'],
    questions: [
      { kind: 'flag', id: 'priorInquirySent',
        labelKey: 'q.priorInquirySent' },
      { kind: 'flag', id: 'fiktionAlsoMissing',
        labelKey: 'q.fiktionAlsoMissing' },
    ],
    subject:
      'Erinnerung und Fristsetzung – Antrag nach § 24 AufenthG vom ' +
      '{APPLICATION_DATE} – {NAME} {SURNAME}, geb. {DOB}',
    gate: {
      confirmations: ['application_provable'],
    },
    layout: 'letter',
  },
  {
    id: 'new_application',
    titleKey: 'letters.new_application.title',
    descriptionKey: 'letters.new_application.description',
    recipient: 'auslaenderbehoerde',
    fields: ['applicationDate'],
    questions: [
      {
        // scenario matrix LEGAL-REVISION §2 — gating hard-stops the
        // title_elsewhere / renounced_elsewhere branches (counseling only)
        kind: 'choice',
        id: 'reapplyScenario',
        labelKey: 'q.reapplyScenario',
        options: [
          { value: 'german_verzicht',
            labelKey: 'q.reapplyScenario.germanVerzicht' },
          { value: 'third_country_stay',
            labelKey: 'q.reapplyScenario.thirdCountryStay' },
          { value: 'applied_elsewhere',
            labelKey: 'q.reapplyScenario.appliedElsewhere' },
          { value: 'title_elsewhere',
            labelKey: 'q.reapplyScenario.titleElsewhere' },
          { value: 'renounced_elsewhere',
            labelKey: 'q.reapplyScenario.renouncedElsewhere' },
        ],
      },
    ],
    subject:
      'Erneuter Antrag auf Erteilung einer Aufenthaltserlaubnis nach ' +
      '§ 24 AufenthG – {NAME} {SURNAME}, geb. {DOB}',
    gate: {
      // contested law: scenario matrix LEGAL-REVISION §2 — the
      // interstitial walks the 5 scenarios; counseling is the rule here
      confirmations: ['contested_law_understood', 'counseling_sought'],
      interstitialKey: 'interstitials.reapplication_scenarios',
    },
    layout: 'letter',
  },
  {
    id: 'translation_costs',
    titleKey: 'letters.translation_costs.title',
    descriptionKey: 'letters.translation_costs.description',
    // default for the AsylbLG branch — the wizard resolves 'jobcenter'
    // instead when benefitRegime === 'sgb2' (the § 21 Abs. 6 SGB II
    // claim goes to the Jobcenter, not the Sozialamt)
    recipient: 'asylblg_traeger',
    fields: ['authorityLetterDate'],
    questions: [
      {
        // decides the legal basis cited: § 6 Abs. 1 AsylbLG vs.
        // Mehrbedarf § 21 Abs. 6 SGB II
        kind: 'choice',
        id: 'benefitRegime',
        labelKey: 'q.benefitRegime',
        options: [
          { value: 'asylblg', labelKey: 'q.benefitRegime.asylblg' },
          { value: 'sgb2', labelKey: 'q.benefitRegime.sgb2' },
        ],
      },
    ],
    subject:
      'Antrag auf Kostenübernahme für Übersetzungen – {NAME} {SURNAME}, ' +
      'geb. {DOB}',
    layout: 'letter',
  },
  {
    id: 'aufsichtsbeschwerde',
    titleKey: 'letters.aufsichtsbeschwerde.title',
    descriptionKey: 'letters.aufsichtsbeschwerde.description',
    recipient: 'aufsichtsbehoerde',
    fields: ['applicationDate'],
    optionalFields: ['aktenzeichen', 'mahnungDeadline'],
    questions: [
      { kind: 'flag', id: 'fiktionAlsoMissing',
        labelKey: 'q.fiktionAlsoMissing' },
    ],
    subject:
      'Fachaufsichtsbeschwerde wegen Untätigkeit der Ausländerbehörde – ' +
      '{NAME} {SURNAME}, geb. {DOB}',
    gate: {
      // escalation, not first move: a reminder must have gone unanswered
      confirmations: ['application_provable', 'mahnung_sent_expired'],
    },
    layout: 'letter',
  },
  {
    id: 'widerspruch_aufenthg',
    titleKey: 'letters.widerspruch_aufenthg.title',
    descriptionKey: 'letters.widerspruch_aufenthg.description',
    recipient: 'auslaenderbehoerde',
    fields: ['bescheidDate'],
    optionalFields: ['notificationDate', 'aktenzeichen'],
    questions: [
      { kind: 'choice', id: 'appealInstruction', labelKey: 'tree.bescheidBelehrung',
        options: [
          { value: 'proper', labelKey: 'tree.belehrung.yes' },
          { value: 'missing_or_wrong', labelKey: 'tree.belehrung.missing' },
          { value: 'unknown', labelKey: 'tree.belehrung.unknown' },
        ] },
    ],
    subject:
      'Widerspruch gegen den Bescheid vom {BESCHEID_DATE} – {NAME} ' +
      '{SURNAME}, geb. {DOB}{AZ}',
    gate: {
      remedy: 'widerspruch_exists',
      interstitialKey: 'interstitials.widerspruch_deadline',
    },
    layout: 'letter',
  },
  {
    // file access at the BAMF (Asylakte) — lawyer-vetted wording,
    // condensed from the org's working template (docs/LEGAL-REVISION)
    id: 'dsgvo_bamf',
    titleKey: 'letters.dsgvo_bamf.title',
    descriptionKey: 'letters.dsgvo_bamf.description',
    recipient: 'bamf',
    fields: [],
    optionalFields: ['aktenzeichen'],
    questions: [
      { kind: 'flag', id: 'repeatRequest',
        labelKey: 'q.repeatRequest' },
    ],
    subject:
      'Antrag auf Akteneinsicht gemäß Art. 15 DSGVO – {NAME} {SURNAME}, ' +
      'geb. {DOB}{AZ}',
    layout: 'letter',
  },
  {
    // cumulative Akteneinsicht (VwVfG, Land-aware citation) + Art. 15
    // DSGVO copy — explicitly asks for redactions over full refusal
    id: 'dsgvo_behoerde',
    titleKey: 'letters.dsgvo_behoerde.title',
    descriptionKey: 'letters.dsgvo_behoerde.description',
    recipient: 'any_authority',
    fields: [],
    optionalFields: ['aktenzeichen'],
    subject:
      'Kumulativer Antrag auf Akteneinsicht ({VWVFG_REF}) sowie Auskunft ' +
      'und Kopie nach Art. 15 DSGVO – {NAME} {SURNAME}, geb. {DOB}{AZ}',
    layout: 'letter',
  },
  {
    id: 'untaetigkeitsklage',
    titleKey: 'letters.untaetigkeitsklage.title',
    descriptionKey: 'letters.untaetigkeitsklage.description',
    recipient: 'verwaltungsgericht',
    fields: ['applicationDate', 'mahnungDeadline'],
    optionalFields: ['aktenzeichen'],
    questions: [
      { kind: 'flag', id: 'fiktionAlsoMissing',
        labelKey: 'q.fiktionAlsoMissing' },
    ],
    subject:
      'Untätigkeitsklage (§ 75 VwGO) – {NAME} {SURNAME}, geb. {DOB}',
    gate: {
      // last resort — every condition is hard (LEGAL-REVISION §3)
      confirmations: [
        'application_provable',
        'mahnung_sent_expired',
        'has_basic_evidence',
      ],
      minWait: { sinceField: 'applicationDate', months: 3, hard: true },
      interstitialKey: 'interstitials.lawsuit_last_resort',
    },
    layout: 'lawsuit',
  },
];

export const letterById = (id: string): LetterSpec | undefined =>
  LETTERS.find((l) => l.id === id);

/** catalog groups for the wizard's letter chooser */
export const LETTER_GROUPS: { titleKey: string; ids: string[] }[] = [
  {
    titleKey: 'groups.waiting',
    ids: ['fiktion_demand', 'decision_request', 'mahnung_fristsetzung'],
  },
  {
    titleKey: 'groups.refused',
    ids: ['oral_refusal', 'widerspruch_aufenthg', 'new_application'],
  },
  {
    titleKey: 'groups.documents',
    ids: ['eat_demand', 'translation_costs'],
  },
  {
    titleKey: 'groups.escalation',
    ids: ['aufsichtsbeschwerde', 'untaetigkeitsklage'],
  },
  {
    titleKey: 'groups.data',
    ids: ['dsgvo_bamf', 'dsgvo_behoerde'],
  },
];
