import type { Metadata } from 'next';
import KerfModule from '@/modules/kerf/KerfModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

const DESCRIPTION =
  'German and EU law as a graph with its history: the wording of a provision on any date, word-level diffs of every amendment, and linked court decisions.';

export const metadata: Metadata = pageMeta({ path: '/dt/kerf', title: 'SNTIQ Kerf | Deutschland Together', description: DESCRIPTION });

export default function KerfPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Kerf', '/dt/kerf', DESCRIPTION)) }} />
      <KerfModule />
    </>
  );
}
