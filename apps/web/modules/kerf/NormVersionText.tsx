'use client';

import React, { useMemo } from 'react';
import type { KerfNormStructure } from './normHistoryClient';
import { versionTree, type VersionSegment, type VersionUnit } from './normVersionText';
import { sourceParagraphs } from './readerArchiveStructure';

const BLOCK_ITEMS = new Set(['nummer', 'buchstabe', 'doppelbuchstabe']);

function Segments({ segments }: { segments: VersionSegment[] }) {
  return <>{segments.map((segment, index) => {
    if (segment.kind === 'unit') return <Unit key={segment.unit.locator} unit={segment.unit} />;
    // Adjacent sentences in flattened GII text can lack the separating space.
    const previous = segments[index - 1];
    const text = previous?.kind === 'unit' && previous.unit.type === 'satz' && /^\S/u.test(segment.text) ? ` ${segment.text}` : segment.text;
    return <React.Fragment key={index}>{text}</React.Fragment>;
  })}</>;
}

function Unit({ unit }: { unit: VersionUnit }) {
  if (unit.type === 'absatz') return <div data-unit="absatz" data-locator={unit.locator}>{unit.marker && <span data-marker>{unit.marker}</span>}{unit.marker ? ' ' : null}<Segments segments={trimSegments(unit.segments)} /></div>;
  if (BLOCK_ITEMS.has(unit.type)) return <div data-unit={unit.type} data-locator={unit.locator}><span data-marker>{unit.marker ?? unit.number ?? ''}</span><div><Segments segments={trimSegments(unit.segments)} /></div></div>;
  if (unit.type === 'satz') return <span data-unit="satz" data-locator={unit.locator}><Segments segments={unit.segments} />{' '}</span>;
  if (unit.type === 'text_block') {
    const tail = /schluss|tail|gap/u.test(unit.locator);
    return tail ? <div data-unit="text_block" data-locator={unit.locator}><Segments segments={trimSegments(unit.segments)} /></div>
      : <span data-unit="text_block" data-locator={unit.locator}><Segments segments={unit.segments} /></span>;
  }
  return <span data-unit={unit.type} data-locator={unit.locator}><Segments segments={unit.segments} /></span>;
}

const trimSegments = (segments: VersionSegment[]): VersionSegment[] => segments.map((segment, index) => segment.kind === 'text'
  ? { kind: 'text', text: index === 0 ? segment.text.replace(/^\s+/u, '') : index === segments.length - 1 ? segment.text.replace(/\s+$/u, '') : segment.text }
  : segment);

/**
 * Full wording of one version with its legal structure (Absätze, Sätze,
 * Nummern, Buchstaben). Without usable structure data the source text is
 * shown as paragraphs — never truncated.
 */
export default function NormVersionText({ text, structure, bavarian = false, fallbackNote }: {
  text: string; structure?: KerfNormStructure | null; bavarian?: boolean; fallbackNote?: string;
}) {
  const tree = useMemo(() => versionTree(text, structure), [text, structure]);
  if (!tree) return <div data-version-text="plain">
    {fallbackNote && structure !== undefined && <p data-version-note>{fallbackNote}</p>}
    {sourceParagraphs(text, { bavarianSentences: bavarian }).map((paragraph, index) => <p key={index}>{paragraph}</p>)}
  </div>;
  return <div data-version-text="structured">
    {tree.leading.trim() && <p>{tree.leading.trim()}</p>}
    {tree.units.map(unit => <Unit key={unit.locator} unit={unit} />)}
    {tree.trailing.trim() && <p>{tree.trailing.trim()}</p>}
  </div>;
}
