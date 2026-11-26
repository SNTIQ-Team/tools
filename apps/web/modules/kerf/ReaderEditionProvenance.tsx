'use client';
import React from 'react';
import type { KerfActMarkdown } from './client';
import { editionQuality, frontMatterFields, gapLabels, provenanceCopy } from './readerProvenance';
import styles from './normHistory.module.css';

/** Keeps a historical edition's provenance visible next to its text. */
export default function ReaderEditionProvenance({ edition, language }: { edition: KerfActMarkdown; language: string }) {
  const c = provenanceCopy(language);
  const quality = editionQuality(edition);
  const observed = /observ|retrieval|capture/u.test(edition.date_basis ?? '');
  const gaps = gapLabels(edition.gaps);
  const fields = frontMatterFields(edition.markdown);
  return <div className={styles.provenance} data-quality={quality}>
    <span className={styles.role} data-exact={quality === 'exact'}>{c[quality]}</span>
    {observed ? <span className={styles.muted}>{c.observed}</span> : edition.legal_effect_verified || edition.date_status === 'official_verified' ? <span className={styles.muted}>{c.legal}</span> : null}
    {(edition.partial || edition.complete === false) && gaps.length > 0 && <div className={styles.notice} data-status="temporally_unresolved" role="note">
      <div><strong>{c.incomplete}</strong>{gaps.slice(0, 6).map(label => <p key={label}>{label}</p>)}{gaps.length > 6 && <p>+{gaps.length - 6} {c.more}</p>}</div>
    </div>}
    {fields.length > 0 && <details><summary>{c.provenance}</summary><dl>{fields.map(([key, value]) => <React.Fragment key={key}><dt>{key}</dt><dd>{value}</dd></React.Fragment>)}</dl></details>}
  </div>;
}
