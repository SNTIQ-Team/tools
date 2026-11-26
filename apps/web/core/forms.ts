/**
 * Shared form-input logic — one behaviour across all modules (Lathe,
 * Chamfer, …): German date typing and Latin-script enforcement.
 */

/** The Latin-script input filter must preserve punctuation in names. */
export const CYRILLIC_RE = /[А-Яа-яЁёІіЇїЄєҐґ]/g;

/**
 * dd.mm.yyyy formatter. Digits flow into segments (auto-advance after
 * two); typing a separator ('.', ',', '/', '-', space) closes the
 * current segment and zero-pads it — '5.' becomes '05.' immediately,
 * which users expect from paper forms.
 */
export function formatGermanDate(raw: string): string {
  const seg = ['', '', ''];
  let i = 0;
  for (const ch of raw) {
    if (/\d/.test(ch)) {
      if (i < 2 && seg[i].length === 2) i += 1;
      if (i === 2 && seg[2].length === 4) break;
      seg[i] += ch;
    } else if ('./,- '.includes(ch) && i < 2 && seg[i].length > 0) {
      seg[i] = seg[i].padStart(2, '0');
      i += 1;
    }
  }
  let out = seg[0];
  if (i >= 1) out += '.' + seg[1];
  if (i >= 2) out += '.' + seg[2];
  return out;
}
