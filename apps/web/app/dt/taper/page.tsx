import type { Metadata } from 'next';
import TaperModule from '@/modules/taper/TaperModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

const DESCRIPTION =
  'The German authority graph: which office and which court are competent for an address, court instance chains and supervision, each with its source.';

export const metadata: Metadata = pageMeta({ path: '/dt/taper', title: 'SNTIQ Taper | Deutschland Together', description: DESCRIPTION });

export default function TaperPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Taper', '/dt/taper', DESCRIPTION)) }} />
      <TaperModule />
    </>
  );
}
