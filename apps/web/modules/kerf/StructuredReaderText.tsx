'use client';

import React, { useMemo } from 'react';
import type { ReaderNode } from './readerStructure';
import { readerInlineTags, officialReaderAsset } from './readerStructure';
import { tokenizeLegalText, type ReaderLinkContext } from './readerLinks';
import { ReferenceLink, type ReaderReference } from './ReaderText';

export const readerNodeText = (nodes: ReaderNode[]): string => nodes.map(node => node.type === 'text' ? node.text : readerNodeText(node.children)).join('');

function sourceAsset(node: Extract<ReaderNode, { type: 'element' }>, key: number): React.ReactNode {
  const { src, alt, width, height } = node.attrs ?? {};
  if (!officialReaderAsset(src)) return null;
  return <a key={key} href={src} target="_blank" rel="noopener noreferrer" data-reader-source-asset title="Amtliche Quelle: Gesetze im Internet">{node.tag === 'img'
    // Original official publication images stay separate from generated law links.
    // eslint-disable-next-line @next/next/no-img-element
    ? <img src={src} alt={alt || 'Amtliche Abbildung'} width={width} height={height} loading="lazy" decoding="async" />
    : readerNodeText(node.children) || `PDF · ${src!.split('/').at(-1)}`}</a>;
}

// Slices retain source inline markup. Links and highlights are added around the
// slice, so a citation split by emphasis remains one keyboard-focusable link.
function sliceNodes(nodes: ReaderNode[], start: number, end: number): React.ReactNode[] {
  let offset = 0;
  const fullLength = readerNodeText(nodes).length;
  return nodes.flatMap<React.ReactNode>((node, index) => {
    const length = node.type === 'text' ? node.text.length : readerNodeText(node.children).length;
    const from = Math.max(0, start - offset), to = Math.min(length, end - offset);
    const position = offset;
    offset += length;
    if (node.type === 'element' && ['img', 'source-file'].includes(node.tag)) return position >= start && (position < end || position === end && end === fullLength) ? [sourceAsset(node, index)] : [];
    if (node.type === 'element' && node.tag === 'br') return position >= start && (position < end || position === end && end === fullLength) ? [<br key={index} />] : [];
    if (!length && node.type === 'element' && position >= start && (position < end || position === end && end === fullLength)) return [React.createElement(node.tag, { key: index }, sliceNodes(node.children, 0, 0))];
    if (from >= to) return [];
    if (node.type === 'text') return [node.text.slice(from, to)];
    return [React.createElement(node.tag, { key: index, ...(node.attrs?.role ? { 'data-reader-role': node.attrs.role } : {}) }, sliceNodes(node.children, from, to))];
  });
}

function InlineText({ nodes, context, query, at, onReference }: {
  nodes: ReaderNode[]; context: ReaderLinkContext; query?: string; at?: string; onReference: (reference: ReaderReference) => void;
}) {
  const text = readerNodeText(nodes);
  const parts = useMemo(() => tokenizeLegalText(text, context), [text, context]);
  const highlights = useMemo(() => {
    if (!query?.trim()) return [];
    const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    return [...text.matchAll(new RegExp(escaped, 'giu'))].map(match => ({ start: match.index, end: match.index + match[0].length }));
  }, [text, query]);
  const content = (start: number, end: number) => {
    const result: React.ReactNode[] = [];
    let cursor = start;
    for (const hit of highlights) {
      if (hit.end <= cursor || hit.start >= end) continue;
      if (hit.start > cursor) result.push(...sliceNodes(nodes, cursor, hit.start));
      const to = Math.min(end, hit.end);
      result.push(<mark key={`mark-${cursor}`}>{sliceNodes(nodes, Math.max(cursor, hit.start), to)}</mark>);
      cursor = to;
    }
    if (cursor < end) result.push(...sliceNodes(nodes, cursor, end));
    return result;
  };
  if (!parts.length) return <>{sliceNodes(nodes, 0, 0)}</>;
  return <>{parts.map(part => <React.Fragment key={part.start}>{part.reference
    ? <ReferenceLink reference={{ ...part.reference, ...(at && part.reference.kind === 'local' ? { at } : {}) }} onReference={onReference}>{content(part.start, part.end)}</ReferenceLink>
    : content(part.start, part.end)}</React.Fragment>)}</>;
}

const containsSourceBoundary = (node: ReaderNode): boolean => node.type === 'element' && (['img', 'source-file'].includes(node.tag) || node.attrs?.role === 'footnote' || node.children.some(containsSourceBoundary));
const containsBlockContent = (node: ReaderNode): boolean => node.type === 'element' && node.children.some(child => child.type === 'element' && (!readerInlineTags.has(child.tag) || containsBlockContent(child)));

type StructuredProps = ReaderLinkContext & {
  nodes: ReaderNode[]; query?: string; at?: string; onReference: (reference: ReaderReference) => void;
};

// A footnote is a citation-token boundary, not a sentence or paragraph boundary.
function InlineFlow({ nodes, at, query, onReference, ...context }: StructuredProps) {
  const result: React.ReactNode[] = [];
  let inline: ReaderNode[] = [];
  const flush = () => {
    if (inline.length) result.push(<InlineText key={result.length} nodes={inline} context={context} at={at} query={query} onReference={onReference} />);
    inline = [];
  };
  for (const node of nodes) {
    if (!containsSourceBoundary(node) || node.type === 'text') { inline.push(node); continue; }
    flush();
    if (['img', 'source-file'].includes(node.tag)) result.push(sourceAsset(node, result.length));
    else if (node.attrs?.role === 'footnote') result.push(<sup key={result.length} data-reader-role="footnote">{sliceNodes(node.children, 0, readerNodeText(node.children).length)}</sup>);
    else result.push(React.createElement(node.tag, {key: result.length}, <InlineFlow nodes={node.children} {...context} at={at} query={query} onReference={onReference} />));
  }
  flush();
  return <>{result}</>;
}

function StructuredBody({ nodes, at, query, onReference, ...context }: StructuredProps) {
  const result: React.ReactNode[] = [];
  let inline: ReaderNode[] = [];
  const flush = () => {
    if (inline.length) {
      const sentences: ReaderNode[][] = [];
      let sentence: ReaderNode[] = [], numbered = false;
      for (const node of inline) {
        if (node.type === 'element' && node.attrs?.role === 'sentence') {
          // A continuation after a list belongs to the previous sentence.
          // Only a source Absatz label may prefix the next numbered sentence.
          if (numbered || !/^\s*(?:\(\d+[a-z]?\))?\s*$/iu.test(readerNodeText(sentence))) { sentences.push(sentence); sentence = []; }
          numbered = true;
        }
        sentence.push(node);
      }
      sentences.push(sentence);
      result.push(<React.Fragment key={`flow-${result.length}`}>{sentences.map((nodes, index) => numbered
        ? <span data-reader-sentence key={index}><InlineFlow nodes={nodes} {...context} query={query} at={at} onReference={onReference} /></span>
        : <InlineFlow key={index} nodes={nodes} {...context} query={query} at={at} onReference={onReference} />)}</React.Fragment>);
    }
    inline = [];
  };
  for (const node of nodes) {
    if (node.type === 'element' && ['img', 'source-file'].includes(node.tag)) {
      flush();
      result.push(sourceAsset(node, result.length));
      continue;
    }
    if (node.type === 'text' || readerInlineTags.has(node.tag) && !containsBlockContent(node)) { inline.push(node); continue; }
    flush();
    const props: Record<string, unknown> = { key: `block-${result.length}` };
    if (node.attrs?.role) props['data-reader-role'] = node.attrs.role;
    if (node.attrs?.colspan) props.colSpan = node.attrs.colspan;
    if (node.attrs?.rowspan) props.rowSpan = node.attrs.rowspan;
    // GII XML permits lists/tables inside P/I/B. HTML phrasing elements do not;
    // browser repair otherwise relocates content and even splits legal links.
    const needsBlock = (node.tag === 'p' || readerInlineTags.has(node.tag)) && containsBlockContent(node);
    if (needsBlock) props['data-reader-source-tag'] = node.tag;
    result.push(React.createElement(needsBlock ? 'div' : node.tag, props, <StructuredBody nodes={node.children} {...context} at={at} query={query} onReference={onReference} />));
  }
  flush();
  return <>{result}</>;
}

export default function StructuredReaderText({ nodes, ...props }: StructuredProps) {
  const { body, footnotes } = useMemo(() => {
    const footnotes: { label: ReaderNode[]; nodes: ReaderNode[] }[] = [];
    const visit = (items: ReaderNode[]): ReaderNode[] => items.flatMap((node, index): ReaderNode[] => {
      if (node.type === 'text') return [node];
      if (node.tag === 'small' && node.attrs?.role === 'footnote') {
        const previous = items.slice(0, index).findLast(item => item.type !== 'text' || item.text.trim());
        footnotes.push({label: previous?.type === 'element' && previous.tag === 'sup' && previous.attrs?.role === 'footnote' ? previous.children : [], nodes: node.children});
        return [];
      }
      return [{ ...node, children: visit(node.children) }];
    });
    return {body: visit(nodes), footnotes};
  }, [nodes]);
  return <><StructuredBody nodes={body} {...props} />{footnotes.length > 0 && <aside data-reader-footnotes>{footnotes.map((note, index) => <small data-reader-role="footnote" key={index}>{note.label.length > 0 && <><sup>{readerNodeText(note.label)}</sup>{' '}</>}<StructuredBody nodes={note.nodes} {...props} /></small>)}</aside>}</>;
}
