import React, { useMemo } from 'react';
import Markdown from 'react-markdown';
import remarkFrontmatter from 'remark-frontmatter';
import type { Root } from 'mdast';
import type { KerfAct, KerfActDetail, KerfActNorm } from './client';
import ReaderText, { type ReaderReference } from './ReaderText';
import StructuredReaderText from './StructuredReaderText';
import type { ReaderNode } from './readerStructure';
import { archiveNorms, archiveSections, sourceParagraphs } from './readerArchiveStructure';
import { archivedReaderBlocks, type StructuredNorms, type ArchivedStructuredNorms } from './readerStructuredResources';
import { remarkTocSections } from './readerToc';
import { TocOutlineList } from './ReaderTocOutline';
import { readerLawLabel } from './readerLabels';

// Only the leading export header belongs to the edition bar. Later H1s can be
// part of a law and must survive, like every other source heading.
export function omitExportHeader() {
  return (tree: Root) => {
    const heading = tree.children.findIndex(node => node.type !== 'yaml');
    const first = tree.children[heading];
    if (first?.type !== 'heading' || first.depth !== 1) return;
    tree.children.splice(heading, 1);
    const status = tree.children[heading];
    if (status?.type === 'blockquote' && status.children[0]?.type === 'paragraph'
      && status.children[0].children[0]?.type === 'text'
      && status.children[0].children[0].value.startsWith('Archive status:')) tree.children.splice(heading, 1);
  };
}

function inlineNodes(children: React.ReactNode): ReaderNode[] | null {
  const nodes: ReaderNode[] = [];
  for (const child of React.Children.toArray(children)) {
    if (typeof child === 'string' || typeof child === 'number') { nodes.push({ type: 'text', text: String(child) }); continue; }
    if (!React.isValidElement<{ children?: React.ReactNode }>(child) || typeof child.type !== 'string'
      || !['strong', 'em', 'sup', 'sub', 'br', 's'].includes(child.type)) return null;
    const nested = inlineNodes(child.props.children);
    if (!nested) return null;
    nodes.push({ type: 'element', tag: child.type, children: nested });
  }
  return nodes;
}

export default function ReaderArchivedText({ markdown, acts, act, query, at, norms: inventory, structures, editionStructures, onReference, tocNote, onOpenNorm }: {
  markdown: string; acts: KerfAct[]; act: KerfActDetail; query: string; at?: string; norms?: KerfActNorm[]; structures?: StructuredNorms; editionStructures?: ArchivedStructuredNorms;
  onReference: (reference: ReaderReference) => void;
  /** Note shown in a generated table of contents; onOpenNorm makes its entries links. */
  tocNote?: string; onOpenNorm?: (enbez: string) => void;
}) {
  const norms = useMemo(() => inventory ?? archiveNorms(markdown), [inventory, markdown]);
  const context = { acts, actId: act.id, norms, citations: [], query, at, onReference };
  const structuredArchive = useMemo(() => {
    const replacements = new Map<number, ReaderNode[]>();
    const plugin = () => (tree: Root) => {
      replacements.clear();
      const sections = archiveSections(tree);
      const selected = sections.map(section => section.norm);
      const historical = editionStructures?.act.id === act.id && editionStructures.requested_at === at
        ? archivedReaderBlocks(editionStructures.act, editionStructures.structures, selected, norms) : [];
      const current = archivedReaderBlocks(act, structures, selected, norms);
      const blocks = selected.map((_, index) => historical[index] ?? current[index]);
      // Reverse replacement preserves the original AST positions. Headings,
      // edition metadata and unmatched historical bodies remain untouched.
      for (let index = sections.length - 1; index >= 0; index--) {
        const nodes = blocks[index];
        if (!nodes) continue;
        replacements.set(index, nodes);
        const section = sections[index];
        tree.children.splice(section.start, section.end - section.start, { type: 'paragraph', children: [],
          data: { hName: 'div', hProperties: { 'data-reader-archive-structure': index } } });
      }
    };
    return { plugin, replacements };
  }, [act, structures, editionStructures, norms, at]);
  const text = (children: React.ReactNode): React.ReactNode => {
    const nodes = inlineNodes(children);
    if (nodes) return <StructuredReaderText nodes={nodes} {...context} />;
    return React.Children.map(children, child => typeof child === 'string' ? <ReaderText text={child} {...context} />
      : React.isValidElement<{ children?: React.ReactNode }>(child) && ['strong', 'em'].includes(String(child.type))
        ? React.cloneElement(child, {}, text(child.props.children)) : child);
  };
  // German law text (see ReaderText); display: contents keeps the layout as it was.
  return <div lang="de" style={{ display: 'contents' }}><Markdown remarkPlugins={[remarkFrontmatter, omitExportHeader, structuredArchive.plugin, remarkTocSections]} components={{
    div: ({ children, node }) => {
      if (node?.properties['dataReaderTocOutline'] !== undefined || node?.properties['data-reader-toc-outline'] !== undefined) {
        return <TocOutlineList norms={norms} fallback={act.jurabk ? readerLawLabel(act) : act.id} note={tocNote} onOpen={onOpenNorm} />;
      }
      const index = node?.properties['data-reader-archive-structure'];
      const nodes = typeof index === 'number' ? structuredArchive.replacements.get(index) : undefined;
      return nodes ? <StructuredReaderText nodes={nodes} {...context} /> : <div>{children}</div>;
    },
    p: ({ children }) => typeof children === 'string'
      ? <>{sourceParagraphs(children, { bavarianSentences: act.id.startsWith('by_') }).map((paragraph, index) => <p key={index}>{text(paragraph)}</p>)}</>
      : <p>{text(children)}</p>,
    li: ({ children }) => <li>{text(children)}</li>,
    a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
    img: () => null,
  }}>{markdown}</Markdown></div>;
}
