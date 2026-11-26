'use client';

/**
 * Composed letter preview + send actions.
 *
 * Channel policy rendered in order: the fax/post hint comes FIRST and
 * the mailto button is visually secondary with the "supplementary"
 * notice (LEGAL-REVISION §8). Both email links preserve the complete
 * draft; copying remains available for clients that reject long links.
 */

import React, { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Loader2, Maximize2, Download } from 'lucide-react';
import type { LetterSpec } from '../data/letters';
import type { AuthorityCard } from '../data/recipients';
import {
  compose, renderEmailText, renderPlainText, type CoApplicant,
} from '../engine/compose';
import { todayISO } from '../engine/logic';
import EmailComposer from './EmailComposer';
import FullscreenOverlay from './FullscreenOverlay';
import Toast from './Toast';
import { downloadLetterPdf } from '../engine/pdf';
import { useWizard } from './WizardContext';
import s from '../chamfer.module.css';
import '../i18n/register';

/** German relation labels rendered into the letter itself */
const RELATION_DE: Record<string, string> = {
  partner: 'Partner(in)', husband: 'Ehemann', wife: 'Ehefrau',
  son: 'Sohn', daughter: 'Tochter', other: 'Familienangehörige(r)',
};

const LetterPreview: React.FC<{
  letter: LetterSpec;
  recipient: AuthorityCard;
  regardingAuthority?: string;
  userAttachments?: string[];
  /** back button + title, rendered above the sheet (left column on desktop) */
  head?: React.ReactNode;
}> = ({ letter, recipient, regardingAuthority, userAttachments, head }) => {
  const { t } = useTranslation('chamfer');
  const { answers, profile, remedy, handFill, coApplicants, letterDraft, setLetterDraft } = useWizard();
  const [copied, setCopied] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfDown, setPdfDown] = useState(false);
  const [docxBusy, setDocxBusy] = useState(false);
  const [docxDown, setDocxDown] = useState(false);
  const faxLine = letterDraft.faxLine;
  const [toast, setToast] = useState<'ok' | 'fail' | null>(null);
  const [docFull, setDocFull] = useState(false);

  // hand-fill: blanks instead of personal data, signed by hand
  const effProfile = useMemo(
    () => handFill
      ? { name: '____________________', surname: '',
          dob: '__.__.____', street: '______________________________',
          plzCity: '______ ____________________' }
      : profile,
    [handFill, profile],
  );

  const co: CoApplicant[] = useMemo(
    () => coApplicants
      .filter((c) => c.name.trim())
      .map((c) => ({ name: c.name.trim(),
                     relation: RELATION_DE[c.relation] ?? '' })),
    [coApplicants],
  );

  const composed = useMemo(
    () => compose({ letter, profile: effProfile, answers, recipient,
                    remedy, regardingAuthority, coApplicants: co,
                    userAttachments }),
    [letter, effProfile, answers, recipient, remedy, regardingAuthority,
     co, userAttachments],
  );


  // e.g. dsgvo-bamf-Glushkov-D-2026-06-12
  const fileName = useMemo(() => {
    const slug = letter.id.replace(/_/g, '-');
    const sn = profile.surname.replace(/[^A-Za-z]/g, '') || 'Entwurf';
    const ini = (profile.name.replace(/[^A-Za-z]/g, '')[0] ?? 'X')
      .toUpperCase();
    const date = todayISO(); // local date — matches the letter's date line
    return `${slug}-${sn}-${ini}-${date}`;
  }, [letter.id, profile.name, profile.surname]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(renderPlainText(composed));
      setCopied(true);
      setToast('ok');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast('fail');
    }
  };

  const download = async (format: 'pdf' | 'docx') => {
    const busy = format === 'pdf' ? setPdfBusy : setDocxBusy;
    const failed = format === 'pdf' ? setPdfDown : setDocxDown;
    busy(true); failed(false);
    try {
      const az = answers.fields.aktenzeichen?.trim();
      const result = await downloadLetterPdf(composed, {
        faxVorab: faxLine ? recipient.fax : undefined,
        infoLines: az ? [`Ihr Az.: ${az}`] : [],
        filename: fileName, format,
      });
      failed(result !== 'ok');
    } catch { failed(true); }
    finally { busy(false); }
  };

  // The sheet of paper: white, dark ink, in both themes (see .paper).
  const docPanel = (
    <div className={s.paper} lang="de">
      <div className={s.paperSender}>
        <span>{composed.senderBlock.filter(Boolean).join(' · ')}</span>
        {recipient.fax && faxLine && <b>Per Fax vorab: {recipient.fax}</b>}
      </div>
      <div className={s.paperTo}>{composed.recipientBlock.join('\n')}</div>
      <div className={s.paperDate}>
        {composed.ort ? `${composed.ort}, den ${composed.date}` : composed.date}
      </div>
      <div className={s.paperSubject}>{composed.subject}</div>
      <div className={s.paperBody}>{composed.body}</div>
      <div className={s.paperSign}>
        {(composed.signatureName || ' ').split('\n').map((n, i) => (
          <div key={i}>
            <span aria-hidden="true">{'…'.repeat(Math.max(14, Math.min(34, n.length + 6)))}</span>
            <div>{n || ' '}</div>
          </div>
        ))}
      </div>
      {composed.attachments && (
        <div className={s.paperEnc}>{composed.attachments}</div>
      )}
    </div>
  );

  return (
    <div className={s.preview}>
      <div className={s.previewHead}>{head}</div>

      {/* the document — expandable to full screen */}
      <div className={s.previewDoc}>
        <div className={s.paperBar}>
          <span className="sntiq-kicker">{t('preview.title')}</span>
          <button
            type="button"
            aria-label={t('email.fullscreen')}
            title={t('email.fullscreen')}
            onClick={() => setDocFull((v) => !v)}
            className={s.iconBtn}
          >
            <Maximize2 aria-hidden="true" />
          </button>
        </div>
        <FullscreenOverlay
          open={docFull}
          onClose={() => setDocFull(false)}
          label={t('preview.title')}
          closeLabel={t('email.exitFullscreen')}
        >
          {docFull ? docPanel : null}
        </FullscreenOverlay>
        {!docFull && docPanel}
      </div>

      <div className={s.previewSend}>
        {/* send guidance — fax/post first, always */}
        <div className={s.send}>
          <h3>{t(composed.sendHintKey + '.title')}</h3>
          <p>{t(composed.sendHintKey + '.body')}</p>
          {recipient.fax && (
            <p className={s.meta}>{t('channels.fax')} {recipient.fax}</p>
          )}
        </div>

        <div className={s.downloads}>
          <button
            type="button"
            onClick={() => download('pdf')}
            disabled={pdfBusy}
            className="sntiq-btn sntiq-btn-primary"
          >
            {pdfBusy
              ? <Loader2 aria-hidden="true" className={s.spin} />
              : <Download aria-hidden="true" />}
            <span>{t('common.downloadPdf')}</span>
          </button>

          <button
            type="button"
            onClick={() => download('docx')}
            disabled={docxBusy}
            className="sntiq-btn"
          >
            {docxBusy
              ? <Loader2 aria-hidden="true" className={s.spin} />
              : <Download aria-hidden="true" />}
            <span>{t('common.downloadDocx')}</span>
          </button>

          <button type="button" onClick={copy} className="sntiq-btn">
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
            {copied ? t('common.copied') : t('common.copy')}
          </button>
        </div>

        {pdfDown && (
          <p role="alert" className={s.error}>{t('common.downloadFailed', { format: 'PDF' })}</p>
        )}
        {docxDown && <p role="alert" className={s.error}>{t('common.downloadFailed', { format: 'DOCX' })}</p>}

        {recipient.fax && (
          <label className={s.check} data-checked={faxLine} style={{ marginTop: '.75rem' }}>
            <input
              type="checkbox"
          className="sntiq-check"
              checked={faxLine}
              onChange={(e) => setLetterDraft(prev => ({ ...prev, faxLine: e.target.checked }))}
            />
            <span>{t('preview.faxToggle', { fax: recipient.fax })}</span>
          </label>
        )}
        {!recipient.email && <p className={s.hint}>{t('channels.emailNote')}</p>}
      </div>

      {recipient.email && (
        <div className={s.previewMail}>
          <EmailComposer
            to={recipient.email}
            subject={composed.subject}
            body={renderEmailText(composed)}
          />
        </div>
      )}

      <p className={`${s.small} ${s.previewFine}`}>{t('preview.disclaimer')}</p>

      {toast && (
        <Toast
          kind={toast}
          text={toast === 'ok' ? t('toast.copied') : t('toast.copyFailed')}
          onDone={() => setToast(null)}
        />
      )}
    </div>
  );
};

export default LetterPreview;
