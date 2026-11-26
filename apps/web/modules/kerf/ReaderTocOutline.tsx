'use client';

import React, { useMemo } from 'react';
import type { KerfActNorm } from './client';
import { readerDesignator, readerOutline } from './readerOutline';
import { isTocNorm } from './readerToc';

/** Generated table of contents for a body-less "Inhaltsübersicht": the
 * outline of the provisions that follow, collapsed by default. */
export function TocOutlineList({ norms, fallback, onOpen, note }: {
  norms: readonly KerfActNorm[]; fallback: string; onOpen?: (enbez: string) => void; note?: string;
}) {
  const groups = useMemo(() => readerOutline(norms.filter(norm => !isTocNorm(norm)), fallback), [norms, fallback]);
  return <div data-reader-toc-list>
    {note && <p data-reader-toc-note>{note}</p>}
    {groups.map(group => <div key={`${group.start}:${group.label}`} data-reader-toc-group>
      {group.label !== fallback && <strong>{group.label}</strong>}
      <ul>{group.norms.map((norm, index) => <li key={`${norm.enbez}:${index}`}>
        {onOpen ? <button type="button" onClick={() => onOpen(readerDesignator(norm))}><span>{norm.enbez}</span>{norm.titel ? ` ${norm.titel}` : ''}</button>
          : <><span>{norm.enbez}</span>{norm.titel ? ` ${norm.titel}` : ''}</>}
      </li>)}</ul>
    </div>)}
  </div>;
}

export default function ReaderTocOutline({ label, norms, fallback, onOpen, note, open = false }: {
  label: string; norms: readonly KerfActNorm[]; fallback: string; onOpen?: (enbez: string) => void; note?: string; open?: boolean;
}) {
  return <details data-reader-toc="generated" open={open || undefined}>
    <summary>{label}</summary>
    <TocOutlineList norms={norms} fallback={fallback} onOpen={onOpen} note={note} />
  </details>;
}
