import type { Root, RootContent } from 'mdast';
import { toString } from 'mdast-util-to-string';
import type { KerfActNorm } from './client';
import { readerDesignator } from './readerOutline';

/**
 * GII lists the official table of contents as a pseudo-norm ("Inhaltsübersicht")
 * whose XML body is usually empty. The reader must not show it as a provision
 * "without text": it is rendered as a collapsed table of contents instead —
 * consistently in the reader, the preview, archived editions and exports.
 */
const TOC_LABEL = /^(?:inhaltsübersicht|inhaltsverzeichnis|übersicht|inhalt|gliederung)$/iu;
/** Placeholder the archive export writes for a body-less source norm. */
const EMPTY_BODY = /^_?\s*Kein Normtext im konsolidierten Quellsnapshot\.?\s*_?$/u;

export const isTocLabel = (label: string | null | undefined) => TOC_LABEL.test((label ?? '').replace(/\s+/gu, ' ').trim());

const emptyBody = (text: string | null | undefined) => {
  const value = (text ?? '').trim();
  return !value || EMPTY_BODY.test(value);
};

/** A table-of-contents entry of the source (with or without its own text). */
export const isTocNorm = (norm: Pick<KerfActNorm, 'enbez' | 'text'>) => isTocLabel(norm.enbez);
/** The body-less pseudo-norm that must never read "no text". */
export const isTocPseudoNorm = (norm: Pick<KerfActNorm, 'enbez' | 'text'>) => isTocNorm(norm) && emptyBody(norm.text);

/** Provisions proper: what counts, navigates and exports as a norm. */
export const readerProvisions = <T extends Pick<KerfActNorm, 'enbez' | 'text'>>(norms: readonly T[]): T[] => norms.filter(norm => !isTocPseudoNorm(norm));

/** Plain-text export of provisions (Copy): pseudo-norms are left out. */
export function provisionsText(norms: readonly KerfActNorm[]): string {
  return readerProvisions(norms).map(norm => `${readerDesignator(norm)}${norm.titel ? ` ${norm.titel}` : ''}\n${norm.text ?? ''}`).join('\n\n');
}

/** Markdown export: drop body-less table-of-contents sections, keep the rest byte for byte. */
export function stripTocPlaceholders(markdown: string): string {
  return markdown.replace(/(^|\n)##[ \t]+([^\n]+)\n+((?:(?!##[ \t])[^\n]*\n?)*)/gu, (section, lead: string, heading: string, body: string) => {
    if (!isTocLabel(heading) || !emptyBody(body)) return section;
    return lead;
  }).replace(/\n{3,}/gu, '\n\n');
}

/**
 * remark plugin for archived editions: a table-of-contents section becomes a
 * collapsed <details>. A body-less one gets a marker the renderer fills with a
 * generated outline; one with source text keeps that text inside.
 */
export function remarkTocSections(summaryLabel?: string) {
  return (tree: Root) => {
    const children = tree.children;
    for (let index = 0; index < children.length; index++) {
      const node = children[index];
      if (node.type !== 'heading' || node.depth !== 2) continue;
      const label = toString(node).trim();
      if (!isTocLabel(label)) continue;
      let end = index + 1;
      while (end < children.length && !(children[end].type === 'heading' && (children[end] as { depth: number }).depth <= 2)) end++;
      const body = children.slice(index + 1, end);
      const text = body.map(item => toString(item)).join('\n').trim();
      // A body replaced by verified source structure (a table, say) is not empty.
      const structured = body.some(item => Boolean((item.data as { hProperties?: Record<string, unknown> } | undefined)?.hProperties));
      const empty = !structured && body.every(item => item.type === 'paragraph' || item.type === 'thematicBreak') && emptyBody(text);
      const summary = { type: 'paragraph', data: { hName: 'summary' }, children: [{ type: 'text', value: summaryLabel ?? label }] };
      const content = empty
        ? [{ type: 'paragraph', children: [], data: { hName: 'div', hProperties: { 'data-reader-toc-outline': 'true' } } }]
        : body;
      const details = { type: 'tocSection', data: { hName: 'details', hProperties: { 'data-reader-toc': empty ? 'generated' : 'source' } }, children: [summary, ...content] };
      children.splice(index, end - index, details as unknown as RootContent);
    }
  };
}
