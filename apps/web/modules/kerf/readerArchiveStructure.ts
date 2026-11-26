import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkFrontmatter from 'remark-frontmatter';
import { toString } from 'mdast-util-to-string';
import type { Nodes, Root } from 'mdast';
import type { KerfActNorm } from './client';

export function archiveNodeText(node: Nodes): string {
  if (node.type === 'definition' || node.type === 'yaml' || node.type === 'thematicBreak') return '';
  if (node.type === 'break') return '\n';
  if (node.type === 'list') return node.children.map((item, index) => {
    const prefix = node.ordered ? `${(node.start ?? 1) + index}. ` : '- ';
    const text = archiveNodeText(item);
    return prefix + text.replace(/\n/g, `\n${' '.repeat(prefix.length)}`);
  }).join('\n');
  if ('children' in node) {
    const separator = node.type === 'root' || node.type === 'blockquote' ? '\n\n' : node.type === 'listItem' ? '\n' : '';
    return node.children.map(archiveNodeText).filter(value => value !== '').join(separator);
  }
  // Remark has already decoded CommonMark escapes/entities in text and inline
  // code. Preserve that visible text, not the serializer's literal backslashes.
  return 'value' in node && typeof node.value === 'string' ? node.value : toString(node);
}

/** The export H1 belongs to the selected CAS, whose title can differ from HEAD. */
export function archiveTitle(markdown: string, norm?: string | null): string | undefined {
  // Export titles occupy one line. Avoid parsing a multi-megabyte book merely
  // to display its title, and never promote a heading inside a norm body.
  const body = markdown.replace(/^\uFEFF?---[\t ]*\r?\n[\s\S]*?\r?\n---[\t ]*(?:\r?\n|$)/u, '').trimStart();
  const line = body.split(/\r?\n/u, 1)[0];
  const node = unified().use(remarkParse).parse(line).children[0];
  if (node?.type !== 'heading' || node.depth !== 1) return undefined;
  const title = toString(node).trim();
  const suffix = norm ? ` — ${norm}` : '';
  return (suffix && title.endsWith(suffix) ? title.slice(0, -suffix.length) : title) || undefined;
}

/** Use the selected source edition, not HEAD, for navigation and text search. */
export function archiveSections(tree: Root): { norm: KerfActNorm; start: number; end: number }[] {
  const headings = tree.children.flatMap((node, offset) => node.type === 'heading' && node.depth === 2 ? [{ node, offset }] : []);
  return headings.map(({ node: heading, offset }, index) => {
    const label = toString(heading);
    const separator = label.indexOf(' — ');
    const ordinary = /^((?:Art\.?\s*\d+[a-z]*\s+§\s*\d+[a-z]*|(?:§{1,2}|Art\.?)\s*\d+[a-z]*))(?:\s+(?:[·–-]\s*)?(.+))?$/u.exec(label);
    const enbez = separator >= 0 ? label.slice(0, separator) : ordinary?.[1] ?? label;
    const titel = separator >= 0 ? label.slice(separator + 3) : ordinary?.[2];
    const body = tree.children.slice(offset + 1, headings[index + 1]?.offset ?? tree.children.length);
    return { start: offset + 1, end: headings[index + 1]?.offset ?? tree.children.length,
      norm: { enbez, ...(titel ? { titel } : {}), text: body.map(archiveNodeText).filter(Boolean).join('\n\n').trim() } };
  });
}

export function archiveNorms(markdown: string): KerfActNorm[] {
  return archiveSections(unified().use(remarkParse).use(remarkFrontmatter).parse(markdown)).map(section => section.norm);
}

type Marker = { number: number; letter: string };
const marker = (number: string, letter: string): Marker => ({ number: Number(number), letter });
const consecutive = (previous: Marker, next: Marker) => next.number === previous.number + 1 && !next.letter
  || next.number === previous.number && next.letter === (previous.letter ? String.fromCharCode(previous.letter.charCodeAt(0) + 1) : 'a');

function paragraphStarts(text: string): number[] {
  const first = /^\s*\((\d{1,3})([a-z]?)\)/u.exec(text);
  if (!first) return [0];
  let previous = marker(first[1], first[2]);
  const starts = [0];
  const candidates = /([.!?][\s\u00a0]*|[\r\n][\t \u00a0]*)\((\d{1,3})([a-z]?)\)(?=\s*\S)/gu;
  for (const candidate of text.matchAll(candidates)) {
    const next = marker(candidate[2], candidate[3]);
    if (!consecutive(previous, next)) continue;
    starts.push(candidate.index! + candidate[1].length);
    previous = next;
  }
  return starts;
}

function sentenceStarts(text: string): number[] {
  // Attached ordinal digits are specific to flattened Bayern superscripts.
  // Require an initial 1 and a German-style capitalized word, and only accept
  // consecutive ordinals after terminal punctuation. Never infer plain prose.
  const first = /^\s*(?:\(\d{1,3}[a-z]?\)\s*)?1(?=[A-ZÄÖÜ][a-zäöüß])/u.exec(text);
  if (!first) return [0];
  const starts = [0];
  let previous = 1;
  const candidates = /([.!?][\s\u00a0]*)(\d{1,3})(?=[A-ZÄÖÜ][a-zäöüß])/gu;
  for (const candidate of text.matchAll(candidates)) {
    const next = Number(candidate[2]);
    if (next !== previous + 1) continue;
    starts.push(candidate.index! + candidate[1].length);
    previous = next;
  }
  return starts;
}

/** Conservative layout recovery only; joining the parts returns identical source bytes. */
export function sourceParagraphs(text: string, options: { bavarianSentences?: boolean } = {}): string[] {
  const paragraphs = paragraphStarts(text);
  return paragraphs.flatMap((start, index) => {
    const paragraph = text.slice(start, paragraphs[index + 1] ?? text.length);
    if (!options.bavarianSentences) return [paragraph];
    const sentences = sentenceStarts(paragraph);
    return sentences.map((offset, sentence) => paragraph.slice(offset, sentences[sentence + 1] ?? paragraph.length));
  });
}
