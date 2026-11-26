'use client';

/**
 * Resolved recipient: name, address, contact channels in policy order
 * (fax → tracked letter → e-mail-as-supplement, LEGAL-REVISION §8),
 * resolver caveats ALWAYS rendered, provenance line for trust.
 * Candidate lists and court Ort disambiguation render as radio cards —
 * the module never guesses between offices.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle } from 'lucide-react';
import type { Caveat, AuthorityCard } from '../data/recipients';
import { contactChannels } from '../data/recipients';
import s from '../chamfer.module.css';
import '../i18n/register';

export const CaveatList: React.FC<{ caveats: Caveat[] }> = ({ caveats }) => {
  if (caveats.length === 0) return null;
  return (
    <ul className={s.caveats}>
      {caveats.map((c, i) => (
        // resolver caveats come from the official dataset — German by design
        <li key={i} lang="de">
          <AlertTriangle aria-hidden="true" />
          <span>{c.text_de}</span>
        </li>
      ))}
    </ul>
  );
};

const RecipientCard: React.FC<{ authority: AuthorityCard }> = ({
  authority,
}) => {
  const { t } = useTranslation('chamfer');
  const channels = contactChannels(authority);
  const fax = channels.find((c) => c.type === 'fax');
  const post = channels.find((c) => c.type === 'post');
  const email = channels.find((c) => c.type === 'email');

  return (
    <div className={s.recipient}>
      <h4 lang="de">{authority.name}</h4>
      {post && post.type === 'post' && (
        <p className={s.address} lang="de">{post.value.slice(1).join('\n')}</p>
      )}

      {(fax || email) && (
        <dl className={s.channels}>
          {fax && fax.type === 'fax' && (
            <div>
              <dt>{t('channels.fax')}</dt>
              <dd>{fax.value}</dd>
              <dd data-tone="ok">{t('channels.preferred')}</dd>
            </div>
          )}
          {email && email.type === 'email' && (
            <div>
              <dt>{t('channels.email')}</dt>
              <dd>{email.value}</dd>
              <dd>{t('channels.supplementary')}</dd>
            </div>
          )}
        </dl>
      )}

      <p className={s.small}>{t('channels.notice')}</p>

      {authority.provenance.source === 'manual' ? (
        <p className={s.small} data-tone="warn">{t('recipient.manualEntered')}</p>
      ) : (
        <p className={s.small}>
          {t('recipient.provenance', {
            source: authority.provenance.source,
            date: authority.provenance.fetched_at?.slice(0, 10) ?? '',
          })}
        </p>
      )}
    </div>
  );
};

export default RecipientCard;
