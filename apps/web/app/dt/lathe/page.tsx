import type { Metadata } from 'next';
import { preload } from 'react-dom';
import pdfjsPackage from 'pdfjs-dist/package.json';
import LatheModule from '@/modules/lathe/LatheModule';
import { ldJson, moduleLd, pageMeta } from '@/core/seo';

const DESCRIPTION =
  'Assistant for the German legal aid declaration (Prozesskostenhilfe, form ZP 1a). Runs fully in your browser.';

export const metadata: Metadata = pageMeta({ path: '/dt/lathe', title: 'SNTIQ Lathe | Deutschland Together', description: DESCRIPTION });

export default function LathePage() {
  // The blank form for the live preview downloads alongside the scripts
  // (fetched by PdfViewer with the same credentials mode).
  preload('/dt/lathe/forms/zp1a.pdf', { as: 'fetch', crossOrigin: 'anonymous' });
  // The pdf.js worker (a module worker, same URL as PdfViewer builds) starts
  // downloading now instead of after the pdf.js library has loaded.
  preload(`/pdfjs/${pdfjsPackage.version}/pdf.worker.min.mjs`, { as: 'fetch', crossOrigin: 'anonymous' });
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: ldJson(moduleLd('SNTIQ Lathe', '/dt/lathe', DESCRIPTION)) }} />
      <LatheModule />
    </>
  );
}
