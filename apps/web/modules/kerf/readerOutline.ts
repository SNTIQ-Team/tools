import type { KerfActNorm } from './client';

export function readerDesignator(norm: Pick<KerfActNorm, 'enbez' | 'glied'>): string {
  const parent = /^Art(?:ikel)?\.?\s*(\d+[a-z]*)$/iu.exec(norm.glied?.trim() ?? '');
  return parent && /^§\s*\d+[a-z]*$/iu.test(norm.enbez) ? `Art. ${parent[1]} ${norm.enbez}` : norm.enbez;
}

const key = (text: string) => text.toLowerCase().replace(/artikel|art\./gu, 'art').replace(/\s+/gu, '');

/** A legacy bare paragraph may identify more than one article. */
export function readerNormMatches(norms: readonly KerfActNorm[], requested: string): KerfActNorm[] {
  const label = key(requested);
  const exact = norms.filter(norm => key(readerDesignator(norm)) === label);
  if (exact.length) return exact;
  return norms.filter(norm => {
    const raw = key(norm.enbez);
    const leaf = raw.match(/^art\d+[a-z]*(§\d+[a-z]*)$/u)?.[1] ?? raw;
    return leaf === label || /^\d+[a-z]*$/u.test(label) && leaf.replace(/^(?:art|§)/u, '') === label;
  });
}

export function needsArticleChoice(matches: KerfActNorm[]): boolean {
  return matches.length > 1 && new Set(matches.map(readerDesignator)).size === matches.length;
}

/** Section names can recur in different chapters. Only adjacent rows belong
 * together; preserve source positions even when search hides an entire group. */
export function readerOutline(norms: readonly KerfActNorm[], fallback: string,
  include: (norm: KerfActNorm) => boolean = () => true) {
  const groups: { label: string; start: number; norms: KerfActNorm[] }[] = [];
  for (const [index, norm] of norms.entries()) {
    const label = norm.glied || fallback;
    let group = groups.at(-1);
    if (!group || group.label !== label) {
      group = { label, start: index, norms: [] };
      groups.push(group);
    }
    if (include(norm)) group.norms.push(norm);
  }
  return groups.filter(group => group.norms.length);
}
