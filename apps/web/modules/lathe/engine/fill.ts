/**
 * SNTIQ PDF Engine — generic, form-agnostic filler.
 *
 * v2 rewrite. Differences vs. the old pdfUtils:
 *  - Declarative: a form is described by a list of Operations produced by a
 *    mapping function (see mapping.ts). The engine itself knows nothing about
 *    ZP 1a; the next form is just another mapping file.
 *  - Unicode-safe: a full TTF (Noto Sans, Latin + Cyrillic + € + ß) is
 *    embedded via fontkit and used for field appearances. The old engine
 *    silently STRIPPED Cyrillic characters; this one renders them.
 *  - Fail-soft: a missing/renamed PDF field never crashes generation; it is
 *    collected into a warnings list (field names only, no user data) that the
 *    caller may log.
 */

import { PDFDocument, PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

export type Operation =
  | { op: 'text'; field: string; value: string }
  | { op: 'check'; field: string };

export interface FillResult {
  bytes: Uint8Array;
  /**
   * Non-fatal problems, no private data ever:
   *  - a plain field name → the field could not be set (missing/renamed)
   *  - `UNSUPPORTED_CHARS:<field>` → the entered text contains characters
   *    the embedded font cannot print (would render as .notdef boxes)
   *  - `FONT_EMBED_FAILED` → fell back to the form's WinAnsi font
   */
  warnings: string[];
}

// keyed by URL — the engine is reused across forms, which may pass
// different fonts (e.g. one with Arabic coverage)
const fontBytesCache = new Map<string, ArrayBuffer>();

const loadFontBytes = async (fontUrl: string): Promise<ArrayBuffer> => {
  const cached = fontBytesCache.get(fontUrl);
  if (cached) return cached;
  const res = await fetch(fontUrl);
  if (!res.ok) throw new Error(`FONT_FETCH_${res.status}`);
  const bytes = await res.arrayBuffer();
  fontBytesCache.set(fontUrl, bytes);
  return bytes;
};

export const fillPdf = async (
  templateBytes: ArrayBuffer,
  operations: Operation[],
  fontUrl = '/fonts/NotoSans-Regular.ttf'
): Promise<FillResult> => {
  const warnings: string[] = [];

  const pdfDoc = await PDFDocument.load(templateBytes);
  pdfDoc.registerFontkit(fontkit);

  let customFont: PDFFont | null = null;
  let hasGlyph: ((codePoint: number) => boolean) | null = null;
  try {
    const fontBytes = await loadFontBytes(fontUrl);
    customFont = await pdfDoc.embedFont(fontBytes, { subset: true });
    try {
      // second fontkit instance purely for glyph-coverage checks (pdf-lib
      // does not expose its own): unsupported characters would otherwise be
      // printed as empty .notdef boxes on a legal document with no warning
      const fkFont = fontkit.create(new Uint8Array(fontBytes));
      hasGlyph = (cp) => fkFont.hasGlyphForCodePoint(cp);
    } catch {
      // coverage check is best-effort; filling proceeds without it
    }
  } catch {
    // Engine still works with the form's default WinAnsi font;
    // non-Latin characters are then transliterated below.
    warnings.push('FONT_EMBED_FAILED');
  }

  const form = pdfDoc.getForm();

  const sanitizeForWinAnsi = (s: string) =>
    s.replace(/ẞ/g, 'SS').replace(/[^\u0000-\u00FF€]/g, '?');

  // characters the output cannot represent: with the custom font anything
  // without a glyph (would print as .notdef boxes), with the WinAnsi
  // fallback anything sanitizeForWinAnsi replaces by '?' (ẞ→SS is lossless)
  const hasUnsupportedChars = (s: string): boolean => {
    if (customFont) {
      if (!hasGlyph) return false;
      for (const ch of s) {
        if (/\s/.test(ch)) continue; // whitespace is layout, not glyphs
        if (!hasGlyph(ch.codePointAt(0) as number)) return true;
      }
      return false;
    }
    return /[^\u0000-\u00FF€ẞ]/.test(s);
  };

  for (const o of operations) {
    try {
      if (o.op === 'text') {
        const field = form.getTextField(o.field);
        const raw = o.value ?? '';
        const value = customFont ? raw : sanitizeForWinAnsi(raw);
        // pre-validate printability so the UI can ask for a Latin
        // transliteration instead of silently shipping an illegible form
        if (hasUnsupportedChars(raw)) warnings.push(`UNSUPPORTED_CHARS:${o.field}`);
        field.setText(value);
        if (customFont) field.updateAppearances(customFont);
      } else {
        form.getCheckBox(o.field).check();
      }
    } catch {
      warnings.push(o.field);
    }
  }

  const bytes = await pdfDoc.save();
  return { bytes, warnings };
};
