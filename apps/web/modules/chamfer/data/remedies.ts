/**
 * Per-Land legal remedy matrix for AufenthG (residence-law) decisions:
 * does a Widerspruch (administrative objection) exist, or does the path
 * go straight to the Verwaltungsgericht?
 *
 * CORRECTNESS RULES
 *  - `confidence: 'confirmed'` rows may gate the UI (hide/show the
 *    Widerspruch template). Anything else renders the conservative
 *    double-path text: "check both; ask the Behörde/RA which applies".
 *  - A wrong "no Widerspruch" can cost the user the remedy; a wrong
 *    "Widerspruch exists" can cost a month and the Klage deadline.
 *    When in doubt the UI must show BOTH with deadlines.
 *  - Untätigkeitsklage (§ 75 VwGO) NEVER requires a prior Widerspruch —
 *    it applies when the authority stays silent, in every Land.
 *  - Each row cites its statutory basis; a lawyer signs off `confirmed`
 *    rows before the module leaves beta (see docs/LEGAL-REVISION.md §4).
 *
 * Audit date: 2026-06-11.
 */

export type RemedyStatus =
  /** no Widerspruch for AufenthG — straight to Klage at the VG */
  | 'direct_klage'
  /** Widerspruch exists for AufenthG decisions — use it first */
  | 'widerspruch'
  /** optional regime or unresolved — UI must show both paths */
  | 'mixed';

export interface LandRemedy {
  /** Land key as in Taper (Destatis code) */
  land: string;
  name: string;
  status: RemedyStatus;
  confidence: 'confirmed' | 'verify';
  /** statutory basis / where to check */
  basis: string;
  /** UI note key (namespace chamfer) */
  noteKey?: string;
}

export const LAND_REMEDIES: LandRemedy[] = [
  {
    land: '09', name: 'Bayern', status: 'direct_klage',
    confidence: 'confirmed',
    basis: 'Art. 15 AGVwGO BY (optionales Widerspruchsverfahren erfasst ' +
           'das Ausländerrecht nicht) — Klage zum VG binnen eines Monats',
    noteKey: 'remedies.by',
  },
  {
    land: '05', name: 'Nordrhein-Westfalen', status: 'direct_klage',
    confidence: 'confirmed',
    basis: '§ 110 JustG NRW — Widerspruchsverfahren grundsätzlich ' +
           'abgeschafft; Ausländerrecht nicht unter den Ausnahmen',
  },
  {
    land: '03', name: 'Niedersachsen', status: 'direct_klage',
    confidence: 'confirmed',
    basis: '§ 80 Nds. Justizgesetz — Widerspruch grundsätzlich ' +
           'abgeschafft; AufenthG nicht unter den Ausnahmen',
  },
  {
    land: '12', name: 'Brandenburg', status: 'widerspruch',
    confidence: 'confirmed',
    basis: 'Kein Landes-Ausschluss (§ 68 VwGO Grundsatz gilt) — ' +
           'Widerspruch binnen eines Monats, dann Klage',
  },
  {
    land: '08', name: 'Baden-Württemberg', status: 'widerspruch',
    confidence: 'verify',
    basis: '§§ 6 ff. AGVwGO BW — Widerspruch besteht im Regelfall ' +
           '(Entscheidung: Regierungspräsidium); Ausnahmen prüfen',
  },
  {
    land: '07', name: 'Rheinland-Pfalz', status: 'widerspruch',
    confidence: 'verify',
    basis: 'AGVwGO RP — Widerspruchsverfahren weitgehend erhalten',
  },
  {
    land: '11', name: 'Berlin', status: 'mixed',
    confidence: 'verify',
    basis: 'AGVwGO Bln — Bestand des Widerspruchs in Ausländersachen ' +
           '(LEA) prüfen; Praxis uneinheitlich dokumentiert',
  },
  {
    land: '02', name: 'Hamburg', status: 'mixed',
    confidence: 'verify',
    basis: 'HmbVwVfG/AGVwGO — teilweise Abschaffung; Ausländerrecht prüfen',
  },
  {
    land: '04', name: 'Bremen', status: 'mixed',
    confidence: 'verify',
    basis: 'BremAGVwGO — Bestand prüfen',
  },
  {
    land: '06', name: 'Hessen', status: 'mixed',
    confidence: 'verify',
    basis: 'HessAGVwGO §§ 16a ff. — bereichsweise Abschaffung; ' +
           'Ausländerrecht historisch ohne Widerspruch, aktuelle Fassung prüfen',
  },
  {
    land: '01', name: 'Schleswig-Holstein', status: 'mixed',
    confidence: 'verify',
    basis: 'LVwG SH / AGVwGO — Bestand im Regelfall, Ausnahmen prüfen',
  },
  {
    land: '10', name: 'Saarland', status: 'mixed',
    confidence: 'verify',
    basis: 'AGVwGO SL — Bestand prüfen',
  },
  {
    land: '13', name: 'Mecklenburg-Vorpommern', status: 'mixed',
    confidence: 'verify',
    basis: '§ 13a AGGerStrG M-V — weitgehende Abschaffung; ' +
           'Ausländerrecht unter den Ausnahmen? prüfen',
  },
  {
    land: '14', name: 'Sachsen', status: 'mixed',
    confidence: 'verify',
    basis: 'SächsJG — bereichsweise Regelungen, Ausländerrecht prüfen',
  },
  {
    land: '15', name: 'Sachsen-Anhalt', status: 'mixed',
    confidence: 'verify',
    basis: '§ 8a AG VwGO LSA — Abschaffung mit Ausnahmen, prüfen',
  },
  {
    land: '16', name: 'Thüringen', status: 'mixed',
    confidence: 'verify',
    basis: 'ThürAGVwGO — teils fakultatives Verfahren, prüfen',
  },
];

export const remedyFor = (landCode: string): LandRemedy =>
  LAND_REMEDIES.find((r) => r.land === landCode) ?? {
    land: landCode,
    name: landCode,
    status: 'mixed',
    confidence: 'verify',
    basis: 'unknown — conservative double-path applies',
  };

/**
 * Deadlines shown alongside either path. Klage: one month from
 * notification of the (Widerspruchs-)Bescheid with proper
 * Rechtsbehelfsbelehrung, one year if the instruction was missing/wrong
 * (§§ 74, 58 VwGO). Untätigkeitsklage: generally admissible three months
 * after the application (§ 75 VwGO) — no Widerspruch required.
 */
export const DEADLINES = {
  klageMonths: 1,
  klageWrongInstructionMonths: 12,
  untaetigkeitWaitMonths: 3,
} as const;
