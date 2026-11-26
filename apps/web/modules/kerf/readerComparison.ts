import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { toString } from 'mdast-util-to-string';
import { diffWordsWithSpace, type Change } from 'diff';
import type { KerfActMarkdown } from './client';
import { archiveNodeText } from './readerArchiveStructure';

function provisions(markdown: string) {
  const tree = unified().use(remarkParse).use(remarkFrontmatter).parse(markdown);
  const metadata = tree.children[0];
  const escapedPlainText = metadata?.type === 'yaml'
    && /^norm_body_format:\s*(?:escaped_plain_text|"escaped_plain_text"|'escaped_plain_text')\s*$/m.test(metadata.value);
  const rows = new Map<string, { label: string; text: string }>();
  let key: string | null = null;
  let index = tree.children[0]?.type === 'yaml' ? 1 : 0;
  // Only the leading export title/status are metadata. Source headings later
  // in the document remain part of the law, including a heading-only change.
  const heading = tree.children[index];
  if (heading?.type === 'heading' && heading.depth === 1) {
    index++;
    const status = tree.children[index];
    if (status?.type === 'blockquote' && toString(status).startsWith('Archive status:')) index++;
  }
  for (const node of tree.children.slice(index)) {
    if (node.type === 'heading' && node.depth === 2) {
      const label = toString(node);
      key = label.match(/^(?:Art\.?\s*\d+[a-z]*\s+§\s*\d+[a-z]*|(?:§§?|Art\.?)\s*\S+)/iu)?.[0] ?? label;
      // Retain duplicate source headings instead of silently overwriting one.
      const base = key;
      for (let count = 2; rows.has(key); count++) key = `${base}:${count}`;
      rows.set(key, { label, text: '' });
    } else if (node.type !== 'yaml') {
      if (!key) { key = '__preamble'; rows.set(key, { label: 'Text', text: '' }); }
      // Flattening the AST silently concatenates list items ("ab", "c" and
      // "a", "bc" both become "abc") and erases legally relevant numbers.
      // Keep the source slice so every marker, boundary and table cell survives.
      const start = node.position?.start.offset, end = node.position?.end.offset;
      const text = escapedPlainText ? archiveNodeText(node)
        : start !== undefined && end !== undefined ? markdown.slice(start, end) : toString(node);
      rows.get(key)!.text += (rows.get(key)!.text ? '\n\n' : '') + text;
    }
  }
  return rows;
}

export const comparisonReady = (body: Pick<KerfActMarkdown, 'complete' | 'partial'>) => body.complete === true && body.partial === false;
export type ReaderChange = { id: string; label: string; oldText: string; newText: string; parts: Change[] };

export function comparisonChanges(before: string, after: string): ReaderChange[] {
  const oldRows = provisions(before), newRows = provisions(after);
  return [...new Set([...newRows.keys(), ...oldRows.keys()])].flatMap(id => {
    const oldRow = oldRows.get(id), newRow = newRows.get(id);
    const oldText = oldRow ? `${oldRow.label}\n\n${oldRow.text}` : '';
    const newText = newRow ? `${newRow.label}\n\n${newRow.text}` : '';
    if (oldText === newText) return [];
    const parts = oldText.length + newText.length < 100_000
      ? diffWordsWithSpace(oldText, newText, { timeout: 20, maxEditLength: 1500 }) : undefined;
    return [{ id, label: newRow?.label ?? oldRow!.label, oldText, newText,
      parts: parts ?? [{ value: oldText, removed: true, added: false, count: 1 }, { value: newText, added: true, removed: false, count: 1 }] }];
  });
}
