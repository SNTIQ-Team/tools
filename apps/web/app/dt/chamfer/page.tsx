import type { Metadata } from 'next';
import descriptions from '@/core/i18n/toolDescriptions.json';
import { resolveServerLang } from '@/core/i18n/pageMeta';
import ChamferModule from '@/modules/chamfer/ChamferModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

export async function generateMetadata(): Promise<Metadata> {
  const lang = await resolveServerLang();
  return pageMeta({ path: '/dt/chamfer', title: 'SNTIQ Chamfer | Deutschland Together', description: descriptions[lang].chamfer });
}

export default async function ChamferPage() {
  const lang = await resolveServerLang();
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Chamfer', '/dt/chamfer', descriptions[lang].chamfer)) }} />
      <ChamferModule />
    </>
  );
}
