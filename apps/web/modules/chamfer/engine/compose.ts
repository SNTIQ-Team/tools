/**
 * Letter assembly: LetterSpec + profile + answers + resolved recipient
 * → final German letter. The legally operative text is always German;
 * translations in the UI are explanations, never the document.
 *
 * Bodies are CONDITIONAL BLOCK LISTS, not flat strings: each paragraph
 * may declare `when(ctx)` and is included only if it matches the
 * user's answers (engine/logic.ts). This is what makes one template
 * serve e.g. "Fiktion never issued" and "Fiktion expired" without two
 * letters, and lets escalation letters reference the Mahnung only when
 * one actually exists.
 *
 * Drafting rules (docs/LEGAL-REVISION.md):
 *  - templates state the LAW and the REQUEST; disputed facts are the
 *    user's own statements and live in attachments ("lege ich in der
 *    Anlage dar"), never as boilerplate assertions;
 *  - case-law citations appear only in scenario branches where the
 *    cited line of decisions actually carries the argument (§ 7);
 *  - no NGO logo / letterhead — plain DIN 5008, discreet generator
 *    footer only (rendered by the PDF service, not part of the body);
 *  - deadlines must match what gating told the user (e.g. the
 *    Untätigkeitsklage body asserts the § 75 VwGO wait only because
 *    engine/gating.ts has already verified it).
 */

import type { LetterField, LetterSpec } from '../data/letters';
import type { AuthorityCard } from '../data/recipients';
import { contactChannels } from '../data/recipients';
import type { LandRemedy } from '../data/remedies';
import type { Answers, Ctx } from './logic';
import { formatDE, isMonthOnly, makeCtx, todayISO } from './logic';

export interface Profile {
  name: string;
  surname: string;
  /** dd.mm.yyyy (display format — entered once, never parsed) */
  dob: string;
  street: string;
  plzCity: string;
}

export interface CoApplicant {
  name: string;
  /** German relation label rendered into the letter (Ehefrau, Sohn …) */
  relation: string;
}

export interface ComposeInput {
  letter: LetterSpec;
  profile: Profile;
  answers: Answers;
  recipient: AuthorityCard;
  remedy: LandRemedy;
  /** family members the letter also speaks for (signature + mention) */
  coApplicants?: CoApplicant[];
  /** extra Anlagen lines the user added (kept generic, e.g. ID copy) */
  userAttachments?: string[];
  /** ABH the complaint/lawsuit is about (≠ recipient for escalations) */
  regardingAuthority?: string;
  /** letter date ISO, defaults to today */
  dateISO?: string;
}

export interface ComposedLetter {
  senderBlock: string[];
  recipientBlock: string[];
  date: string;
  /** sender city for the "Ort, den …" line (empty when hand-filled) */
  ort: string;
  subject: string;
  /** body paragraphs, salutation through closing — no signature name */
  body: string;
  /** name under the dotted signature line ('' → sign by hand) */
  signatureName: string;
  /** "Anlagen: …" block after the signature, if any */
  attachments?: string;
  layout: 'letter' | 'lawsuit';
  /** i18n key with sending instructions for this layout */
  sendHintKey: string;
}

interface Block {
  when?: (ctx: Ctx) => boolean;
  text: string;
}

const fill = (text: string, vars: Record<string, string>): string =>
  text.replace(/\{([A-Z_]+)\}/g, (m, k: string) => vars[k] ?? m);

// ----------------------------------------------------------- helpers

const has = (ctx: Ctx, field: LetterField) => Boolean(ctx.f(field));
const choiceIs = (ctx: Ctx, id: Parameters<Ctx['choice']>[0], v: string) =>
  ctx.choice(id) === v;
/** default branch: matches the value OR the question unanswered */
const choiceIsOrUnset = (
  ctx: Ctx, id: Parameters<Ctx['choice']>[0], v: string,
) => ctx.choice(id) === v || ctx.choice(id) === undefined;

const GRUSS = 'Sehr geehrte Damen und Herren,';
const SCHLUSS = 'Mit freundlichen Grüßen';

const MONTHS_DE = [
  'Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli',
  'August', 'September', 'Oktober', 'November', 'Dezember',
];

/** "am 12.06.2026" — or "im Juni 2026" for month-only values */
function amPhrase(v: string | undefined): string {
  if (v && isMonthOnly(v)) {
    const [y, m] = v.split('-').map(Number);
    return `im ${MONTHS_DE[m - 1]} ${y}`;
  }
  return `am ${formatDE(v)}`;
}

/** "vom 12.06.2026" — or "von Juni 2026" for month-only values */
function vomPhrase(v: string | undefined): string {
  if (v && isMonthOnly(v)) {
    const [y, m] = v.split('-').map(Number);
    return `von ${MONTHS_DE[m - 1]} ${y}`;
  }
  return `vom ${formatDE(v)}`;
}

const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ------------------------------------------------------------- bodies

const BODIES: Record<string, Block[]> = {
  // -------------------------------------------------- fiktion_demand
  fiktion_demand: [
    { text: GRUSS },
    { text: '{APPLICATION_DATE_AM} habe ich bei Ihnen einen Antrag auf ' +
            'Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG gestellt.{AZ_LINE}' },
    { when: (c) => choiceIsOrUnset(c, 'fiktionSituation', 'never_issued'),
      text: 'Eine Fiktionsbescheinigung wurde mir bisher nicht ' +
            'ausgestellt.' },
    { when: (c) => choiceIs(c, 'fiktionSituation', 'expired'),
      text: 'Die mir zuletzt ausgestellte Fiktionsbescheinigung ist ' +
            '{FIKTION_EXPIRY_CLAUSE}abgelaufen. Ohne gültige ' +
            'Bescheinigung kann ich meinen rechtmäßigen Aufenthalt ' +
            'derzeit nicht nachweisen.' },
    { text: 'Nach § 81 Abs. 5 AufenthG ist dem Antragsteller eine ' +
            'Bescheinigung über die Wirkung seiner Antragstellung ' +
            '(Fiktionsbescheinigung) auszustellen; ein Ermessen besteht ' +
            'insoweit nicht. Die Bescheinigung benötige ich zum Nachweis ' +
            'meines rechtmäßigen Aufenthalts, insbesondere gegenüber ' +
            'Leistungsbehörden und Arbeitgebern.' },
    { when: (c) => choiceIs(c, 'urgencyReason', 'job'),
      text: 'Die Angelegenheit ist eilbedürftig: Ohne den Nachweis ' +
            'meines Aufenthaltsstatus kann ich ein Arbeitsverhältnis ' +
            'nicht antreten bzw. nicht fortsetzen.' },
    { when: (c) => choiceIs(c, 'urgencyReason', 'benefits'),
      text: 'Die Angelegenheit ist eilbedürftig: Ohne den Nachweis ' +
            'meines Aufenthaltsstatus drohen mir Nachteile beim Bezug ' +
            'von Leistungen.' },
    { when: (c) => choiceIs(c, 'urgencyReason', 'housing'),
      text: 'Die Angelegenheit ist eilbedürftig: Ohne den Nachweis ' +
            'meines Aufenthaltsstatus kann ich keinen Wohnraum anmieten.' },
    { when: (c) => choiceIsOrUnset(c, 'fiktionSituation', 'never_issued'),
      text: 'Ich bitte Sie daher, mir binnen zwei Wochen nach Zugang ' +
            'dieses Schreibens eine Fiktionsbescheinigung auszustellen ' +
            'oder mir hierfür kurzfristig einen Termin zu nennen.' },
    { when: (c) => choiceIs(c, 'fiktionSituation', 'expired'),
      text: 'Ich bitte Sie daher, die Fiktionsbescheinigung binnen zwei ' +
            'Wochen nach Zugang dieses Schreibens zu verlängern bzw. neu ' +
            'auszustellen oder mir hierfür kurzfristig einen Termin zu ' +
            'nennen.' },
    { text: SCHLUSS },
  ],

  // ------------------------------------------------ decision_request
  decision_request: [
    { text: GRUSS },
    { text: '{APPLICATION_DATE_AM} habe ich bei Ihnen einen Antrag auf ' +
            'Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG gestellt.{AZ_LINE} Eine Entscheidung ist mir ' +
            'bisher nicht bekannt gegeben worden.' },
    { text: 'Ich bitte um Mitteilung des aktuellen Sachstands und um ' +
            'zeitnahe Entscheidung über meinen Antrag. Sollten aus Ihrer ' +
            'Sicht Unterlagen fehlen, bitte ich um konkrete schriftliche ' +
            'Mitteilung, welche Unterlagen dies sind.' },
    { when: (c) => choiceIs(c, 'urgencyReason', 'job'),
      text: 'Ich weise darauf hin, dass die offene Entscheidung für ' +
            'mich erhebliche Folgen hat: Ein Arbeitsverhältnis kann ohne ' +
            'geklärten Status nicht angetreten bzw. fortgesetzt werden.' },
    { when: (c) => choiceIs(c, 'urgencyReason', 'benefits'),
      text: 'Ich weise darauf hin, dass die offene Entscheidung für ' +
            'mich erhebliche Folgen beim Bezug von Leistungen hat.' },
    { when: (c) => choiceIs(c, 'urgencyReason', 'housing'),
      text: 'Ich weise darauf hin, dass die offene Entscheidung die ' +
            'Anmietung von Wohnraum für mich unmöglich macht.' },
    { text: SCHLUSS },
  ],

  // ---------------------------------------------------- oral_refusal
  oral_refusal: [
    { text: GRUSS },
    { when: (c) => choiceIsOrUnset(c, 'oralRefusalKind',
                                   'announced_rejection'),
      text: 'bei meiner persönlichen Vorsprache {ORAL_DATE_CLAUSE}' +
            'wurde mir mündlich mitgeteilt, dass meinem Antrag auf ' +
            'Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG nicht entsprochen werde. Einen schriftlichen ' +
            'Bescheid habe ich nicht erhalten.' },
    { when: (c) => choiceIsOrUnset(c, 'oralRefusalKind',
                                   'announced_rejection'),
      text: 'Ich fordere Sie auf, mir Ihre Entscheidung schriftlich, mit ' +
            'Begründung und mit Rechtsbehelfsbelehrung zuzustellen ' +
            '(§ 77 Abs. 1 AufenthG, § 39 VwVfG). Ohne schriftlichen ' +
            'Bescheid kann ich die Entscheidung nicht rechtlich ' +
            'überprüfen lassen.' },
    { when: (c) => choiceIsOrUnset(c, 'oralRefusalKind',
                                   'announced_rejection'),
      text: 'Bis zur Zustellung eines schriftlichen Bescheids gehe ich ' +
            'davon aus, dass mein Antrag weiterhin anhängig ist und ' +
            'unverändert aufrechterhalten wird.' },
    { when: (c) => choiceIs(c, 'oralRefusalKind', 'refused_to_accept'),
      text: 'bei meiner persönlichen Vorsprache {ORAL_DATE_CLAUSE}' +
            'wurde die Entgegennahme meines Antrags auf Erteilung einer ' +
            'Aufenthaltserlaubnis nach § 24 Abs. 1 AufenthG verweigert.' },
    { when: (c) => choiceIs(c, 'oralRefusalKind', 'refused_to_accept'),
      text: 'Ich weise darauf hin, dass die Behörde verpflichtet ist, ' +
            'gestellte Anträge entgegenzunehmen und zu bescheiden; eine ' +
            '„Ablehnung der Annahme" eines Antrags sieht das Gesetz ' +
            'nicht vor. Meinen Antrag übersende ich daher mit diesem ' +
            'Schreiben (erneut) in Schriftform als Anlage; er gilt mit ' +
            'Zugang dieses Schreibens als gestellt.' },
    { when: (c) => choiceIs(c, 'oralRefusalKind', 'refused_to_accept'),
      text: 'Ich bitte um schriftliche Eingangsbestätigung sowie um ' +
            'Ausstellung einer Fiktionsbescheinigung nach § 81 Abs. 5 ' +
            'AufenthG. Sollte der Antrag abgelehnt werden, bitte ich um ' +
            'einen schriftlichen Bescheid mit Begründung und ' +
            'Rechtsbehelfsbelehrung.' },
    { text: SCHLUSS },
  ],

  // ------------------------------------------------------ eat_demand
  eat_demand: [
    { text: GRUSS },
    { text: 'mir wurde eine Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG erteilt.{AZ_LINE} Ein elektronischer ' +
            'Aufenthaltstitel (eAT) wurde mir jedoch bisher nicht ' +
            'ausgestellt.' },
    { text: 'Nach § 78 Abs. 1 AufenthG werden Aufenthaltstitel als ' +
            'Dokumente mit elektronischem Speicher- und ' +
            'Verarbeitungsmedium ausgestellt. Ich beantrage daher die ' +
            'Ausstellung des eAT und bitte um kurzfristige Mitteilung ' +
            'eines Termins zur Abgabe der biometrischen Daten, soweit ' +
            'diese noch erforderlich sind.' },
    { text: SCHLUSS },
  ],

  // -------------------------------------------- mahnung_fristsetzung
  mahnung_fristsetzung: [
    { text: GRUSS },
    { text: '{APPLICATION_DATE_AM} habe ich bei Ihnen einen Antrag auf ' +
            'Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG gestellt.{AZ_LINE} Eine Entscheidung liegt nicht ' +
            'vor; ein zureichender Grund für die Verzögerung wurde mir ' +
            'nicht mitgeteilt.' },
    { when: (c) => c.flag('priorInquirySent') && has(c, 'inquiryDate'),
      text: 'Bereits mit Schreiben vom {INQUIRY_DATE} habe ich um ' +
            'Mitteilung des Sachstands gebeten; eine Antwort habe ich ' +
            'nicht erhalten.' },
    { when: (c) => c.flag('priorInquirySent') && !has(c, 'inquiryDate'),
      text: 'Bereits zuvor habe ich um Mitteilung des Sachstands ' +
            'gebeten; eine Antwort habe ich nicht erhalten.' },
    { when: (c) => c.flag('fiktionAlsoMissing'),
      text: 'Auch eine Fiktionsbescheinigung nach § 81 Abs. 5 AufenthG ' +
            'wurde mir bisher nicht ausgestellt. Ich fordere Sie auf, ' +
            'dies unabhängig von der Entscheidung über den Antrag ' +
            'unverzüglich nachzuholen.' },
    { text: 'Ich erinnere an meinen Antrag und setze Ihnen hiermit eine ' +
            'Frist zur Entscheidung bis zum {MAHNUNG_DEADLINE}.' },
    { when: (c) => (c.monthsSince('applicationDate') ?? 0) >= 3,
      text: 'Ich weise darauf hin, dass die Dreimonatsfrist des § 75 ' +
            'VwGO bereits verstrichen ist. Sollte bis zum genannten Tag ' +
            'keine Entscheidung ergehen und mir auch kein zureichender ' +
            'Grund für die Verzögerung mitgeteilt werden, behalte ich ' +
            'mir die Erhebung einer Untätigkeitsklage ausdrücklich vor.' },
    { when: (c) => (c.monthsSince('applicationDate') ?? 0) < 3,
      text: 'Sollte bis zu diesem Tag keine Entscheidung ergehen und ' +
            'mir auch kein zureichender Grund für die Verzögerung ' +
            'mitgeteilt werden, werde ich weitere rechtliche Schritte ' +
            'prüfen. Ich weise darauf hin, dass eine Untätigkeitsklage ' +
            'nach § 75 VwGO grundsätzlich zulässig ist, wenn über einen ' +
            'Antrag ohne zureichenden Grund nicht binnen drei Monaten ' +
            'entschieden wurde.' },
    { text: SCHLUSS },
  ],

  // ------------------------------------------------- new_application
  new_application: [
    { text: GRUSS },
    { text: 'hiermit beantrage ich die Erteilung einer ' +
            'Aufenthaltserlaubnis nach § 24 Abs. 1 AufenthG in ' +
            'Verbindung mit dem Durchführungsbeschluss (EU) 2022/382 ' +
            'des Rates (vorübergehender Schutz, verlängert bis zum ' +
            '4. März 2027).' },
    { text: 'Einen entsprechenden Antrag hatte ich bereits ' +
            '{APPLICATION_DATE_AM} gestellt.{AZ_LINE}' },
    { when: (c) => choiceIsOrUnset(c, 'reapplyScenario', 'german_verzicht'),
      text: 'Die näheren Umstände des bisherigen Verfahrens, ' +
            'insbesondere einer seinerzeit abgegebenen Erklärung und der ' +
            'Bedingungen, unter denen sie zustande kam, lege ich in der ' +
            'Anlage dar.' },
    { when: (c) => choiceIs(c, 'reapplyScenario', 'third_country_stay'),
      text: 'Mein zwischenzeitlicher Aufenthalt außerhalb der Ukraine ' +
            'steht dem vorübergehenden Schutz nicht entgegen. Nach der ' +
            'Rechtsprechung knüpft der Schutz allein an die Vertreibung ' +
            'aus der Ukraine infolge des Angriffskrieges an; ein ' +
            'längerer Aufenthalt in einem Drittstaat lässt die ' +
            'Vertriebeneneigenschaft nicht entfallen (vgl. VG ' +
            'Düsseldorf, Urt. v. 18.06.2025 – 24 K 7223/24; VGH ' +
            'Baden-Württemberg, Beschl. v. 18.08.2025 – 11 S 1355/25). ' +
            'Die Einzelheiten meines Reisewegs lege ich in der Anlage ' +
            'dar.' },
    { when: (c) => choiceIs(c, 'reapplyScenario', 'applied_elsewhere'),
      text: 'Ein früherer Antrag in einem anderen Mitgliedstaat der EU, ' +
            'der nicht zur Erteilung eines Aufenthaltstitels geführt ' +
            'hat, schließt den vorübergehenden Schutz in Deutschland ' +
            'nicht aus (vgl. EuGH, Urt. v. 27.02.2025 – C-753/23). Die ' +
            'Einzelheiten lege ich in der Anlage dar.' },
    { text: 'Zum Nachweis meiner Vertriebeneneigenschaft im Sinne des ' +
            'Durchführungsbeschlusses füge ich die in der ' +
            'Anlagenübersicht genannten Unterlagen bei.' },
    { text: 'Ich bitte um schriftliche Eingangsbestätigung sowie um ' +
            'Ausstellung einer Fiktionsbescheinigung nach § 81 Abs. 5 ' +
            'AufenthG.' },
    { text: SCHLUSS },
  ],

  // ----------------------------------------------- translation_costs
  translation_costs: [
    { text: GRUSS },
    { text: 'ich beziehe von Ihnen Leistungen.{AZ_LINE} Mit Schreiben ' +
            'vom {AUTHORITY_LETTER_DATE} wurde mir ein Dokument ' +
            'übersandt, dessen Übersetzung für das weitere Verfahren ' +
            'erforderlich ist; ich verfüge nicht über ausreichende ' +
            'Deutschkenntnisse und nicht über die Mittel, die ' +
            'Übersetzung selbst zu bezahlen.' },
    { when: (c) => choiceIs(c, 'benefitRegime', 'asylblg'),
      text: 'Ich beantrage die Übernahme der Kosten der erforderlichen ' +
            'Übersetzung als sonstige Leistung nach § 6 Abs. 1 AsylbLG.' },
    { when: (c) => choiceIs(c, 'benefitRegime', 'sgb2'),
      text: 'Ich beantrage die Übernahme der Kosten der erforderlichen ' +
            'Übersetzung als Mehrbedarf nach § 21 Abs. 6 SGB II ' +
            '(unabweisbarer, laufender besonderer Bedarf).' },
    { text: 'Um schriftliche Bescheidung dieses Antrags wird gebeten.' },
    { text: SCHLUSS },
  ],

  // --------------------------------------------- aufsichtsbeschwerde
  aufsichtsbeschwerde: [
    { text: GRUSS },
    { text: 'hiermit erhebe ich Fachaufsichtsbeschwerde gegen die ' +
            'Ausländerbehörde {ABH_NAME} wegen Untätigkeit.' },
    { text: '{APPLICATION_DATE_AM_CAP} habe ich dort einen Antrag auf ' +
            'Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG gestellt.{AZ_LINE}' },
    { when: (c) => has(c, 'mahnungDeadline'),
      text: 'Trotz schriftlicher Erinnerung mit Fristsetzung bis zum ' +
            '{MAHNUNG_DEADLINE} ist bis heute weder eine Entscheidung ' +
            'ergangen noch wurde mir ein zureichender Grund für die ' +
            'Verzögerung mitgeteilt.' },
    { when: (c) => !has(c, 'mahnungDeadline'),
      text: 'Trotz schriftlicher Erinnerung mit Fristsetzung ist bis ' +
            'heute weder eine Entscheidung ergangen noch wurde mir ein ' +
            'zureichender Grund für die Verzögerung mitgeteilt.' },
    { when: (c) => c.flag('fiktionAlsoMissing'),
      text: 'Auch eine Fiktionsbescheinigung nach § 81 Abs. 5 AufenthG, ' +
            'auf deren Ausstellung ein gebundener Anspruch besteht, ' +
            'wurde nicht ausgestellt.' },
    { text: 'Ich bitte Sie, im Rahmen Ihrer Aufsicht auf eine zeitnahe ' +
            'Entscheidung hinzuwirken und mir das Ergebnis Ihrer ' +
            'Prüfung schriftlich mitzuteilen.' },
    { text: SCHLUSS },
  ],

  // -------------------------------------------- widerspruch_aufenthg
  widerspruch_aufenthg: [
    { text: GRUSS },
    { text: 'hiermit lege ich gegen Ihren Bescheid vom ' +
            '{BESCHEID_DATE}{AZ_INLINE}\n\nWiderspruch\n\n' +
            'ein.' },
    { when: (c) => choiceIs(c, 'appealInstruction', 'missing_or_wrong'),
      text: 'Vorsorglich weise ich darauf hin, dass der Bescheid keine ' +
            'ordnungsgemäße Rechtsbehelfsbelehrung enthielt; die Frist ' +
            'zur Einlegung des Widerspruchs beträgt daher ein Jahr ' +
            '(§ 70 Abs. 2 i. V. m. § 58 Abs. 2 VwGO).' },
    { text: 'Ich beantrage, den Bescheid aufzuheben und über meinen ' +
            'Antrag erneut unter Beachtung der Rechtsauffassung der ' +
            'Widerspruchsbehörde zu entscheiden.' },
    { text: 'Eine Begründung des Widerspruchs reiche ich gesondert ' +
            'nach. Um schriftliche Bestätigung des Eingangs dieses ' +
            'Widerspruchs wird gebeten.' },
    { text: SCHLUSS },
  ],

  // ------------------------------------------------------ dsgvo_bamf
  dsgvo_bamf: [
    { text: GRUSS },
    { when: (c) => c.flag('repeatRequest'),
      text: 'unter Bezugnahme auf mein laufendes Verfahren stelle ich ' +
            'hiermit einen erneuten Antrag auf Auskunft und ' +
            'Akteneinsicht gemäß Art. 15 DSGVO.{AZ_LINE}' },
    { when: (c) => !c.flag('repeatRequest'),
      text: 'unter Bezugnahme auf mein laufendes Verfahren stelle ich ' +
            'hiermit einen Antrag auf Auskunft und Akteneinsicht gemäß ' +
            'Art. 15 DSGVO.{AZ_LINE}' },
    { text: 'Ich bitte Sie, mir eine vollständige Kopie meiner Akte, ' +
            'vorzugsweise in elektronischer Form (als PDF per E-Mail ' +
            'oder Download-Link), zukommen zu lassen. Sollte dies nicht ' +
            'möglich sein, bitte ich um Zusendung per Post an meine ' +
            'oben genannte Anschrift.' },
    { text: 'Die Beantwortung erwarte ich innerhalb der gesetzlichen ' +
            'Frist (Art. 12 Abs. 3 DSGVO). Um schriftliche ' +
            'Eingangsbestätigung wird gebeten.' },
    { text: SCHLUSS },
  ],

  // -------------------------------------------------- dsgvo_behoerde
  dsgvo_behoerde: [
    { text: GRUSS },
    { text: 'hiermit stelle ich kumulativ (nebeneinander) die folgenden ' +
            'Anträge.{AZ_LINE}' },
    { text: '1. Akteneinsicht nach {VWVFG_REF}: Soweit ein ' +
            'Verwaltungsverfahren vorliegt und ich als Beteiligte(r) ' +
            'anzusehen bin, beantrage ich Einsicht in die das Verfahren ' +
            'betreffenden Aktenbestandteile — einschließlich Vermerke, ' +
            'Aktennotizen, Telefonvermerke, interner Mitteilungen, ' +
            'eingereichter Unterlagen, Protokolle, Stellungnahmen, ' +
            'Bescheide und Zustellnachweise —, soweit deren Kenntnis ' +
            'zur Geltendmachung oder Verteidigung meiner rechtlichen ' +
            'Interessen erforderlich ist.' },
    { text: '2. Unabhängig davon: Auskunft nach Art. 15 DSGVO sowie ' +
            'Bereitstellung einer Kopie meiner personenbezogenen Daten ' +
            'gemäß Art. 15 Abs. 3 DSGVO — einschließlich sämtlicher zu ' +
            'meiner Person gespeicherten Daten, der Vorgänge, in denen ' +
            'ich personenbezogen erwähnt werde, interner Kommunikation ' +
            'mit Personenbezug sowie der Empfänger bzw. ' +
            'Empfängerkategorien von Übermittlungen und der Herkunft ' +
            'der Daten. Bitte teilen Sie mir zudem die Informationen ' +
            'nach Art. 15 Abs. 1 DSGVO mit.' },
    { text: 'Mir ist bewusst, dass einzelne Inhalte dem Schutz Dritter ' +
            'oder gesetzlichen Ausschlussgründen unterliegen können. ' +
            'Ich beantrage daher ausdrücklich Teileinsicht bzw. ' +
            'Teilauskunft mit Schwärzungen und bitte um konkrete ' +
            'Einzelfallprüfung statt einer Gesamtablehnung.' },
    { text: 'Form der Übermittlung: vorzugsweise elektronisch (PDF per ' +
            'E-Mail oder Download-Link); hilfsweise bitte ich um einen ' +
            'Termin zur Einsichtnahme.' },
    { text: 'Ich bitte um schriftliche Eingangsbestätigung. Die ' +
            'Beantwortung des Auskunftsersuchens nach Art. 15 DSGVO ' +
            'erwarte ich innerhalb der gesetzlichen Frist (Art. 12 ' +
            'Abs. 3 DSGVO). Im Falle einer Ablehnung oder Teilablehnung ' +
            'bitte ich um schriftliche Mitteilung der konkreten ' +
            'Rechtsgrundlage, der betroffenen Teile sowie der ' +
            'Rechtsbehelfe.' },
    { text: SCHLUSS },
  ],

  // -------------------------------------------- untaetigkeitsklage
  untaetigkeitsklage: [
    { text: `Klage

des/der {NAME} {SURNAME}, geboren am {DOB},
wohnhaft {STREET}, {PLZ_CITY}
— Klagepartei —

gegen

den Rechtsträger der Ausländerbehörde {ABH_NAME}
— Beklagtenseite —

wegen: Untätigkeit (§ 75 VwGO) — Aufenthaltserlaubnis nach § 24 AufenthG` },
    { when: (c) => !c.flag('fiktionAlsoMissing'),
      text: 'Ich erhebe Klage und beantrage,\n\ndie Beklagtenseite zu ' +
            'verpflichten, über meinen Antrag {APPLICATION_DATE_VOM} ' +
            'auf Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG zu entscheiden.' },
    { when: (c) => c.flag('fiktionAlsoMissing'),
      text: 'Ich erhebe Klage und beantrage,\n\n1. die Beklagtenseite ' +
            'zu verpflichten, über meinen Antrag {APPLICATION_DATE_VOM} ' +
            'auf Erteilung einer Aufenthaltserlaubnis nach § 24 Abs. 1 ' +
            'AufenthG zu entscheiden;\n\n2. die Beklagtenseite zu ' +
            'verpflichten, mir eine Fiktionsbescheinigung nach § 81 ' +
            'Abs. 5 AufenthG auszustellen.' },
    { text: 'Begründung:' },
    { text: '{APPLICATION_DATE_AM_CAP} habe ich bei der Ausländerbehörde ' +
            '{ABH_NAME} einen Antrag auf Erteilung einer ' +
            'Aufenthaltserlaubnis nach § 24 Abs. 1 AufenthG ' +
            'gestellt.{AZ_LINE} Seit der Antragstellung sind mehr als ' +
            'drei Monate vergangen, ohne dass über den Antrag ' +
            'entschieden wurde (§ 75 Satz 1 und 2 VwGO). Mit Schreiben ' +
            'habe ich an die Entscheidung erinnert und eine Frist bis ' +
            'zum {MAHNUNG_DEADLINE} gesetzt; die Frist ist fruchtlos ' +
            'verstrichen. Ein zureichender Grund für die ' +
            'Nichtbescheidung ist weder mitgeteilt worden noch ' +
            'ersichtlich.' },
    { when: (c) => c.flag('fiktionAlsoMissing'),
      text: 'Auch eine Fiktionsbescheinigung nach § 81 Abs. 5 AufenthG ' +
            'wurde trotz Aufforderung nicht ausgestellt, obwohl auf ' +
            'ihre Ausstellung ein gebundener Anspruch besteht.' },
    { text: 'Beweismittel und Anlagen: Kopie des Antrags, Nachweis der ' +
            'Übermittlung, Erinnerungsschreiben mit Fristsetzung, ' +
            'weitere Nachweise gemäß Anlagenübersicht.' },
  ],
};

/** Anlagen blocks rendered AFTER the signature (same condition DSL). */
const ATTACHMENTS: Record<string, Block[]> = {
  oral_refusal: [
    { when: (c) => choiceIs(c, 'oralRefusalKind', 'refused_to_accept'),
      text: 'Anlagen: Antrag auf Erteilung einer Aufenthaltserlaubnis ' +
            'nach § 24 Abs. 1 AufenthG' },
  ],
  new_application: [
    { text: 'Anlagen: siehe Anlagenübersicht' },
  ],
  aufsichtsbeschwerde: [
    { text: 'Anlagen: Antragskopie, Erinnerungsschreiben' },
  ],
};

// ------------------------------------------------------------ compose

const renderBlocks = (
  blocks: Block[] | undefined, ctx: Ctx, vars: Record<string, string>,
): string =>
  (blocks ?? [])
    .filter((b) => !b.when || b.when(ctx))
    .map((b) => fill(b.text, vars))
    .join('\n\n');

export function compose(input: ComposeInput): ComposedLetter {
  const { letter, profile, answers, recipient, remedy } = input;
  const blocks = BODIES[letter.id];
  if (!blocks) throw new Error(`no body template for letter '${letter.id}'`);

  const ctx = makeCtx(answers, remedy);
  const f = answers.fields;
  const az = f.aktenzeichen?.trim();
  const fiktionExpiry = formatDE(f.fiktionExpiry);
  const appAm = amPhrase(f.applicationDate);
  const vars: Record<string, string> = {
    NAME: profile.name,
    SURNAME: profile.surname,
    DOB: profile.dob,
    STREET: profile.street,
    PLZ_CITY: profile.plzCity,
    APPLICATION_DATE: formatDE(f.applicationDate),
    APPLICATION_DATE_AM: appAm,
    APPLICATION_DATE_AM_CAP: capitalize(appAm),
    APPLICATION_DATE_VOM: vomPhrase(f.applicationDate),
    ORAL_REFUSAL_DATE: formatDE(f.oralRefusalDate),
    ORAL_DATE_CLAUSE: f.oralRefusalDate
      ? `am ${formatDE(f.oralRefusalDate)} ` : '',
    // Akteneinsicht citation per Land: Bayern codified its own VwVfG
    // (Art. 29 BayVwVfG); Schleswig-Holstein never enacted a VwVfG —
    // there § 88 LVwG SH governs; elsewhere § 29 VwVfG (des Landes)
    VWVFG_REF: remedy.land === '09' ? 'Art. 29 BayVwVfG'
      : remedy.land === '01' ? '§ 88 LVwG SH'
      : '§ 29 VwVfG',
    MAHNUNG_DEADLINE: formatDE(f.mahnungDeadline),
    BESCHEID_DATE: formatDE(f.bescheidDate),
    AUTHORITY_LETTER_DATE: formatDE(f.authorityLetterDate),
    INQUIRY_DATE: formatDE(f.inquiryDate),
    FIKTION_EXPIRY_CLAUSE: fiktionExpiry ? `am ${fiktionExpiry} ` : '',
    ABH_NAME: input.regardingAuthority ?? recipient.name,
    AZ_LINE: az ? ` Aktenzeichen: ${az}.` : '',
    AZ_INLINE: az ? ` (Az. ${az})` : '',
    AZ: az ? `, Az. ${az}` : '',
  };

  let body = renderBlocks(blocks, ctx, vars);
  const co = (input.coApplicants ?? []).filter((c) => c.name.trim());
  if (co.length > 0) {
    const list = co
      .map((c) => `– ${c.name}${c.relation ? ` (${c.relation})` : ''}`)
      .join('\n');
    const mention =
      'Dieses Schreiben gilt zugleich für die folgenden ' +
      'Familienangehörigen:\n' + list;
    const beweis = '\n\nBeweismittel und Anlagen:';
    if (body.includes('\n\n' + SCHLUSS)) {
      // letters: insert before the closing greeting
      body = body.replace('\n\n' + SCHLUSS, `\n\n${mention}\n\n` + SCHLUSS);
    } else if (body.includes(beweis)) {
      // lawsuit layout has no SCHLUSS: the mention belongs to the
      // Begründung and must precede the Beweismittel block — a filing
      // must never trail free text after the evidence paragraph
      body = body.replace(beweis, `\n\n${mention}${beweis}`);
    } else {
      body = body + '\n\n' + mention;
    }
  }

  let attachments = renderBlocks(ATTACHMENTS[letter.id], ctx, vars);
  const extra = (input.userAttachments ?? [])
    .map((l) => l.trim()).filter(Boolean);
  if (extra.length > 0) {
    attachments = attachments
      ? `${attachments}, ${extra.join(', ')}`
      : `Anlagen: ${extra.join(', ')}`;
  }

  // sender city for "Ort, den …" — the part after the postal code
  const ort = profile.plzCity.replace(/^\s*\d{4,5}\s*/, '').trim();

  const post = contactChannels(recipient).find((c) => c.type === 'post');
  return {
    senderBlock: [
      `${profile.name} ${profile.surname}`.trim(),
      profile.street,
      profile.plzCity,
    ],
    recipientBlock:
      post && post.type === 'post' ? post.value : [recipient.name],
    date: formatDE(input.dateISO ?? todayISO()),
    ort: /^[_\s]*$/.test(ort) ? '' : ort,
    subject: fill(letter.subject, vars),
    body,
    signatureName: [
      `${profile.name} ${profile.surname}`.replace(/_/g, '').trim(),
      ...co.map((c) => c.name.trim()),
    ].filter(Boolean).join('\n'),
    attachments: attachments || undefined,
    layout: letter.layout,
    sendHintKey:
      letter.layout === 'lawsuit'
        ? 'send.lawsuit' // post/fax to the court; copies hint
        : 'send.letter', // fax/Einschreiben first, e-mail extra
  };
}

/** e-mail body: no address blocks, no "Betreff:" line — the mail
 *  client carries the subject; plain text renders cleanly everywhere */
export function renderEmailText(c: ComposedLetter): string {
  return [
    c.body,
    '',
    c.signatureName,
    ...(c.attachments ? ['', c.attachments] : []),
  ].join('\n');
}

/** plain-text rendering (mailto body, clipboard, client-side fallback) */
export function renderPlainText(c: ComposedLetter): string {
  return [
    c.senderBlock.join('\n'),
    '',
    c.recipientBlock.join('\n'),
    '',
    c.ort ? `${c.ort}, den ${c.date}` : c.date,
    '',
    `Betreff: ${c.subject}`,
    '',
    c.body,
    '',
    '',
    c.signatureName,
    ...(c.attachments ? ['', c.attachments] : []),
  ].join('\n');
}
