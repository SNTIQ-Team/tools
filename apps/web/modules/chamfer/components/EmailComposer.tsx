'use client';

/**
 * E-mail writing block: From/To/CC/BCC/Subject header rows, an editable
 * plain-text body and
 * an icon toolbar — Copy, Edit, full screen, "Open in email" (mailto:)
 * plus a Gmail web-compose fallback for systems where mailto is broken
 * (Linux/Chrome without a handler).
 *
 * Channel policy: e-mail stays SUPPLEMENTARY — the surrounding preview
 * renders the fax/post guidance first; this block never replaces it.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, Copy, Maximize2, ExternalLink } from 'lucide-react';
import Toast from './Toast';
import FullscreenOverlay from './FullscreenOverlay';
import s from '../chamfer.module.css';
import '../i18n/register';

const HeaderRow: React.FC<{
  label: string;
  children: React.ReactNode;
}> = ({ label, children }) => (
  <div className={s.mailRow}>
    <span>{label}</span>
    {children}
  </div>
);

const EmailComposer: React.FC<{
  to: string;
  subject: string;
  body: string;
}> = ({ to: toInitial, subject: subjectInitial, body: bodyInitial }) => {
  const { t } = useTranslation('chamfer');
  // Untouched fields follow regenerated letters; explicit edits remain until reset.
  const [edits, setEdits] = useState<Partial<{ to: string; subject: string; body: string }>>({});
  const to = edits.to ?? toInitial;
  const subject = edits.subject ?? subjectInitial;
  const body = edits.body ?? bodyInitial;
  const [cc, setCc] = useState('');
  const [bcc, setBcc] = useState('');
  const [showCc, setShowCc] = useState(false);
  const [editing, setEditing] = useState(false);
  const [full, setFull] = useState(false);
  const [copied, setCopied] = useState(false);
  const [toast, setToast] = useState<'ok' | 'fail' | null>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (copyTimer.current) clearTimeout(copyTimer.current); }, []);

  const mailtoHref = useMemo(() => {
    const params = new URLSearchParams();
    if (cc.trim()) params.set('cc', cc.trim());
    if (bcc.trim()) params.set('bcc', bcc.trim());
    params.set('subject', subject);
    // RFC 6068 §5: mailto body line breaks must be CRLF (%0D%0A)
    const href = `mailto:${encodeURIComponent(to)}?${params.toString()}` +
      `&body=${encodeURIComponent(body.replace(/\r\n|\r|\n/g, '\r\n'))}`;
    return href.replace(/\+/g, '%20');
  }, [to, cc, bcc, subject, body]);

  const gmailHref = useMemo(() => {
    const p = new URLSearchParams({ view: 'cm', fm: '1', to, su: subject,
                                    body });
    if (cc.trim()) p.set('cc', cc.trim());
    if (bcc.trim()) p.set('bcc', bcc.trim());
    return `https://mail.google.com/mail/?${p.toString()}`;
  }, [to, cc, bcc, subject, body]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body);
      setCopied(true);
      setToast('ok');
      if (copyTimer.current) clearTimeout(copyTimer.current);
      copyTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setToast('fail');
    }
  };

  const inner = (
    // In full screen the overlay owns the surface, background and
    // scrolling; the draft is then just content on the page.
    <div className={full ? s.mailFull : `sntiq-surface ${s.mail}`}>
      {/* toolbar */}
      <div className={s.mailBar}>
        <h3>{t('email.title')}</h3>
        <div>
          {/* Editing and restoring the draft are named: a pencil and a
              circular arrow read as "write" and "reload". */}
          <button
            type="button"
            aria-pressed={editing}
            onClick={() => {
              setEditing((v) => !v);
              setTimeout(() => bodyRef.current?.focus(), 0);
            }}
            className={s.textBtn}
          >
            {t('email.edit')}
          </button>
          <button
            type="button"
            aria-label={t('common.copy')}
            title={t('common.copy')}
            onClick={copy}
            className={s.iconBtn}
          >
            {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
          </button>
          {/* Full screen has its own close (FullscreenOverlay); a second
              "leave full screen" under it would be a second close. */}
          {!full && (
            <button
              type="button"
              aria-label={t('email.fullscreen')}
              title={t('email.fullscreen')}
              onClick={() => setFull(true)}
              className={s.iconBtn}
            >
              <Maximize2 aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            disabled={!Object.keys(edits).length && !cc && !bcc}
            onClick={() => { setEdits({}); setCc(''); setBcc(''); }}
            className={s.textBtn}
          >
            {t('email.reset')}
          </button>
        </div>
      </div>

      {/* header rows */}
      <HeaderRow label={t('email.from')}>
        <i>{t('email.fromAuto')}</i>
      </HeaderRow>
      <HeaderRow label={t('email.to')}>
        <input className="sntiq-field" value={to} aria-label={t('email.to')}
               onChange={(e) => setEdits((current) => ({ ...current, to: e.target.value }))} />
        {!showCc && (
          <button type="button" onClick={() => setShowCc(true)}>
            CC/BCC
          </button>
        )}
      </HeaderRow>
      {showCc && (
        <>
          <HeaderRow label="CC">
            <input className="sntiq-field" value={cc} aria-label="CC"
                   onChange={(e) => setCc(e.target.value)} />
          </HeaderRow>
          <HeaderRow label="BCC">
            <input className="sntiq-field" value={bcc} aria-label="BCC"
                   onChange={(e) => setBcc(e.target.value)} />
          </HeaderRow>
        </>
      )}
      <HeaderRow label={t('email.subject')}>
        <input className="sntiq-field" value={subject} aria-label={t('email.subject')}
               onChange={(e) => setEdits((current) => ({ ...current, subject: e.target.value }))} />
      </HeaderRow>

      {/* body */}
      <textarea
        ref={bodyRef}
        aria-label={t('email.body')}
        readOnly={!editing}
        data-editing={editing}
        value={body}
        lang="de"
        rows={Math.max(8, Math.min(24, body.split('\n').length + 1))}
        onChange={(e) => setEdits((current) => ({ ...current, body: e.target.value }))}
        className={`sntiq-field ${s.mailBody}`}
      />

      <div className={s.mailActions}>
        <a
          href={gmailHref}
          target="_blank"
          rel="noopener noreferrer"
          className="sntiq-btn"
        >
          {t('email.gmail')} <ExternalLink aria-hidden="true" />
        </a>
        <a
          aria-label={t('email.open')}
          href={mailtoHref}
          className="sntiq-btn"
        >
          {t('email.open')}
        </a>
      </div>
      <p className={s.small}>{t('channels.emailNote')}</p>
    </div>
  );

  return (
    <>
      <FullscreenOverlay
        open={full}
        onClose={() => setFull(false)}
        label={t('email.title')}
        closeLabel={t('email.exitFullscreen')}
      >
        {full ? inner : null}
      </FullscreenOverlay>
      {!full && inner}
      {toast && (
        <Toast
          kind={toast}
          text={toast === 'ok' ? t('toast.copied') : t('toast.copyFailed')}
          onDone={() => setToast(null)}
        />
      )}
    </>
  );
};

export default EmailComposer;
