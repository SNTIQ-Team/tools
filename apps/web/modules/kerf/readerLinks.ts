import type { KerfAct, KerfActNorm, KerfStatutoryCitation } from './client';

export interface ReaderReference {
  kind: 'local' | 'external';
  actId?: string;
  norm?: string;
  pinpoint?: string;
  at?: string;
  url?: string;
  label: string;
}

export interface ReaderTextPart {
  text: string;
  start: number;
  end: number;
  reference?: ReaderReference;
}

export interface ReaderLinkContext {
  actId: string;
  acts: KerfAct[];
  citations?: KerfStatutoryCitation[];
  norms?: Pick<KerfActNorm, 'enbez'>[];
}

interface NormHead { start: number; end: number; norm: string; pinpoint?: string }
interface NormGroup { start: number; end: number; heads: NormHead[]; sharedScope: boolean }
interface Candidate { start: number; end: number; reference: ReaderReference; priority: number }
interface Span { start: number; end: number }

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const clean = (text: string) => text.trim().replace(/\s+/gu, ' ');
const overlaps = (a: Span, b: Span) => a.start < b.end && b.start < a.end;
const normKey = (text: string) => clean(text).replace(/^Art(?:ikel[sn]?)?\.?\s*/iu, 'Art. ').replace(/^§\s*/u, '§ ').toLowerCase();
const referenceKey = (ref: ReaderReference) => JSON.stringify([ref.kind, ref.actId, normKey(ref.norm ?? ''), ref.url]);
// These short German words are prose, not lettered subdivisions. Multi-letter
// identifiers such as aa, ii, ca and iaa occur in official EU references.
const letterProse = /^(?:der|die|das|den|dem|des|ein|und|oder|wie|mit|von|vom|zur|zum|für|auf|aus|bei|bis|ist|als|im|in|am|an|zu|je|ob|es|er|sie)$/iu;
const pinpointLevel = (unit: string): number => /^(?:Abs|Unterabs)/iu.test(unit) ? 1
  : /^(?:Satz|Sätze|S\.)$/iu.test(unit) ? 2 : /^Halbsatz$/iu.test(unit) ? 3
    : /^(?:Nr|Nummer)/iu.test(unit) ? 4 : /^Dreifach/iu.test(unit) ? 7 : /^Doppel/iu.test(unit) ? 6 : 5;

function pinpointEnd(text: string, position: number, plural: boolean, needsSecondHead = plural): number {
  const unit = /^(?:\s+|\s*(?:,|und|oder|u\.)\s+)(?<unit>Abs(?:atz|ätze)?\.?|Satz|Sätze|S\.|Nrn?\.?|Nummer(?:n)?|(?:Doppel|Dreifach)?buchst(?:abe[n]?)?\.?|Halbsatz|Unterabs(?:atz|ätze)?\.?|Alternative)\s*(?<value>\d+[a-z]*|[a-z]{1,3})(?![\p{L}\p{N}_])/iu;
  const nextValue = /^\s*(?:,|bis|und|oder|u\.)\s*(?<value>\d+[a-z]*|[a-z]{1,3})(?![\p{L}\p{N}_])/iu;
  let end = position;
  while (true) {
    const match = unit.exec(text.slice(end));
    if (!match) break;
    const letters = /^[a-z]+$/iu.test(match.groups!.value);
    if (letters !== /buchst/iu.test(match.groups!.unit) || (letters && letterProse.test(match.groups!.value))) break;
    end += match[0].length;
    // §§ names several provisions. A bare number after a singular Absatz
    // belongs to the next provision; explicitly plural units retain lists.
    const explicitList = /^(?:Absätze|Unterabsätze|Sätze|Nummern|Nrn\.?|Buchstaben)$/iu.test(match.groups!.unit);
    const values = !needsSecondHead || letters || explicitList;
    if (values) {
      for (let next = nextValue.exec(text.slice(end)); next; next = nextValue.exec(text.slice(end))) {
        if (/^[a-z]+$/iu.test(next.groups!.value) !== letters) break;
        if (letters && letterProse.test(next.groups!.value)) break;
        const followingUnit = unit.exec(text.slice(end + next[0].length));
        if (plural && !letters && !explicitList && followingUnit
          && pinpointLevel(followingUnit.groups!.unit) <= pinpointLevel(match.groups!.unit)) break;
        end += next[0].length;
      }
    }
  }
  return end;
}

function balancedEnd(text: string, span: Span): number {
  const stack: string[] = [];
  for (const char of text.slice(span.start, span.end)) {
    if (char === '(' || char === '[') stack.push(char === '(' ? ')' : ']');
    else if (char === stack.at(-1)) stack.pop();
  }
  let end = span.end;
  while (stack.length && text[end] === stack.at(-1)) { stack.pop(); end++; }
  return end;
}

function normGroups(text: string): NormGroup[] {
  const start = /(?<![\p{L}\p{N}_§])(?<marker>§§?|Art(?:ikel[sn]?)?\.?)\s*(?<number>\d+[a-z]*)(?![\p{L}\p{N}_])/giu;
  const continuation = /^\s*(?:,|und|oder|sowie|u\.|[–—-]|bis(?:\s+einschließlich)?)\s*(?:(?<marker>§§?|Art(?:ikel[sn]?)?\.?)\s*)?(?<number>\d+[a-z]*)(?![\p{L}\p{N}_])/iu;
  const groups: NormGroup[] = [];
  for (let match = start.exec(text); match; match = start.exec(text)) {
    const marker = match.groups!.marker.startsWith('§') ? '§' : 'Art.';
    const plural = match.groups!.marker === '§§';
    let sharedScope = true;
    let end = start.lastIndex;
    const firstNorm = `${marker} ${match.groups!.number.toLowerCase()}`;
    const firstPinpoint = text.slice(end, pinpointEnd(text, end, plural));
    end += firstPinpoint.length;
    const heads: NormHead[] = [{
      start: match.index, end, norm: firstNorm,
      ...(firstPinpoint ? { pinpoint: `${firstNorm} ${clean(firstPinpoint)}` } : {}),
    }];
    while (true) {
      const next = continuation.exec(text.slice(end));
      if (!next) break;
      const repeated = next.groups!.marker;
      if (!repeated && /^\.\s*(?:(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember)\s+|\d{1,2}\.\s*)\d{4}\b/iu.test(text.slice(end + next[0].length))) break;
      if (repeated && (repeated.startsWith('§') ? '§' : 'Art.') !== marker) break;
      // Repeated singular designations can mix a local citation with a
      // foreign one (§82 oder §11 des Zweiten Buches). Unlike §§ lists,
      // their preceding members need independent evidence for act scope.
      if (repeated && !plural) sharedScope = false;
      const label = repeated
        ? new RegExp(`${escapeRegExp(repeated)}\\s*${escapeRegExp(next.groups!.number)}$`, 'iu').exec(next[0])
        : new RegExp(`${escapeRegExp(next.groups!.number)}$`, 'iu').exec(next[0]);
      const headStart = end + (label?.index ?? next[0].length - next.groups!.number.length);
      end += next[0].length;
      const tail = text.slice(end, pinpointEnd(text, end, plural, false));
      end += tail.length;
      const norm = `${marker} ${next.groups!.number.toLowerCase()}`;
      heads.push({ start: headStart, end, norm, ...(tail ? { pinpoint: `${norm} ${clean(tail)}` } : {}) });
    }
    groups.push({ start: match.index, end, heads, sharedScope });
    start.lastIndex = end;
  }
  return groups;
}

function explicitForeignTail(text: string, position: number): boolean {
  const tail = text.slice(position, position + 180);
  if (/^\s+(?:dieses|diesem|dieser|vorliegenden)\s+(?:Gesetz(?:es)?|Verordnung)\b/iu.test(tail)) return false;
  if (/^\s+(?:des|der|dem|den)\s+/iu.test(tail)) return true;
  return /^\s*\(?\s*(?:SGB\b|[A-ZÄÖÜ][\p{L}\p{N}/.-]*[A-ZÄÖÜ][\p{L}\p{N}/.-]*\b|[A-ZÄÖÜ][\p{L}-]*(?:gesetz(?:es)?|verordnung(?:en)?|ordnung(?:en)?)\b)/u.test(tail);
}

function euCandidates(text: string, groups: NormGroup[]): Candidate[] {
  const pattern = /(?<![\p{L}\p{N}_])(?<kind>Verordnung|Richtlinie)\s*(?:\((?:EU|EG|EWG)\)\s*(?:(?<old>Nr\.?)\s*)?(?<first>\d{1,4})\/(?<second>\d{1,4})|(?<year>\d{4})\/(?<number>\d{1,4})\/(?:EU|EG|EWG))(?![\p{L}\p{N}_/])/giu;
  const candidates: Candidate[] = [];
  for (const match of text.matchAll(pattern)) {
    const values = match.groups!;
    const year = values.year ?? (values.old ? values.second : values.first);
    const number = values.number ?? (values.old ? values.first : values.second);
    if (!/^(?:19|20)\d{2}$/u.test(year) || Number(number) < 1) continue;
    const group = groups.findLast((row) => row.end <= match.index && /^\s*(?:(?:der|des)\s+)?$/iu.test(text.slice(row.end, match.index)));
    const start = group?.start ?? match.index;
    const end = match.index + match[0].length;
    candidates.push({ start, end, priority: 100, reference: {
      kind: 'external',
      url: `https://eur-lex.europa.eu/eli/${values.kind.toLowerCase() === 'verordnung' ? 'reg' : 'dir'}/${year}/${Number(number)}/oj/deu`,
      label: clean(text.slice(start, end)),
      ...(group?.heads.length === 1 ? { norm: group.heads[0].norm, pinpoint: group.heads[0].pinpoint } : {}),
    } });
  }
  return candidates;
}

const SOCIAL_BOOKS = ['Ersten', 'Zweiten', 'Dritten', 'Vierten', 'Fünften', 'Sechsten', 'Siebten', 'Achten', 'Neunten', 'Zehnten', 'Elften', 'Zwölften', 'Dreizehnten', 'Vierzehnten'];

// Reader resources publish immutable array snapshots. Every paragraph and
// structured inline flow shares these indexes; rebuilding a 2,500-norm set
// per flow otherwise makes a complete book quadratic. A replaced snapshot
// naturally gets new indexes, and appended/removed rows invalidate by length.
type SnapshotIndex<T> = { length: number; value: T };
const actIndexes = new WeakMap<KerfAct[], SnapshotIndex<{ byId: Map<string, KerfAct>; books: Map<number, KerfAct[]> }>>();
const normIndexes = new WeakMap<NonNullable<ReaderLinkContext['norms']>, SnapshotIndex<Set<string>>>();
type CompiledCitation = { row: KerfStatutoryCitation; pattern: RegExp };
const citationIndexes = new WeakMap<KerfStatutoryCitation[], SnapshotIndex<Map<string, CompiledCitation[]>>>();
const noNorms: NonNullable<ReaderLinkContext['norms']> = [];
const noCitations: KerfStatutoryCitation[] = [];

function snapshotIndex<Row, Value>(rows: Row[], cache: WeakMap<Row[], SnapshotIndex<Value>>, build: () => Value): Value {
  const cached = cache.get(rows);
  if (cached?.length === rows.length) return cached.value;
  const value = build();
  cache.set(rows, { length: rows.length, value });
  return value;
}

function compiledContext(context: ReaderLinkContext) {
  const { byId, books } = snapshotIndex(context.acts, actIndexes, () => {
    const byId = new Map<string, KerfAct>(), books = new Map<number, KerfAct[]>();
    for (const act of context.acts) {
      if (!byId.has(act.id)) byId.set(act.id, act);
      const match = /^SGB\s+(\d+)(?:\s+\d{4})?$/iu.exec(act.jurabk);
      if (match && String(Number(match[1])) === match[1]) {
        const book = Number(match[1]);
        books.set(book, [...(books.get(book) ?? []), act]);
      }
    }
    return { byId, books };
  });
  const norms = context.norms ?? noNorms, citations = context.citations ?? noCitations;
  const ownNorms = snapshotIndex(norms, normIndexes, () => new Set(norms.map(norm => normKey(norm.enbez))));
  const bySource = snapshotIndex(citations, citationIndexes, () => {
    const bySource = new Map<string, CompiledCitation[]>();
    for (const row of citations) {
      if (!row.citation_text?.trim()) continue;
      const phrase = row.citation_text.trim().split(/\s+/u).map(escapeRegExp).join('\\s+');
      const pattern = new RegExp(`(?<![\\p{L}\\p{N}_§])${phrase}(?![\\p{L}\\p{N}_])`, 'giu');
      const rows = bySource.get(row.source_act) ?? [];
      rows.push({ row, pattern });
      bySource.set(row.source_act, rows);
    }
    return bySource;
  });
  return { byId, books, ownNorms, citations: bySource.get(context.actId) ?? [] };
}

/** Tokenize only the original plain source. React renders these text fragments;
 * generated markup is never reparsed, so repeated/overlapping citations cannot
 * corrupt either link attributes or the wording of a provision. */
export function tokenizeLegalText(text: string, context: ReaderLinkContext): ReaderTextPart[] {
  if (!text) return [];
  const groups = normGroups(text);
  // A mixed designation such as Art. 97 § 1 ... EGAO shares the trailing
  // foreign act. Carry that scope over adjacent citation groups, but never
  // across intervening prose or a sentence boundary.
  const foreignScopes = new Set<NormGroup>();
  for (let index = groups.length - 1; index >= 0; index--) {
    const group = groups[index], next = groups[index + 1];
    if (explicitForeignTail(text, group.end) || (next && foreignScopes.has(next)
      && /^\s*(?:(?:,|und|oder|sowie|u\.)\s*)?$/iu.test(text.slice(group.end, next.start)))) foreignScopes.add(group);
  }
  const candidates = euCandidates(text, groups);
  const evidence: Span[] = [];
  const { byId, books, ownNorms, citations } = compiledContext(context);
  const currentAct = byId.get(context.actId);
  const mixedBookGroups = new Set(groups.filter(group => !group.sharedScope
    && /^SGB\s/iu.test(currentAct?.jurabk ?? '')
    && /^\s+(?:des|dem)\s+[\p{L}]+\s+Buches\b/iu.test(text.slice(group.end))));
  const indexed = new Map<string, Candidate[]>();
  const matches: { row: KerfStatutoryCitation; span: Span }[] = [];

  for (const { row, pattern } of citations) {
    for (const match of text.matchAll(pattern)) {
      const span = { start: match.index, end: match.index + match[0].length };
      span.end = balancedEnd(text, span);
      evidence.push(span);
      matches.push({ row, span });
    }
  }
  for (const { row, span } of matches) {
    if (row.status !== 'resolved' || !row.target_act || !row.target_norm || !byId.has(row.target_act)) continue;
    const group = groups.find((item) => item.start === span.start
      || item.heads.some(head => head.start === span.start && head.end === span.end));
    const containing = matches.filter(({ span: other }) => other.start <= span.start && other.end >= span.end
      && (other.start < span.start || other.end > span.end));
    // A compound row can retain only one target in older aggregated indexes.
    // Keep an exact independently resolved member only when every containing
    // row proves the same act and names a member of this complete group.
    // Unknown, conflicting or merely overlapping source evidence still wins.
    if (containing.length && !(group && group.heads.length > 1
      && group.heads.some(head => head.start === span.start && head.end === span.end && normKey(head.norm) === normKey(row.target_norm!))
      && containing.every(({ row: other, span: outer }) => other.status === 'resolved'
        && other.target_act === row.target_act && other.target_norm
        && outer.start === group.start && outer.end >= group.end
        && group.heads.some(head => normKey(head.norm) === normKey(other.target_norm!))))) continue;
    if (group && span.end <= group.end && foreignScopes.has(group)
      && (group.sharedScope || !group.heads.slice(0, -1).some(head => head.start === span.start && head.end === span.end))) continue;
    const heads = group?.heads.filter((item) => normKey(item.norm) === normKey(row.target_norm!)
      && (!containing.length || (item.start === span.start && item.end === span.end))
      // Older indexes applied a trailing foreign book to every singular
      // member and repeated the entire phrase as evidence. Only an exact
      // independently scoped member may restore an earlier mixed target.
      && !(mixedBookGroups.has(group) && item !== group.heads.at(-1)
        && (span.start !== item.start || span.end !== item.end))) ?? [undefined];
    for (const head of heads) {
      const target = group && group.heads.length > 1 && head
        ? { start: head.start, end: head === group.heads.at(-1) ? Math.max(head.end, span.end) : head.end } : span;
      const ref: ReaderReference = {
        kind: 'local', actId: row.target_act, norm: row.target_norm,
        label: `${row.target_norm} ${row.target_jurabk ?? ''}`.trim(),
        ...(head?.pinpoint ? { pinpoint: head.pinpoint } : row.target_pinpoint ? { pinpoint: row.target_pinpoint } : {}),
      };
      const key = `${target.start}:${target.end}`;
      indexed.set(key, [...(indexed.get(key) ?? []), { ...target, reference: ref, priority: 50 }]);
    }
  }
  for (const rows of indexed.values()) {
    if (new Set(rows.map((row) => referenceKey(row.reference))).size === 1) candidates.push(rows[0]);
  }

  for (const group of groups) {
    const book = /^\s+(?:des|dem)\s+([\p{L}]+)\s+Buches\b/iu.exec(text.slice(group.end));
    const ordinal = book ? SOCIAL_BOOKS.findIndex((word) => word.toLowerCase() === book[1].toLowerCase()) + 1 : 0;
    if (ordinal && /^SGB\s/iu.test(currentAct?.jurabk ?? '')
      && !matches.some(({row, span}) => row.status !== 'resolved' && overlaps(span, group))) {
      const matches = books.get(ordinal) ?? [];
      if (matches.length === 1) {
        for (const head of group.sharedScope ? group.heads : group.heads.slice(-1)) candidates.push({
          start: head.start, end: group.heads.length === 1 ? group.end + book![0].length : head.end,
          priority: 80, reference: {
            kind: 'local', actId: matches[0].id, norm: head.norm,
            label: `${head.norm} ${matches[0].jurabk}`,
            ...(head.pinpoint ? { pinpoint: head.pinpoint } : {}),
          },
        });
      }
    }
    if (foreignScopes.has(group)) continue;
    for (const head of group.heads) {
      if (!ownNorms.has(normKey(head.norm)) || evidence.some((span) => overlaps(span, head))) continue;
      candidates.push({ ...head, priority: 10, reference: {
        kind: 'local', actId: context.actId, norm: head.norm,
        label: `${head.norm} ${currentAct?.jurabk ?? ''}`.trim(),
        ...(head.pinpoint ? { pinpoint: head.pinpoint } : {}),
      } });
    }
  }

  const selected: Candidate[] = [];
  for (const candidate of candidates.sort((a, b) => b.priority - a.priority || (b.end - b.start) - (a.end - a.start) || a.start - b.start)) {
    if (!selected.some((item) => overlaps(item, candidate))) selected.push(candidate);
  }
  const output: ReaderTextPart[] = [];
  let position = 0;
  for (const candidate of selected.sort((a, b) => a.start - b.start)) {
    if (candidate.start > position) output.push({ start: position, end: candidate.start, text: text.slice(position, candidate.start) });
    output.push({ start: candidate.start, end: candidate.end, text: text.slice(candidate.start, candidate.end), reference: candidate.reference });
    position = candidate.end;
  }
  if (position < text.length) output.push({ start: position, end: text.length, text: text.slice(position) });
  return output;
}
