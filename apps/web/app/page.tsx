'use client';

import Link from 'next/link';
import { useTranslation } from 'react-i18next';
import type { Language } from '@/core/i18n/types';
import descriptions from '@/core/i18n/toolDescriptions.json';

const modules = { kerf: 'Kerf', taper: 'Taper', chamfer: 'Chamfer', lathe: 'Lathe' } as const;

export default function ToolsPage() {
  const { i18n } = useTranslation();
  const copy = descriptions[i18n.language as Language] ?? descriptions.en;
  return (
    <section className="tools-index">
      <h1>SNTIQ Tools</h1>
      <p>{copy.tools}</p>
      <ul id="projects">
        {Object.entries(modules).map(([id, name]) => (
          <li key={id}>
            <Link href={'/dt/' + id}>{name}</Link>
            <p>{copy[id]}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
