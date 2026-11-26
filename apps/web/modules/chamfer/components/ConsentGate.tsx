'use client';

/**
 * One-time consent: "general information, not legal advice, you act in
 * your own name". Stored in localStorage so it never nags again — no
 * cookies, no tracking, just the acknowledgement flag.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import s from '../chamfer.module.css';
import '../i18n/register';

const KEY = 'chamfer-consent-v1';

/** The notice is a short document: an opening line and four numbered points. */
const POINTS = ['p1', 'p2', 'p3', 'p4'] as const;

const ConsentGate: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation('chamfer');
  // null = unknown (SSR-safe), then resolved on mount
  const [accepted, setAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setAccepted(localStorage.getItem(KEY) === '1');
    } catch {
      setAccepted(false);
    }
  }, []);

  if (accepted === null) return null;
  if (accepted) return <>{children}</>;

  return (
    <div className={s.stage}>
      <div className={s.side}>
        <h2 className={s.h2}>{t('consent.title')}</h2>
        <p className={s.lead}>{t('consent.intro')}</p>
      </div>
      <div className={s.main}>
        <ol className={s.points}>
          {POINTS.map((p) => <li key={p}>{t(`consent.${p}`)}</li>)}
        </ol>
        <div className={s.actions}>
          <button
            type="button"
            data-sb="accept"
            className="sntiq-btn sntiq-btn-primary"
            onClick={() => {
              try { localStorage.setItem(KEY, '1'); } catch {}
              // The button sits below the fold on a phone; the first step is
              // shorter than this notice, so without this its input ends up
              // under the fixed site header.
              try { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); } catch {}
              setAccepted(true);
            }}
          >
            {t('consent.accept')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConsentGate;
