import type { Metadata } from 'next';
import descriptions from '@/core/i18n/toolDescriptions.json';
import { resolveServerLang } from '@/core/i18n/pageMeta';
import TaperModule from '@/modules/taper/TaperModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveServerLang();
  return pageMeta({ path: '/dt/taper', title: 'SNTIQ Taper | Deutschland Together', description: descriptions[lang].taper });
}

export default async function TaperPage() {
  const lang = await resolveServerLang();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Taper', '/dt/taper', descriptions[lang].taper)) }} />
      <TaperModule />
    </>
  );
}
