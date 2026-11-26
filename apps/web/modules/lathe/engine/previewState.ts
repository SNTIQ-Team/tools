/**
 * The live preview without re-filling the PDF.
 *
 * The preview opens the blank ZP 1a once in pdf.js and writes the answers
 * into pdf.js's own annotation storage; the visible page is then redrawn with
 * those values. pdf-lib, which builds the real document with the embedded
 * Noto Sans, runs only for the download (fill.ts). These helpers are the
 * pure part: which value every widget shows, and which warnings the preview
 * must raise before anything is downloaded (the same ones fill.ts reports).
 */
import type { Operation } from './fill';

export type Widget = { id: string; field: string; kind: 'text' | 'checkbox' };
export type StorageValue = { value: string | boolean };

/** A value for EVERY widget, so an answer that was removed also disappears
    from the page: text not in `ops` is reset to empty, a box to unchecked. */
export function previewValues(ops: readonly Operation[], widgets: readonly Widget[]): Map<string, StorageValue> {
  const text = new Map<string, string>();
  const checked = new Set<string>();
  for (const o of ops) {
    if (o.op === 'text') text.set(o.field, o.value ?? '');
    else checked.add(o.field);
  }
  const out = new Map<string, StorageValue>();
  for (const w of widgets) {
    out.set(w.id, { value: w.kind === 'text' ? (text.get(w.field) ?? '') : checked.has(w.field) });
  }
  return out;
}

/** Fields the template does not have, and text the download font cannot print
    (`UNSUPPORTED_CHARS:<field>`), in the order of `ops`. `hasGlyph` is null
    until the font's coverage is known; then only the structural check runs. */
export function previewWarnings(
  ops: readonly Operation[],
  widgets: readonly Widget[],
  hasGlyph: ((codePoint: number) => boolean) | null,
): string[] {
  const known = new Set(widgets.map((w) => w.field));
  const out: string[] = [];
  for (const o of ops) {
    if (!known.has(o.field)) { out.push(o.field); continue; }
    if (o.op !== 'text' || !hasGlyph) continue;
    for (const ch of o.value ?? '') {
      if (/\s/.test(ch)) continue;
      if (!hasGlyph(ch.codePointAt(0) as number)) { out.push(`UNSUPPORTED_CHARS:${o.field}`); break; }
    }
  }
  return out;
}
