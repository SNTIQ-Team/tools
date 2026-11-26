'use client';

/**
 * In-module FAQ — written from scratch (the old deutschlandtogether FAQ
 * served as a topic list only; every legal statement traces to
 * docs/LEGAL-REVISION.md). Accordion, 7 entries.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ChevronDown, ArrowLeft } from 'lucide-react';
import s from '../chamfer.module.css';
import '../i18n/register';

const IDS = ['fiktion', 'oral', 'wait', 'fax', 'duldung', 'dsgvo', 'who'];

const FaqPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const { t } = useTranslation('chamfer');
  const [open, setOpen] = useState<string | null>(IDS[0]);

  return (
    <div className={s.stage}>
      <div className={s.side}>
        {onClose && (
          <button type="button" className={s.back} onClick={onClose}>
            <ArrowLeft aria-hidden="true" className="sntiq-inline-icon" /> {t('faq.back')}
          </button>
        )}
        <h2 className={s.h2}>{t('faq.title')}</h2>
        <p className={s.lead}>{t('footer.disclaimer')}</p>
      </div>
      <div className={s.main}>
        <ul className={s.rows}>
          {IDS.map((id) => {
            const isOpen = open === id;
            return (
              <li key={id}>
                <h3>
                  <button
                    type="button"
                    className={s.faqQ}
                    aria-expanded={isOpen}
                    aria-controls={`chamfer-faq-${id}`}
                    onClick={() => setOpen(isOpen ? null : id)}
                  >
                    <span>{t(`faq.${id}.q`)}</span>
                    <ChevronDown aria-hidden="true" />
                  </button>
                </h3>
                {isOpen && (
                  <p id={`chamfer-faq-${id}`} className={s.faqA}>{t(`faq.${id}.a`)}</p>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default FaqPanel;
