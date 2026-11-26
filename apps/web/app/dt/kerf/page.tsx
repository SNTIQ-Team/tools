import type { Metadata } from 'next';
import descriptions from '@/core/i18n/toolDescriptions.json';
import { resolveServerLang } from '@/core/i18n/pageMeta';
import KerfModule from '@/modules/kerf/KerfModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveServerLang();
  return pageMeta({ path: '/dt/kerf', title: 'SNTIQ Kerf | Deutschland Together', description: descriptions[lang].kerf });
}

export default async function KerfPage() {
  const lang = await resolveServerLang();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Kerf', '/dt/kerf', descriptions[lang].kerf)) }} />
      <KerfModule />
    </>
  );
}
