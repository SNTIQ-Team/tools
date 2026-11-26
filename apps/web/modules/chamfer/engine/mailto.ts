/**
 * "Open in mail client" with the letter body preserved.
 *
 * Channel policy (docs/LEGAL-REVISION.md §8): e-mail is a SUPPLEMENTARY
 * channel — the UI renders the fax/tracked-letter notice next to this
 * button, and the wizard never offers mailto as the only send action
 * for deadline-relevant letters.
 *
 * mailto URLs have no formal length limit but clients truncate; beyond
 * ~1800 encoded characters behaviour gets flaky (old Outlook, some
 * webmail handlers). Callers check `fitsMailto` and fall back to
 * copy-to-clipboard + plain mailto without body.
 */

import type { ComposedLetter } from './compose';
import { renderPlainText } from './compose';

export const MAILTO_SAFE_LENGTH = 1800;

export interface MailtoResult {
  /** full mailto URI with subject and body */
  href: string;
  /** body included and within the safe length */
  fitsMailto: boolean;
  /** plain text to copy when the body does not fit */
  plainText: string;
}

export function buildMailto(
  to: string,
  letter: ComposedLetter,
): MailtoResult {
  const plainText = renderPlainText(letter);
  // RFC 6068 §5: line breaks in a mailto body must be CRLF (%0D%0A) —
  // bare %0A collapses the letter into one paragraph in several
  // Windows mail clients (old Outlook, some webmail handlers)
  const body = encodeURIComponent(plainText.replace(/\r?\n/g, '\r\n'));
  const full =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(letter.subject)}` +
    `&body=${body}`;
  if (full.length <= MAILTO_SAFE_LENGTH) {
    return { href: full, fitsMailto: true, plainText };
  }
  // body too long: subject-only link; caller copies the body instead
  const short =
    `mailto:${encodeURIComponent(to)}` +
    `?subject=${encodeURIComponent(letter.subject)}`;
  return { href: short, fitsMailto: false, plainText };
}
