import type { Metadata } from 'next';
import ChamferModule from '@/modules/chamfer/ChamferModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

const DESCRIPTION =
  'Letters to German authorities under § 24 AufenthG: situation triage, the remedy each state allows, and the right address from the Taper data.';

export const metadata: Metadata = pageMeta({ path: '/dt/chamfer', title: 'SNTIQ Chamfer | Deutschland Together', description: DESCRIPTION });

export default function ChamferPage() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Chamfer', '/dt/chamfer', DESCRIPTION)) }} />
      <ChamferModule />
    </>
  );
}
