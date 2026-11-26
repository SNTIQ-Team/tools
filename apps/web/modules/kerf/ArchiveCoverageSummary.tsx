import React from 'react';

import { normalizeLang } from '@/core/i18n/config';
import type { KerfActArchive } from './client';
import { archiveCoverage } from './archiveCoverage';
import { readerEditionDate } from './readerEditions';
import styles from './archiveCoverage.module.css';

const copy = {
  en: { events: 'Amendment history', texts: 'Archived texts', since: 'From', none: 'Not archived', gap: 'Earlier history contains amendment evidence, not complete texts.' },
  de: { events: 'Änderungshistorie', texts: 'Archivierte Texte', since: 'Seit', none: 'Nicht archiviert', gap: 'Die frühere Historie enthält Änderungsnachweise, keine vollständigen Texte.' },
  ru: { events: 'История изменений', texts: 'Архивные тексты', since: 'С', none: 'Нет в архиве', gap: 'Ранняя история содержит сведения об изменениях, без полных текстов.' },
  ua: { events: 'Історія змін', texts: 'Архівні тексти', since: 'З', none: 'Немає в архіві', gap: 'Рання історія містить відомості про зміни, без повних текстів.' },
};

export default function ArchiveCoverageSummary({ archive, language }: { archive: KerfActArchive; language: string }) {
  const coverage = archiveCoverage(archive);
  const t = copy[normalizeLang(language) ?? 'en'];
  return <div className={styles.coverage} data-archive-coverage>
    <dl>
      <div><dt>{t.events}<span>{coverage.eventCount}</span></dt>
        <dd>{coverage.eventsFrom ? `${t.since} ${readerEditionDate(coverage.eventsFrom, language)}` : t.none}</dd></div>
      <div><dt>{t.texts}<span>{coverage.textCount}</span></dt>
        <dd>{coverage.textsFrom ? `${t.since} ${readerEditionDate(coverage.textsFrom, language)}` : t.none}</dd></div>
    </dl>
    {coverage.hasEarlierEvents && <p>{t.gap}</p>}
  </div>;
}
