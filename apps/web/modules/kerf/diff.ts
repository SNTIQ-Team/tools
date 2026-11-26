/**
 * Word-level diff for the Synopse view. Given an amendment's old→new text it
 * returns an HTML string where removed runs are wrapped in <del> and added
 * runs in <ins> (the buzer-style synopsis, rendered locally). Classic LCS on
 * whitespace/word tokens so unchanged spans stay verbatim. Large amendments
 * exceed a strict work budget and must be shown as uncompared source texts.
 */

const escapeHtml = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Split into word and whitespace tokens, both preserved so joins are exact. */
const tokenize = (s: string): string[] => s.match(/\s+|[^\s]+/g) ?? [];

export class DiffLimitError extends Error {
  constructor() { super('Text comparison exceeds the bounded diff budget'); this.name = 'DiffLimitError'; }
}

function boundedTokens(text: string | null): string[] {
  // Bound tokenization/output work as well as the quadratic table below.
  if ((text?.length ?? 0) > 200_000) throw new DiffLimitError();
  return tokenize(text ?? '');
}

/** LCS length table over token arrays, filled bottom-up. */
function lcsTable(a: string[], b: string[]): number[][] {
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > 1_000_000) throw new DiffLimitError();
  const dp: number[][] = Array.from({ length: n + 1 }, () =>
    new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j]
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  return dp;
}

export function wordDiff(oldText: string | null, newText: string | null): string {
  const a = boundedTokens(oldText);
  const b = boundedTokens(newText);
  const n = a.length;
  const m = b.length;
  const dp = lcsTable(a, b);

  let out = '';
  let del = '';
  let ins = '';
  const flush = () => {
    if (del) { out += `<del>${del}</del>`; del = ''; }
    if (ins) { out += `<ins>${ins}</ins>`; ins = ''; }
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush();
      out += escapeHtml(a[i]);
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      del += escapeHtml(a[i]); i++;
    } else {
      ins += escapeHtml(b[j]); j++;
    }
  }
  while (i < n) { del += escapeHtml(a[i]); i++; }
  while (j < m) { ins += escapeHtml(b[j]); j++; }
  flush();
  return out;
}

/** The same LCS walk rendered as TWO documents for the side-by-side view:
    the old text with its removed runs marked (<del>) and the new text with
    its added runs marked (<ins>). Unchanged spans appear in both. */
export function wordDiffSplit(
  oldText: string | null,
  newText: string | null,
): { oldHtml: string; newHtml: string } {
  const a = boundedTokens(oldText);
  const b = boundedTokens(newText);
  const n = a.length;
  const m = b.length;
  const dp = lcsTable(a, b);

  let oldHtml = '';
  let newHtml = '';
  let del = '';
  let ins = '';
  const flush = () => {
    if (del) { oldHtml += `<del>${del}</del>`; del = ''; }
    if (ins) { newHtml += `<ins>${ins}</ins>`; ins = ''; }
  };

  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      flush();
      const t = escapeHtml(a[i]);
      oldHtml += t;
      newHtml += t;
      i++; j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      del += escapeHtml(a[i]); i++;
    } else {
      ins += escapeHtml(b[j]); j++;
    }
  }
  while (i < n) { del += escapeHtml(a[i]); i++; }
  while (j < m) { ins += escapeHtml(b[j]); j++; }
  flush();
  return { oldHtml, newHtml };
}
