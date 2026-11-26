'use client';

import React from 'react';
import Link from 'next/link';
import NightBand from './NightBand';
import type { ReliefName } from './home/relief';
import s from './moduleBand.module.css';

type Crumb = { href: string; label: string };

/**
 * The head of a module (docs/DESIGN.md, sections 3, 4 and 7; spec decision 2
 * as refined on 24 November 2026): on entry a night band with the module's
 * relief, the way back, the name and one line on what the tool does. Once the
 * visitor is at work (`compact`), it folds to a strip under the header that
 * keeps only the name and the line, so the work moves up. The fold is
 * instant: it happens together with the step change, and an animated one
 * jumped from column to row halfway and re-laid the page on every frame.
 * The name is the page's h1 in both states.
 *
 * `children` is the module's tool on the band (Taper's place search): it
 * stands under the line on entry and stays in the folded strip, beside the
 * name on a wide screen and on a row of its own on a phone.
 */
const ModuleBand: React.FC<{
  module: Exclude<ReliefName, 'hero' | 'page'>;
  name: string;
  line: string;
  crumbs: Crumb[];
  crumbsLabel?: string;
  compact?: boolean;
  children?: React.ReactNode;
}> = ({ module, name, line, crumbs, crumbsLabel = 'Breadcrumb', compact = false, children }) => (
  <NightBand preset={module} size="module" compact={compact}>
    <div className={s.head} data-compact={compact ? 'true' : undefined}>
      <div className={s.fold}>
        <nav aria-label={crumbsLabel} className={s.crumbs} inert={compact || undefined}>
          {crumbs.map((c, i) => (
            <React.Fragment key={c.href}>
              {i > 0 && <span aria-hidden="true">/</span>}
              <Link href={c.href}>{c.label}</Link>
            </React.Fragment>
          ))}
        </nav>
      </div>
      <div className={s.titleRow}>
        <h1 className={s.name}>{name}</h1>
        <p className={s.line}>{line}</p>
      </div>
      {children && <div className={s.tool}>{children}</div>}
    </div>
  </NightBand>
);

export default ModuleBand;
