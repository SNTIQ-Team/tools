/**
 * Client for the platform PDF service (POST api.sntiq.com/chamfer/letter).
 *
 * The service is stateless and renders DIN 5008 from the composed
 * letter; nothing is stored server-side (LEGAL-REVISION §5). On ANY
 * failure (offline, 4xx/5xx, blocked) the caller falls back to
 * copy/mailto — the module must stay usable without the service.
 */

import { chamferUrl } from '../../../core/config';
import type { ComposedLetter } from './compose';

export type PdfResult = 'ok' | 'unavailable';

export async function downloadLetterPdf(
  letter: ComposedLetter,
  opts?: {
    /** recipient fax → "Per Fax vorab: …" line on the letterhead */
    faxVorab?: string | null;
    /** right-hand info block, e.g. ["Ihr Az.: 31-3/0815"] */
    infoLines?: string[];
    /** 'docx' downloads the org template itself (no converter needed) */
    format?: 'pdf' | 'docx';
    /** download name without extension (slug-surname-initial-date) */
    filename?: string;
  },
): Promise<PdfResult> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  // Covers both headers and body, even if a stalled reader ignores abort.
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => { controller.abort(); reject(new Error('Document download timed out')); }, 60_000);
  });
  try {
    const res = await Promise.race([fetch(chamferUrl('/letter'), {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        template: letter.layout === 'lawsuit' ? 'lawsuit' : 'letter',
        format: opts?.format ?? 'pdf',
        sender: letter.senderBlock,
        recipient: letter.recipientBlock,
        date: letter.date,
        ort: letter.ort || undefined,
        fax_vorab: opts?.faxVorab || undefined,
        info_lines: opts?.infoLines ?? [],
        subject: letter.subject,
        body: letter.body,
        signature_name: letter.signatureName,
        attachments: letter.attachments,
      }),
    }), deadline]);
    if (!res.ok) return 'unavailable';
    const blob = await Promise.race([res.blob(), deadline]);
    const fmt = opts?.format ?? 'pdf';
    const okType = fmt === 'pdf'
      ? blob.type === 'application/pdf'
      : blob.type.includes('officedocument');
    if (!okType || blob.size < 1024) {
      return 'unavailable';
    }
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${opts?.filename ?? `chamfer-${letter.layout}`}.${fmt}`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // give the browser a tick to start the download before revoking
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return 'ok';
  } catch {
    return 'unavailable';
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}
