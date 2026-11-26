'use client';

/**
 * Pure hierarchy view — the same omnitree, as an expandable outline.
 * Complements the constellation: precise, accessible, screenshotable.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronRight, Loader2, PanelRightOpen } from 'lucide-react';
import {
  BUND_DOMAIN, EU_DOMAIN, GERMANY_DOMAIN, WORKSPACE_ROOT, type Built,
} from './omnitree';
import { loadOmnigram } from './omnitree.client';
import { NodeMark } from './graphStyle';
import './i18n/register';

const orderedChildren = (b: Built, id: number) =>
  [...(b.childrenOf.get(id) ?? [])].sort((a, z) => {
    const rank = (node: number) => node === GERMANY_DOMAIN ? 0
      : node === EU_DOMAIN ? 1
        : node === BUND_DOMAIN ? 0 : 1;
    return rank(a) - rank(z)
      || (b.byId.get(a)?.name ?? '').localeCompare(
        b.byId.get(z)?.name ?? '', 'de', { sensitivity: 'base' },
      );
  });

const Row: React.FC<{
  b: Built;
  id: number;
  depth: number;
  open: Set<number>;
  toggle: (id: number) => void;
  onInspect: (id: number) => void;
}> = ({ b, id, depth, open, toggle, onInspect }) => {
  const { t } = useTranslation('taper');
  const n = b.byId.get(id);
  if (!n) return null;
  const kids = orderedChildren(b, id);
  const isOpen = open.has(id);
  return (
    <div>
      {/* every row is at least one 40px line; depth is indentation only,
          a little tighter on a phone so deep levels keep room for the name */}
      <div
        className="flex items-stretch gap-1 select-none"
        style={{ paddingLeft: `min(${depth * 16}px, ${depth * 3.2}vw)` }}
      >
        <button
          type="button"
          className="flex min-h-10 flex-1 min-w-0 items-center gap-2 rounded-lg py-1.5 text-left [.high-contrast_&]:px-2 hover:bg-[var(--c-text-main)]/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-link)]"
          aria-expanded={kids.length > 0 ? isOpen : undefined}
          onClick={() => (kids.length ? toggle(id) : onInspect(id))}
        >
          {kids.length > 0 ? (
            <ChevronRight
              aria-hidden="true"
              className={`w-4 h-4 text-muted shrink-0 transition-transform duration-150 ${
                isOpen ? 'rotate-90' : ''}`}
            />
          ) : <span className="w-4 shrink-0" />}
          <NodeMark kind={n.kind} virtual={n.virtual} />
          <span lang="de" className={`min-w-0 break-words hyphens-auto text-[0.9375rem] leading-snug text-main ${
            n.virtual ? 'font-semibold' : ''}`}>
            {n.name}
          </span>
          {kids.length > 0 && (
            <span className="shrink-0 text-xs tabular-nums text-muted">
              {kids.length}
            </span>
          )}
        </button>
        {!n.virtual && (
          <button
            type="button"
            aria-label={t('openAuthorityCard', { name: n.name })}
            title={t('openAuthorityCard', { name: n.name })}
            className="flex min-h-10 w-10 shrink-0 items-center justify-center rounded-lg text-[var(--c-link)] hover:bg-[var(--c-text-main)]/[0.05] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--c-link)]"
            onClick={() => onInspect(id)}
          >
            <PanelRightOpen className="w-4 h-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {isOpen && kids.map((k) => (
        <Row key={k} b={b} id={k} depth={depth + 1} open={open}
             toggle={toggle} onInspect={onInspect} />
      ))}
    </div>
  );
};

const TreeOutline: React.FC<{ onInspect: (id: number) => void }> = ({
  onInspect,
}) => {
  const { t } = useTranslation('taper');
  const [built, setBuilt] = useState<Built | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const once = useRef(-1);

  useEffect(() => {
    if (once.current === attempt) return;
    once.current = attempt;
    loadOmnigram()
      .then(setBuilt)
      // a failed load used to leave the spinner turning forever
      .catch(() => setFailed(true));
  }, [attempt]);

  if (!built) {
    return (
      <div role="status"
           className="flex min-h-40 flex-wrap items-center gap-3 py-4 text-sm text-main">
        {failed ? (
          <>
            <span>{t('graphError')}</span>
            <button type="button" className="sntiq-btn"
                    onClick={() => { setFailed(false); setAttempt((n) => n + 1); }}>
              {t('retry')}
            </button>
          </>
        ) : (
          <>
            <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            {t('germanyLoading')}
          </>
        )}
      </div>
    );
  }
  const toggle = (id: number) =>
    setOpen((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id); else n.add(id);
      return n;
    });

  return (
    <div className="-mt-3">
      {orderedChildren(built, WORKSPACE_ROOT).map((id) => (
        <div key={id} className="border-b border-[var(--panel-border)] py-2">
          <Row b={built} id={id} depth={0} open={open} toggle={toggle}
               onInspect={onInspect} />
        </div>
      ))}
    </div>
  );
};

export default TreeOutline;
