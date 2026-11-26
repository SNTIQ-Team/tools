'use client';

import { httpError, kerfRequest } from './kerfRequest';
import { stripTocPlaceholders } from './readerToc';

/** `attachment; filename="SGB 2.md"; filename*=UTF-8''SGB%202.md` → name. */
export function dispositionFilename(header: string | null | undefined): string | null {
  if (!header) return null;
  const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/u.exec(header)?.[1];
  if (extended) { try { return decodeURIComponent(extended.trim().replace(/^"|"$/gu, '')); } catch { /* fall through */ } }
  const plain = /filename\s*=\s*("?)([^";]+)\1/u.exec(header)?.[2];
  return plain?.trim() || null;
}

/**
 * Markdown download with the same table-of-contents treatment as the reader:
 * the export is fetched (with the shared deadlines), body-less
 * "Inhaltsübersicht" placeholders are removed, and the file is saved. If the
 * request fails the browser falls back to the server's own file.
 */
export async function downloadMarkdownExport(url: string, fallbackName: string): Promise<void> {
  try {
    const { text, name } = await kerfRequest(url, async response => {
      if (!response.ok) throw httpError(response.status);
      return { text: await response.text(), name: dispositionFilename(response.headers.get('content-disposition')) };
    });
    const blob = new Blob([stripTocPlaceholders(text)], { type: 'text/markdown;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = href;
    anchor.download = name ?? fallbackName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    setTimeout(() => URL.revokeObjectURL(href), 30_000);
  } catch {
    window.location.href = url;
  }
}
