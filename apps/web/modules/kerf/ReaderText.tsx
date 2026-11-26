'use client';

import React, { useMemo } from 'react';
import type { KerfAct, KerfActNorm, KerfStatutoryCitation } from './client';
import { tokenizeLegalText, type ReaderTextPart } from './readerLinks';
import { createWorkspace, encodeWorkspace, workspaceReducer } from './readerWorkspace';

export type ReaderReference = NonNullable<ReaderTextPart['reference']>;

export function readerDocumentHref(actId: string, norm: string | null = null, at?: string): string {
  return `/dt/kerf${encodeWorkspace(workspaceReducer(createWorkspace(), { type: 'open', actId, norm, mode: 'new', at }))}`;
}

function Highlight({ text, query }: { text: string; query?: string }) {
  if (!query?.trim()) return <>{text}</>;
  const escaped = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return <>{text.split(new RegExp(`(${escaped})`, 'giu')).map((part, index) => part.toLocaleLowerCase() === query.trim().toLocaleLowerCase()
    ? <mark key={index}>{part}</mark> : <React.Fragment key={index}>{part}</React.Fragment>)}</>;
}

export function ReferenceLink({ reference, onReference, children }: { reference: ReaderReference; onReference: (reference: ReaderReference) => void; children: React.ReactNode }) {
  const external = reference.kind === 'external';
  const href = external ? reference.url : reference.actId ? readerDocumentHref(reference.actId, reference.norm ?? null, reference.at) : undefined;
  if (!href || (external && !/^https:\/\//.test(href))) return <>{children}</>;
  return <a href={href} title={reference.label}
    target={external ? '_blank' : undefined} rel={external ? 'noopener noreferrer' : undefined}
    data-reference-kind={reference.kind} data-reference-act={reference.actId} data-reference-norm={reference.norm} data-reference-at={reference.at}
    onClick={event => {
      if (!external && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.button === 0) {
        event.preventDefault(); onReference(reference);
      }
    }}>{children}</a>;
}

export default function ReaderText({ text, actId, acts, norms, citations, query, at, onReference }: {
  text: string; actId: string; acts: KerfAct[]; norms: KerfActNorm[]; citations: KerfStatutoryCitation[];
  query?: string; at?: string; onReference: (reference: ReaderReference) => void;
}) {
  const parts = useMemo(() => tokenizeLegalText(text, { actId, acts, norms, citations }), [text, actId, acts, norms, citations]);
  return <>{parts.map(part => {
    const reference = part.reference && { ...part.reference, ...(at && part.reference.kind === 'local' ? { at } : {}) };
    const text = <Highlight text={part.text} query={query} />;
    return reference ? <ReferenceLink key={part.start} reference={reference} onReference={onReference}>{text}</ReferenceLink> : <React.Fragment key={part.start}>{text}</React.Fragment>;
  })}</>;
}
