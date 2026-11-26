'use client';

/**
 * Step 1 — place. City-name search against the Taper resolver;
 * suggestions always show the Land (homonyms are real: two AG Fürth…)
 * and the Kreis. After picking a city the user enters their PLZ —
 * needed for court resolution and the letter head.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Search, AlertTriangle, ChevronRight } from 'lucide-react';
import { confirmedPostcode, searchPlaces, type PlaceMatch } from '../data/recipients';
import { useWizard, type PlaceSkipReason } from './WizardContext';
import s from '../chamfer.module.css';
import '../i18n/register';

const PLZ_RE = /^\d{5}$/;

const SKIP_REASONS: PlaceSkipReason[] = ['not_found', 'abroad', 'other'];

const PlacePicker: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const { setPlace, skipPlace } = useWizard();
  const [skipping, setSkipping] = useState(false);

  const [query, setQuery] = useState('');
  const [matches, setMatches] = useState<PlaceMatch[]>([]);
  const [resultQuery, setResultQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [failed, setFailed] = useState(false);
  const [picked, setPicked] = useState<PlaceMatch | null>(null);
  const [plz, setPlz] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [wrongPostcode, setWrongPostcode] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  useEffect(() => {
    if (picked || query.trim().length < 2) {
      setMatches([]);
      setSearching(false);
      return;
    }
    const ctl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctl;
    const id = setTimeout(() => {
      setSearching(true);
      setFailed(false);
      searchPlaces(query.trim(), ctl.signal)
        .then((r) => { if (!ctl.signal.aborted) { setMatches(r.matches); setResultQuery(r.query); } })
        .catch((e) => {
          if (!ctl.signal.aborted && (e as Error).name !== 'AbortError') setFailed(true);
        })
        .finally(() => { if (!ctl.signal.aborted) setSearching(false); });
    }, 250);
    return () => { clearTimeout(id); ctl.abort(); };
  }, [query, picked]);

  const confirm = async () => {
    if (!picked || !PLZ_RE.test(plz) || confirming) return;
    const ctl = new AbortController();
    abortRef.current?.abort();
    abortRef.current = ctl;
    setConfirming(true); setFailed(false); setWrongPostcode(false);
    try {
      const result = await searchPlaces(plz, ctl.signal);
      if (ctl.signal.aborted) return;
      const match = result.matches.find(m => m.ags === picked.ags && confirmedPostcode(m, plz));
      if (match) setPlace({ ...picked, plz });
      else setWrongPostcode(true);
    } catch (error) {
      if (!ctl.signal.aborted && (error as Error).name !== 'AbortError') setFailed(true);
    } finally { if (!ctl.signal.aborted) setConfirming(false); }
  };

  return (
    <div className={s.stage}>
      <div className={s.side}>
        <h2 className={s.h2}>{t('place.title')}</h2>
        <p className={s.lead}>{t('place.hint')}</p>
      </div>

      <div className={s.main}>
        {!picked && (
          <div className="sntiq-search">
            <Search aria-hidden="true" />
            <input
              type="text"
              className="sntiq-field"
              value={query}
              autoFocus
              placeholder={t('place.inputPlaceholder')}
              onChange={(e) => setQuery(e.target.value)}
              aria-label={t('place.title')}
            />
          </div>
        )}

        {failed && (
          <div className={s.notice} data-tone="bad" style={{ marginTop: '1rem' }}>
            <AlertTriangle aria-hidden="true" />
            <p>{t('place.error')}</p>
          </div>
        )}

        {!picked && matches.length > 0 && (
          <>
            {matches.some((m) => m.fuzzy) && (
              <p className={s.hint} style={{ marginTop: '1rem' }}>{t('place.didYouMean')}</p>
            )}
            <ul className={s.rows} style={{ marginTop: '1rem' }} data-sb="matches" aria-label={t('place.title')}>
              {matches.map((m) => (
                <li key={`${m.ags}-${m.plz ?? ''}`}>
                  <button
                    type="button"
                    className="sntiq-radio-card"
                    onClick={() => {
                      // PLZ search already pins the postal code — done
                      const code = confirmedPostcode(m, resultQuery);
                      if (code) { setPlace({ ...m, plz: code }); return; }
                      setPicked(m);
                      setMatches([]);
                    }}
                  >
                    <span className={s.rowBody}>
                      <b>
                        {confirmedPostcode(m, resultQuery) ? `${m.plz} ` : ''}{m.name}
                      </b>
                      <small>{[m.kreis, m.land].filter(Boolean).join(' · ')}</small>
                    </span>
                    <ChevronRight aria-hidden="true" className={s.arrow} />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {!picked && !searching && !failed && query.trim().length >= 2 &&
          matches.length === 0 && (
          <p className={s.hint} style={{ marginTop: '1rem' }}>{t('place.noResults')}</p>
        )}

        {picked && (
          <>
            <div className={s.picked}>
              <p>
                <b>{picked.name}</b> <span>({picked.land})</span>
              </p>
              <button
                type="button"
                className={s.linkBtn}
                onClick={() => { abortRef.current?.abort(); setPicked(null); setPlz(''); setConfirming(false); setWrongPostcode(false); }}
              >
                {t('common.change')}
              </button>
            </div>

            <div className={s.field} style={{ marginTop: '1.5rem' }}>
              <label htmlFor="chamfer-plz">{t('place.plzPrompt')}</label>
              <input
                id="chamfer-plz"
                type="text"
                inputMode="numeric"
                className="sntiq-field"
                style={{ maxWidth: '12rem' }}
                value={plz}
                autoFocus
                placeholder="00000"
                maxLength={5}
                aria-describedby="chamfer-plz-why"
                onChange={(e) => {
                  abortRef.current?.abort();
                  setConfirming(false);
                  setPlz(e.target.value.replace(/\D/g, ''));
                  setWrongPostcode(false);
                  setFailed(false);
                }}
                onKeyDown={(e) => e.key === 'Enter' && confirm()}
              />
              <p id="chamfer-plz-why" className={s.hint}>{t('place.plzWhy')}</p>
              {wrongPostcode && <p role="alert" className={s.error}>{t('place.plzMismatch')}</p>}
            </div>

            <div className={s.actions}>
              <button
                type="button"
                className="sntiq-btn sntiq-btn-primary"
                disabled={!PLZ_RE.test(plz) || confirming}
                onClick={confirm}
              >
                {t('common.next')}
              </button>
            </div>
          </>
        )}

        {/* skip with a reason — recipient is then entered manually */}
        {!picked && !skipping && (
          <button
            type="button"
            data-sb="skip"
            className={s.linkBtn}
            style={{ marginTop: '1.5rem' }}
            onClick={() => setSkipping(true)}
          >
            {t('place.skipLink')}
          </button>
        )}
        {skipping && (
          <div className={s.section}>
            <h3 className={s.h3}>{t('place.skipTitle')}</h3>
            <div className={s.rows}>
              {SKIP_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  className="sntiq-radio-card"
                  onClick={() => skipPlace(r)}
                >
                  <span className={s.rowBody}>{t(`place.skipReason.${r}`)}</span>
                  <ChevronRight aria-hidden="true" className={s.arrow} />
                </button>
              ))}
            </div>
            <p className={s.hint} style={{ marginTop: '.75rem' }}>{t('place.skipNote')}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default PlacePicker;
