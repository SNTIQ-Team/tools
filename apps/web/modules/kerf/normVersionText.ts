import type { KerfNormStructure, KerfStructureUnit } from './normHistoryClient';

/**
 * Render tree for one norm version from `/norms/{id}/at`: the version's
 * `text` plus structure units (absatz, satz, nummer, buchstabe,
 * doppelbuchstabe, text_block) whose `start`/`end` are offsets into that
 * text. Every character of the source text appears exactly once (markers are
 * split off, never dropped); invalid offsets yield null and the caller falls
 * back to plain paragraphs.
 */
export type VersionSegment = { kind: 'text'; text: string } | { kind: 'unit'; unit: VersionUnit };
export interface VersionUnit {
  type: string;
  number: string | null;
  locator: string;
  marker: string | null;
  segments: VersionSegment[];
}

const validUnit = (unit: unknown): unit is KerfStructureUnit => Boolean(unit) && typeof unit === 'object'
  && typeof (unit as KerfStructureUnit).type === 'string'
  && Number.isInteger((unit as KerfStructureUnit).start) && Number.isInteger((unit as KerfStructureUnit).end);

function build(text: string, unit: KerfStructureUnit, lower: number, upper: number): VersionUnit | null {
  if (!validUnit(unit) || unit.start < lower || unit.end > upper || unit.start > unit.end) return null;
  const children = Array.isArray(unit.children) ? unit.children : [];
  const segments: VersionSegment[] = [];
  let cursor = unit.start;
  let marker: string | null = null;
  const pushText = (value: string) => {
    if (!value) return;
    // The first gap carries the unit's own marker ("(1) ", "1.", "a)").
    if (!segments.length && marker === null && unit.marker) {
      const lead = value.match(/^\s*/u)![0];
      if (value.slice(lead.length).startsWith(unit.marker)) {
        marker = unit.marker;
        value = value.slice(lead.length + unit.marker.length);
        if (!value) return;
      }
    }
    const last = segments.at(-1);
    if (last?.kind === 'text') last.text += value; else segments.push({ kind: 'text', text: value });
  };
  for (const child of children) {
    if (!validUnit(child) || child.start < cursor || child.end > unit.end) return null;
    pushText(text.slice(cursor, child.start));
    const built = build(text, child, cursor, unit.end);
    if (!built) return null;
    segments.push({ kind: 'unit', unit: built });
    cursor = child.end;
  }
  pushText(text.slice(cursor, unit.end));
  return { type: unit.type, number: unit.number ?? null, locator: unit.locator ?? `${unit.type}/${unit.start}`, marker: marker ?? null, segments };
}

export function versionTree(text: string | null | undefined, structure: KerfNormStructure | null | undefined): { units: VersionUnit[]; leading: string; trailing: string } | null {
  if (!text || !structure || !Array.isArray(structure.units) || !structure.units.length) return null;
  const units: VersionUnit[] = [];
  let cursor = 0;
  let leading = '';
  for (const unit of structure.units) {
    if (!validUnit(unit) || unit.start < cursor) return null;
    const gap = text.slice(cursor, unit.start);
    if (gap.trim()) {
      // Text between top-level units is kept as its own unit, never dropped.
      if (!units.length) leading += gap; else units.push({ type: 'text_block', number: null, locator: `gap/${cursor}`, marker: null, segments: [{ kind: 'text', text: gap }] });
    }
    const built = build(text, unit, unit.start, text.length);
    if (!built) return null;
    units.push(built);
    cursor = unit.end;
  }
  return { units, leading, trailing: text.slice(cursor) };
}

/** What the tree renders (markers + text). Apart from whitespace it equals
 * the source text — the invariant the tests check. */
export function versionTreeText(tree: NonNullable<ReturnType<typeof versionTree>>): string {
  const withMarker = (unit: VersionUnit): string => unit.segments.reduce((value, segment) => value + (segment.kind === 'text' ? segment.text : withMarker(segment.unit)), unit.marker ?? '');
  return tree.leading + tree.units.map(withMarker).join('') + tree.trailing;
}
