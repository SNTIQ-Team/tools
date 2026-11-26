/**
 * Change history and change summaries (API contract kerf-change-summary/1).
 *
 * Pure data logic only: validation of what the API serves, feature detection,
 * and conservative adapters from the older API shape (norm log `events`,
 * GII `stand` strings). Evidence rules encoded here:
 *  - a date is shown only when the API supplies it; a missing date stays
 *    `null` with status `unknown` and is displayed as unknown;
 *  - no date is ever parsed out of a citation string ("G v. 22.12.2025");
 *  - an archived capture's date is a knowledge date, never a legal date;
 *  - a reconstruction is always labelled as such.
 */

export type SourceRole = 'official_consolidation' | 'official_promulgation' | 'archived_capture' | 'reconstruction';
export const SOURCE_ROLES: readonly SourceRole[] = ['official_consolidation', 'official_promulgation', 'archived_capture', 'reconstruction'];
export type CompletenessStatus = 'complete' | 'partial' | 'reconstructed' | 'unavailable';
export const COMPLETENESS: readonly CompletenessStatus[] = ['complete', 'partial', 'reconstructed', 'unavailable'];

export interface KerfAttestation {
  source: string;
  role?: string | null;
  url?: string | null;
  archive_url?: string | null;
  known_at?: string | null;
  stand?: string | null;
  sha256?: string | null;
  /** Core API aggregate form: first/last capture showing this wording. */
  known_from?: string | null;
  known_until?: string | null;
  count?: number | null;
  samples?: { url?: string | null; archive_url?: string | null; sha256?: string | null; known_at?: string | null }[];
}

/** One attestation line: where, as what, and since when this exact wording was seen. */
export function attestationSummary(attestation: KerfAttestation): { source: string; role: SourceRole | null; from: string | null; until: string | null; count: number | null; url: string | null; archiveUrl: string | null } {
  const sample = attestation.samples?.find(item => item.archive_url || item.url) ?? attestation.samples?.[0];
  return {
    source: attestation.source,
    role: isSourceRole(attestation.role) ? attestation.role : null,
    from: isoDay(attestation.known_from) ?? isoDay(attestation.known_at) ?? isoDay(sample?.known_at),
    until: isoDay(attestation.known_until),
    count: typeof attestation.count === 'number' ? attestation.count : attestation.samples?.length ?? null,
    url: attestation.url ?? sample?.url ?? null,
    archiveUrl: attestation.archive_url ?? sample?.archive_url ?? null,
  };
}
export interface KerfCompleteness { status: string; reason?: string | null }
export interface KerfCrossVerification { cross_source?: string | null; findings?: unknown[] }

export interface KerfGazette {
  name?: string | null; part?: string | null; year?: number | string | null;
  number?: number | string | null; page?: number | string | null; reference?: string | null;
}
export interface KerfAmendingActRef {
  document_id?: string | null; title?: string | null; citation?: string | null;
  article?: string | null; nummer?: string | null; buchstabe?: string | null;
  gazette?: KerfGazette | null; url?: string | null; procedure_id?: string | null;
  /** Nummer/Buchstabe items of the amending article, e.g. ["1.a,1.b"]. */
  items?: string[];
}
export interface KerfChangeDate {
  date: string | null;
  status: string;
  basis?: string | null;
  clause?: string | null;
  evidence?: unknown[];
}
export type ChangeDateField = 'adopted' | 'promulgated' | 'in_force' | 'applies_from';
export const CHANGE_DATE_FIELDS: readonly ChangeDateField[] = ['adopted', 'promulgated', 'in_force', 'applies_from'];
export type KerfChangeDates = Partial<Record<ChangeDateField, KerfChangeDate | null>>;
export type ChangeType = 'geändert' | 'eingefügt' | 'neugefasst' | 'aufgehoben' | 'ersetzt' | 'unbekannt';
export const CHANGE_TYPES: readonly ChangeType[] = ['geändert', 'eingefügt', 'neugefasst', 'aufgehoben', 'ersetzt', 'unbekannt'];
export type ChangeState = 'in_force' | 'pending' | 'date_unknown' | 'incorporated_date_unknown' | 'not_yet_promulgated';
const CHANGE_STATES: readonly ChangeState[] = ['in_force', 'pending', 'date_unknown', 'incorporated_date_unknown', 'not_yet_promulgated'];

export interface KerfChangeCommand { operation?: string | null; ref?: Record<string, unknown> | null; raw?: string | null; new_text?: string | null }
/** Which versions a change produced. The contract names version ids; the
 * core API also serves indexes into the oldest-first version list. */
export interface KerfTextEffect {
  before_version_id?: string | null; after_version_id?: string | null;
  before_version?: number | null; after_version?: number | null;
  observed_from?: string | null; verification?: string | null;
}

export interface KerfChangeRecord {
  change_id: string;
  act_id?: string | null;
  norm_id?: string | null;
  norm_label?: string | null;
  amending_act: KerfAmendingActRef | null;
  dates: KerfChangeDates;
  change_type: string;
  pending?: boolean | null;
  state?: string | null;
  commands?: KerfChangeCommand[];
  text_effect?: KerfTextEffect | null;
  diff_url?: string | null;
  evidence?: unknown[];
  /** Compact records inside a change summary carry the role of the resulting version. */
  source_role?: string | null;
  /** GII's own documentation state of this amendment (core API). */
  gii_documentation?: { kind: string; text?: string | null; text_incorporated?: boolean | null; documentation_complete?: boolean | null } | null;
  /** Set by the legacy adapter: derived from the older norm-log `events`. */
  legacy?: boolean;
}

export type DocumentationNoteKind = 'textually_incorporated_documentation_pending' | 'not_yet_incorporated' | 'indirect_change_incorporated' | 'other';
export interface KerfDocumentationNote {
  kind: string;
  text: string;
  text_incorporated?: boolean | null;
  documentation_complete?: boolean | null;
  amending_act?: { citation_text?: string | null; document_id?: string | null; article?: string | null } | null;
  source?: string | null;
  observed_at?: string | null;
}

export interface KerfChangeSummary {
  schema?: string;
  scope: 'norm' | 'act';
  subject: string;
  as_of?: string | null;
  last_change: KerfChangeRecord | null;
  next_pending_change: KerfChangeRecord | null;
  pending_changes: KerfChangeRecord[];
  counts: {
    versions?: number | null; versions_by_role?: Record<string, number> | null;
    events?: number | null; events_with_in_force?: number | null; sources?: Record<string, number> | null;
    amending_acts?: number | null; events_pending?: number | null; events_date_unknown?: number | null; act_states?: number | null;
  } | null;
  /** Latest change already in the text whose in-force date is not evidenced. */
  last_incorporated_undated?: KerfChangeRecord | null;
  unknown_dates_total?: number | null;
  /** Compact summaries (law index rows) only count the notes. */
  documentation_notes_count?: number | null;
  source_role?: string | null;
  act_stand_note?: { scope?: string | null; text: string; norm_specific?: boolean | null; source?: string | null } | null;
  documentation_notes: KerfDocumentationNote[];
  unknown_dates: { change_id?: string | null; field: string; reason?: string | null; amending_act?: string | null }[];
  completeness?: { event_history?: string | null; event_history_start?: string | null; text_history_start?: string | null; gaps?: unknown[] } | null;
  /** UI marker: built by an adapter from older API fields, not served as a summary. */
  derived?: 'legacy';
}

const record = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === 'object' && !Array.isArray(value);
const str = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null;
const DAY = /^\d{4}-\d{2}-\d{2}/u;
/** Only an ISO calendar day counts as a date; anything else is not a date. */
export const isoDay = (value: unknown): string | null => typeof value === 'string' && DAY.test(value) ? value.slice(0, 10) : null;

export const isSourceRole = (value: unknown): value is SourceRole => typeof value === 'string' && (SOURCE_ROLES as readonly string[]).includes(value);

function normalizeDate(value: unknown): KerfChangeDate | null {
  if (value === undefined || value === null) return null;
  if (!record(value)) return null;
  const date = isoDay(value.date);
  // A date without a stated status is still evidence the API supplied; a
  // status other than unknown without a date is not a date.
  const status = str(value.status) ?? (date ? 'official' : 'unknown');
  return {
    date,
    status: date ? status : status === 'not_stated' ? 'not_stated' : 'unknown',
    basis: str(value.basis) ?? str(value.reason),
    clause: str(value.clause),
    evidence: Array.isArray(value.evidence) ? value.evidence : undefined,
  };
}

function normalizeAmendingAct(value: unknown): KerfAmendingActRef | null {
  if (!record(value)) return null;
  const gazette = typeof value.gazette === 'string' && value.gazette.trim() ? { reference: value.gazette.trim() } : record(value.gazette) ? {
    name: str(value.gazette.name), part: str(value.gazette.part),
    year: typeof value.gazette.year === 'number' || typeof value.gazette.year === 'string' ? value.gazette.year : null,
    number: typeof value.gazette.number === 'number' || typeof value.gazette.number === 'string' ? value.gazette.number : null,
    page: typeof value.gazette.page === 'number' || typeof value.gazette.page === 'string' ? value.gazette.page : null,
    reference: str(value.gazette.reference),
  } : null;
  const ref: KerfAmendingActRef = {
    document_id: str(value.document_id), title: str(value.title), citation: str(value.citation),
    article: str(value.article) ?? (typeof value.article === 'number' ? String(value.article) : null),
    nummer: str(value.nummer) ?? (typeof value.nummer === 'number' ? String(value.nummer) : null),
    buchstabe: str(value.buchstabe), gazette, url: str(value.url), procedure_id: str(value.procedure_id),
  };
  const items = Array.isArray(value.items) ? value.items.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
  if (!Object.values(ref).some(Boolean)) return null;
  return items.length ? { ...ref, items } : ref;
}

/** Validate one change record; malformed rows are dropped, not guessed. */
export function normalizeChangeRecord(value: unknown): KerfChangeRecord | null {
  if (!record(value)) return null;
  const id = str(value.change_id) ?? str(value.id);
  if (!id) return null;
  const rawDates = record(value.dates) ? value.dates : null;
  const dates: KerfChangeDates = {};
  for (const field of CHANGE_DATE_FIELDS) {
    // Compact records (law index) carry the day itself, without a status.
    const date = rawDates ? normalizeDate(rawDates[field])
      : field in value ? { date: isoDay(value[field]), status: isoDay(value[field]) ? 'stated' : 'unknown', basis: null } : null;
    if (date) dates[field] = date;
  }
  const effect = record(value.text_effect) ? value.text_effect : null;
  const index = (item: unknown) => typeof item === 'number' && Number.isInteger(item) && item >= 0 ? item : null;
  const textEffect = effect ? {
    before_version_id: str(effect.before_version_id), after_version_id: str(effect.after_version_id),
    before_version: index(effect.before_version), after_version: index(effect.after_version),
    observed_from: isoDay(effect.observed_from), verification: str(effect.verification) ?? str(effect.attribution),
  } : null;
  // Compact records name the amending act at top level.
  const amending = normalizeAmendingAct(value.amending_act)
    ?? (rawDates ? null : normalizeAmendingAct({ citation: value.citation, document_id: value.document_id, title: value.title, gazette: value.gazette }));
  return {
    change_id: id,
    act_id: str(value.act_id), norm_id: str(value.norm_id), norm_label: str(value.norm_label),
    amending_act: amending,
    dates,
    change_type: str(value.change_type) ?? 'unbekannt',
    pending: typeof value.pending === 'boolean' ? value.pending : null,
    state: str(value.state),
    commands: Array.isArray(value.commands) ? value.commands.filter(record).map(command => ({
      operation: str(command.operation), ref: record(command.ref) ? command.ref : null, raw: str(command.raw), new_text: str(command.new_text),
    })) : [],
    text_effect: textEffect,
    diff_url: str(value.diff_url),
    evidence: Array.isArray(value.evidence) ? value.evidence : undefined,
    source_role: str(value.source_role),
    gii_documentation: record(value.gii_documentation) && str(value.gii_documentation.kind) ? {
      kind: str(value.gii_documentation.kind)!, text: str(value.gii_documentation.text),
      text_incorporated: typeof value.gii_documentation.text_incorporated === 'boolean' ? value.gii_documentation.text_incorporated : null,
      documentation_complete: typeof value.gii_documentation.documentation_complete === 'boolean' ? value.gii_documentation.documentation_complete : null,
    } : null,
  };
}

const numberOrNull = (value: unknown) => typeof value === 'number' && Number.isFinite(value) ? value : null;
const countMap = (value: unknown): Record<string, number> | null => {
  if (!record(value)) return null;
  const entries = Object.entries(value).filter((entry): entry is [string, number] => typeof entry[1] === 'number' && Number.isFinite(entry[1]));
  return entries.length ? Object.fromEntries(entries) : null;
};

/** Feature detection: returns null unless the value is a change summary. */
export function normalizeChangeSummary(value: unknown): KerfChangeSummary | null {
  if (!record(value)) return null;
  const scope = value.scope === 'norm' || value.scope === 'act' ? value.scope : null;
  if (!scope || (value.schema !== undefined && value.schema !== 'kerf-change-summary/1')) return null;
  const counts = record(value.counts) ? {
    versions: numberOrNull(value.counts.versions), versions_by_role: countMap(value.counts.versions_by_role),
    events: numberOrNull(value.counts.events), events_with_in_force: numberOrNull(value.counts.events_with_in_force),
    sources: countMap(value.counts.sources), amending_acts: numberOrNull(value.counts.amending_acts),
    events_pending: numberOrNull(value.counts.events_pending), events_date_unknown: numberOrNull(value.counts.events_date_unknown),
    act_states: numberOrNull(value.counts.act_states),
  } : null;
  const stand = record(value.act_stand_note) && str(value.act_stand_note.text) ? {
    scope: str(value.act_stand_note.scope), text: str(value.act_stand_note.text)!,
    norm_specific: typeof value.act_stand_note.norm_specific === 'boolean' ? value.act_stand_note.norm_specific : null,
    source: str(value.act_stand_note.source),
  } : null;
  const notes = Array.isArray(value.documentation_notes) ? value.documentation_notes.filter(record).filter(note => str(note.text)).map(note => ({
    kind: str(note.kind) ?? 'other', text: str(note.text)!,
    text_incorporated: typeof note.text_incorporated === 'boolean' ? note.text_incorporated : null,
    documentation_complete: typeof note.documentation_complete === 'boolean' ? note.documentation_complete : null,
    amending_act: record(note.amending_act) ? { citation_text: str(note.amending_act.citation_text), document_id: str(note.amending_act.document_id), article: str(note.amending_act.article) } : null,
    source: str(note.source), observed_at: str(note.observed_at),
  })) : [];
  const unknown = Array.isArray(value.unknown_dates) ? value.unknown_dates.filter(record).filter(row => str(row.field)).map(row => ({
    change_id: str(row.change_id), field: str(row.field)!, reason: str(row.reason), amending_act: str(row.amending_act),
  })) : [];
  const completeness = record(value.completeness) ? {
    event_history: str(value.completeness.event_history), event_history_start: isoDay(value.completeness.event_history_start),
    text_history_start: isoDay(value.completeness.text_history_start), gaps: Array.isArray(value.completeness.gaps) ? value.completeness.gaps : [],
  } : null;
  return {
    schema: str(value.schema) ?? undefined,
    scope, subject: str(value.subject) ?? '', as_of: isoDay(value.as_of),
    last_change: normalizeChangeRecord(value.last_change),
    next_pending_change: normalizeChangeRecord(value.next_pending_change),
    pending_changes: Array.isArray(value.pending_changes) ? value.pending_changes.map(normalizeChangeRecord).filter((row): row is KerfChangeRecord => Boolean(row)) : [],
    counts, source_role: str(value.source_role), act_stand_note: stand,
    documentation_notes: notes, unknown_dates: unknown, completeness,
    last_incorporated_undated: normalizeChangeRecord(value.last_incorporated_undated),
    unknown_dates_total: numberOrNull(value.unknown_dates_total),
    documentation_notes_count: typeof value.documentation_notes === 'number' ? value.documentation_notes : notes.length,
  };
}

/** One row of /acts/{id}/changes: an amending act (and article) with the
 * provisions it changed. */
export interface KerfActChangeGroup {
  key: string;
  amending_act: KerfAmendingActRef | null;
  dates: KerfChangeDates;
  state?: string | null;
  pending?: boolean | null;
  norms: KerfChangeRecord[];
}

export function normalizeActChangeGroup(value: unknown, index = 0): KerfActChangeGroup | null {
  if (!record(value)) return null;
  // A flat change record is a group of one.
  if (!Array.isArray(value.norms)) {
    const change = normalizeChangeRecord(value);
    return change ? { key: change.change_id, amending_act: change.amending_act, dates: change.dates, state: change.state, pending: change.pending, norms: [change] } : null;
  }
  const shell = normalizeChangeRecord({ ...value, change_id: 'group' });
  const norms = value.norms.map(row => record(row) ? normalizeChangeRecord({ ...row, amending_act: row.amending_act ?? value.amending_act, dates: row.dates ?? value.dates }) : null)
    .filter((row): row is KerfChangeRecord => Boolean(row));
  if (!shell || !norms.length) return null;
  const act = shell.amending_act;
  return { key: `${act?.document_id ?? act?.citation ?? 'act'}:${act?.article ?? ''}:${index}`, amending_act: act, dates: shell.dates, state: shell.state, pending: shell.pending, norms };
}

/** in_force → pending / in force / unknown; the API's own state wins. */
export function changeState(change: Pick<KerfChangeRecord, 'state' | 'pending' | 'dates'>, today: string): ChangeState {
  if (change.state === 'pending' || change.pending === true) return 'pending';
  if (change.state && (CHANGE_STATES as readonly string[]).includes(change.state)) return change.state as ChangeState;
  const day = change.dates.in_force?.date ?? null;
  if (!day) return 'date_unknown';
  return day > today ? 'pending' : 'in_force';
}

/** Citation shown for an amending act. The API composes it from evidence;
 * without one, only structured evidence fields are joined — never a date. */
export function changeCitation(act: KerfAmendingActRef | null | undefined): string | null {
  if (!act) return null;
  if (act.citation) return act.citation;
  const nummer = act.nummer ?? (act.items?.length ? act.items.join('; ') : null);
  const location = [act.article && `Art. ${act.article}`, nummer && `Nr. ${nummer}`, act.buchstabe && `Buchst. ${act.buchstabe}`].filter(Boolean).join(' ');
  const gazette = act.gazette?.reference ?? null;
  const text = [location, gazette ? `(${gazette})` : ''].filter(Boolean).join(' ');
  return text || act.title || act.document_id || null;
}

/** Newest first by the best evidenced date; undated rows last. Pending rows
 * (future in-force days) therefore lead, as on buzer.de. */
export function sortChanges(changes: readonly KerfChangeRecord[]): KerfChangeRecord[] {
  const key = (change: KerfChangeRecord) => change.dates.in_force?.date ?? change.dates.promulgated?.date ?? change.dates.adopted?.date ?? '';
  return [...changes].sort((a, b) => key(b).localeCompare(key(a)) || a.change_id.localeCompare(b.change_id));
}

/** Query parameters of a diff URL. Version ids contain '#', which an
 * unencoded URL would turn into a fragment, so the query is split by hand. */
export function diffUrlParams(url: string | null | undefined): { from: string; to: string } | null {
  const query = (url ?? '').split('?').slice(1).join('?');
  if (!query) return null;
  const params: Record<string, string> = {};
  for (const part of query.split('&')) {
    const [key, ...rest] = part.split('=');
    try { params[decodeURIComponent(key)] = decodeURIComponent(rest.join('=').replace(/\+/gu, ' ')); } catch { return null; }
  }
  return params.from && params.to ? { from: params.from, to: params.to } : null;
}

/** Diff selectors for "show the text change" of one record, if evidenced.
 * `versionsOldestFirst` resolves the index form of text_effect. */
export function changeDiffPair(change: KerfChangeRecord, versionsOldestFirst: readonly { version_id: string }[] = []): { from: string; to: string } | null {
  const effect = change.text_effect;
  if (effect?.before_version_id && effect.after_version_id) return { from: effect.before_version_id, to: effect.after_version_id };
  const fromUrl = diffUrlParams(change.diff_url);
  if (fromUrl) return fromUrl;
  const before = effect?.before_version != null ? versionsOldestFirst[effect.before_version]?.version_id : undefined;
  const after = effect?.after_version != null ? versionsOldestFirst[effect.after_version]?.version_id : undefined;
  return before && after ? { from: before, to: after } : null;
}

// ------------------------------------------------------------ legacy shapes
/** Older API: one row of a norm log's `events`. */
export interface LegacyNormEvent {
  event_id: string; document_id?: string | null; reference?: string | null; amending_article?: string | null;
  procedure_title?: string | null; procedure_id?: string | null; published_at?: string | null; effective_at?: string | null;
  date_status?: string | null; date_basis?: string | null; url?: string | null;
  commands?: { operation?: string | null; ref?: Record<string, unknown> | null; raw?: string | null; text?: string | null }[];
}

function legacyChangeType(commands: LegacyNormEvent['commands']): ChangeType {
  const command = commands?.[0];
  if (!command) return 'unbekannt';
  const raw = `${command.raw ?? command.text ?? ''}`;
  switch (command.operation) {
    case 'insert': return 'eingefügt';
    case 'delete': case 'repeal': return 'aufgehoben';
    case 'modify': return 'geändert';
    case 'replace': return /\bersetzt\b/u.test(raw) && !/\bgefasst\b/u.test(raw) ? 'ersetzt' : /\bgefasst\b/u.test(raw) ? 'neugefasst' : 'geändert';
    default: return 'unbekannt';
  }
}

/** Map an older norm-log event to a change record. Only fields with the same
 * meaning are carried over; the act date is unknown in that shape. */
export function legacyChangeFromEvent(event: LegacyNormEvent, today: string, norm?: { id?: string | null; label?: string | null; actId?: string | null }): KerfChangeRecord {
  const effective = isoDay(event.effective_at);
  const published = isoDay(event.published_at);
  const verified = event.date_status === 'official_verified';
  // A served effective day stays visible; without the verified status it is
  // explicitly marked unverified instead of being promoted or dropped.
  const inForce: KerfChangeDate = !effective
    ? { date: null, status: 'unknown', basis: event.date_basis ?? event.date_status ?? null }
    : { date: effective, status: verified ? 'official_commencement_clause' : 'unverified', basis: event.date_basis ?? null };
  const record: KerfChangeRecord = {
    change_id: event.event_id,
    act_id: norm?.actId ?? null, norm_id: norm?.id ?? null, norm_label: norm?.label ?? null,
    amending_act: {
      document_id: event.document_id ?? null, title: event.procedure_title ?? null, citation: null,
      article: event.amending_article ?? null, nummer: null, buchstabe: null,
      gazette: event.reference ? { reference: event.reference } : null, url: event.url ?? null, procedure_id: event.procedure_id ?? null,
    },
    dates: {
      adopted: { date: null, status: 'unknown', basis: 'not_in_api_response' },
      promulgated: published ? { date: published, status: 'official', basis: 'published_at' } : { date: null, status: 'unknown', basis: null },
      in_force: inForce,
    },
    change_type: legacyChangeType(event.commands),
    pending: null, state: null,
    commands: (event.commands ?? []).map(command => ({ operation: command.operation ?? null, ref: command.ref ?? null, raw: command.raw ?? command.text ?? null })),
    text_effect: null, diff_url: null, legacy: true,
  };
  record.state = changeState(record, today);
  record.pending = record.state === 'pending';
  return record;
}

/** GII "stand" string: `Typ: Text | Typ: Text`. */
export function parseStandEntries(stand: string | null | undefined): { type: string; text: string }[] {
  return (stand ?? '').split('|').map(part => part.trim()).filter(Boolean).map(part => {
    const match = /^([A-Za-zÄÖÜäöü]+):\s*(.*)$/u.exec(part);
    return match ? { type: match[1], text: match[2].trim() } : { type: 'Sonst', text: part };
  }).filter(entry => entry.text);
}

/** Classify a GII documentation note by its fixed official wording. The note
 * text is kept verbatim; no date is taken from it. */
export function classifyDocumentationNote(text: string, source = 'GII Stand (Hinweis)'): KerfDocumentationNote {
  const clean = text.trim();
  const citation = /(?:Mittelbare\s+)?Änderung(?:en)?\s+durch\s+(.+?)\s+(?:textlich|ist|sind|noch|berücksichtigt)\b/u.exec(clean)?.[1] ?? null;
  const article = citation ? /^Art\.?\s*(\d+[a-z]?)/u.exec(citation)?.[1] ?? null : null;
  const amending_act = citation ? { citation_text: citation, document_id: null, article } : null;
  if (/textlich nachgewiesen/u.test(clean) && /dokumentarisch noch nicht abschließend/u.test(clean)) {
    return { kind: 'textually_incorporated_documentation_pending', text: clean, text_incorporated: true, documentation_complete: false, amending_act, source };
  }
  if (/noch nicht (?:berücksichtigt|eingearbeitet)|nicht berücksichtigt/u.test(clean)) {
    return { kind: 'not_yet_incorporated', text: clean, text_incorporated: false, documentation_complete: null, amending_act, source };
  }
  if (/Mittelbare Änderung/u.test(clean) && /berücksichtigt/u.test(clean)) {
    return { kind: 'indirect_change_incorporated', text: clean, text_incorporated: true, documentation_complete: null, amending_act, source };
  }
  return { kind: 'other', text: clean, text_incorporated: null, documentation_complete: null, amending_act, source };
}

function standNotes(stand: string | null | undefined): Pick<KerfChangeSummary, 'act_stand_note' | 'documentation_notes'> {
  const entries = parseStandEntries(stand);
  const current = entries.find(entry => entry.type === 'Stand');
  return {
    act_stand_note: current ? { scope: 'act', text: current.text, norm_specific: false, source: 'GII Stand' } : null,
    documentation_notes: entries.filter(entry => entry.type === 'Hinweis').map(entry => classifyDocumentationNote(entry.text)),
  };
}

const dedupeNotes = (notes: KerfDocumentationNote[]) => [...new Map(notes.map(note => [note.text.replace(/\s+/gu, ' '), note])).values()];

interface LegacyLogLike {
  evidence?: { source?: { role?: string | null; capture?: unknown } | null; quality?: { source_exact?: boolean | null; reconstruction_status?: string | null } | null; amendment?: { pending_note?: string | null } | null; source_role?: string | null }[];
  events?: LegacyNormEvent[];
  norm?: { canonical_id?: string | null; label?: string | null; act?: { id?: string | null; stand?: string | null } | null } | null;
  history?: { text_history_start?: string | null; amendment_event_history_start?: string | null } | null;
  change_summary?: unknown;
}

/** Contract role of a version; older versions are mapped conservatively. */
export function versionRole(version: { source_role?: string | null; source?: { role?: string | null; capture?: unknown } | null; quality?: { source_exact?: boolean | null; reconstruction_status?: string | null } | null }): SourceRole {
  if (isSourceRole(version.source_role)) return version.source_role;
  const role = version.source?.role ?? '';
  const status = version.quality?.reconstruction_status ?? '';
  if (version.quality?.source_exact === false || /reconstruct/u.test(role) || (status && status !== 'not_reconstructed')) return 'reconstruction';
  if (/^archived|wayback|capture/u.test(role) || (record(version.source?.capture) && version.source.capture.source === 'wayback')) return 'archived_capture';
  if (/promulgation|bgbl|gvbl/u.test(role)) return 'official_promulgation';
  return 'official_consolidation';
}

/** Norm change records from an older norm log (`events`). */
export function legacyNormChanges(log: LegacyLogLike, today: string): KerfChangeRecord[] {
  const norm = { id: log.norm?.canonical_id ?? null, label: log.norm?.label ?? null, actId: log.norm?.act?.id ?? null };
  return sortChanges((log.events ?? []).map(event => legacyChangeFromEvent(event, today, norm)));
}

/** Change summary of a norm: served by the API, else derived from older fields. */
export function normChangeSummary(log: LegacyLogLike, today: string): KerfChangeSummary {
  const served = normalizeChangeSummary(log.change_summary);
  if (served) return served;
  const changes = legacyNormChanges(log, today);
  const pending = changes.filter(change => change.state === 'pending').sort((a, b) => (a.dates.in_force?.date ?? '').localeCompare(b.dates.in_force?.date ?? ''));
  const last = changes.find(change => change.state === 'in_force') ?? null;
  const versions = log.evidence ?? [];
  const byRole: Record<string, number> = {};
  for (const version of versions) { const role = versionRole(version); byRole[role] = (byRole[role] ?? 0) + 1; }
  const notes = standNotes(log.norm?.act?.stand);
  const pendingNotes = versions.map(version => version.amendment?.pending_note).filter((text): text is string => Boolean(text)).map(text => classifyDocumentationNote(text, 'GII Stand'));
  return {
    scope: 'norm', subject: log.norm?.canonical_id ?? '', as_of: today,
    last_change: last, next_pending_change: pending[0] ?? null, pending_changes: pending,
    counts: { versions: versions.length, versions_by_role: byRole, events: changes.length, events_with_in_force: changes.filter(change => change.dates.in_force?.date).length, sources: null },
    source_role: versions[0] ? versionRole(versions[0]) : null,
    act_stand_note: notes.act_stand_note,
    documentation_notes: dedupeNotes([...pendingNotes, ...notes.documentation_notes]),
    unknown_dates: changes.filter(change => !change.dates.in_force?.date).map(change => ({ change_id: change.change_id, field: 'in_force', reason: change.dates.in_force?.basis ?? null, amending_act: changeCitation(change.amending_act) })),
    completeness: { event_history: null, event_history_start: isoDay(log.history?.amendment_event_history_start), text_history_start: isoDay(log.history?.text_history_start), gaps: [] },
    derived: 'legacy',
  };
}

interface LegacyActLike {
  id: string; stand?: string | null; change_summary?: unknown;
  retrospective?: { available?: boolean | null; history_start?: string | null; current_events?: number | null; coverage?: Record<string, unknown> | null } | null;
}

/** Change summary of an act: served, else only the GII notes of the act. */
export function actChangeSummaryFrom(act: LegacyActLike, today: string): KerfChangeSummary | null {
  const served = normalizeChangeSummary(act.change_summary);
  if (served) return served;
  const notes = standNotes(act.stand);
  if (!notes.act_stand_note && !notes.documentation_notes.length) return null;
  return {
    scope: 'act', subject: act.id, as_of: today, last_change: null, next_pending_change: null, pending_changes: [],
    counts: null, source_role: null, ...notes, unknown_dates: [], completeness: null, derived: 'legacy',
  };
}

/** Does this summary have anything worth showing? */
export const summaryHasContent = (summary: KerfChangeSummary | null | undefined): summary is KerfChangeSummary => Boolean(summary && (
  summary.last_change || summary.next_pending_change || summary.act_stand_note || summary.documentation_notes.length
  || (summary.counts && (summary.counts.versions || summary.counts.events))));
