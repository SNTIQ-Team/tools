'use client';

/**
 * Shared form inputs — unified handling with the Lathe module:
 *
 *  - LatinTextInput: official German forms reject Cyrillic; instead of
 *    silently dropping characters (Lathe v1 behaviour) we strip AND show
 *    a transient warning so the user understands what happened.
 *  - GermanDateInput: TT.MM.JJJJ through the site's DateField (typing
 *    closes segments and adds the dots; the system calendar sits behind
 *    a button), with this module's validity messages.
 */

import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import DateField from '@/core/DateField';
import { CYRILLIC_RE as CYRILLIC, formatGermanDate } from '@/core/forms';
import { isValidGermanDate, parseISO } from '../engine/logic';
import s from '../chamfer.module.css';
import '../i18n/register';

export { formatGermanDate };

export const LatinTextInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  ariaLabel?: string;
}> = ({ id, value, onChange, placeholder, ariaLabel }) => {
  const { t } = useTranslation('chamfer');
  const [warn, setWarn] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <>
      <input
        id={id}
        type="text"
        className="sntiq-field"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(e) => {
          const raw = e.target.value;
          if (CYRILLIC.test(raw)) {
            setWarn(true);
            if (timer.current) clearTimeout(timer.current);
            timer.current = setTimeout(() => setWarn(false), 3000);
          }
          onChange(raw.replace(CYRILLIC, ''));
        }}
      />
      {warn && (
        <p role="status" className={s.warn}>{t('profile.latinWarn')}</p>
      )}
    </>
  );
};

/**
 * Same UX as GermanDateInput, but the committed value is ISO
 * (yyyy-mm-dd) for the date logic in engine/logic.ts. Partial input
 * lives in local state; only a complete dd.mm.yyyy commits.
 */
export const IsoDateInput: React.FC<{
  id: string;
  /** ISO value or '' */
  value: string;
  onChange: (iso: string) => void;
}> = ({ id, value, onChange }) => {
  const toDisplay = (iso: string) => {
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}.${m[2]}.${m[1]}` : '';
  };
  const [text, setText] = useState(() => toDisplay(value));
  const lastIso = useRef(value);
  if (value !== lastIso.current) {
    // external change (e.g. prefill): sync the display buffer
    lastIso.current = value;
    const d = toDisplay(value);
    if (d !== text) setText(d);
  }
  return (
    <GermanDateInput
      id={id}
      value={text}
      onChange={(v) => {
        setText(v);
        const m = v.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        const candidate = m ? `${m[3]}-${m[2]}-${m[1]}` : '';
        const iso = parseISO(candidate) ? candidate : '';
        lastIso.current = iso;
        onChange(iso);
      }}
    />
  );
};

export const GermanDateInput: React.FC<{
  id: string;
  value: string;
  onChange: (v: string) => void;
  /** yyyy-mm-dd: the last allowed day (birth dates: today in Berlin). */
  max?: string;
}> = ({ id, value, onChange, max }) => {
  const { t } = useTranslation('chamfer');
  const [touched, setTouched] = useState(false);
  const iso = isValidGermanDate(value) ? value.split('.').reverse().join('-') : '';
  const invalid = value !== '' && (touched || value.length >= 10)
    && (!iso || Boolean(max && iso > max));

  // The site's date field (core/DateField, as in Lathe): typed TT.MM.JJJJ in
  // every browser language, the system calendar behind the button.
  return (
    <div>
      <DateField
        id={id}
        value={value}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        max={max}
        invalid={invalid}
        describedBy={invalid ? `${id}-error` : undefined}
      />
      {invalid && <p id={`${id}-error`} className={s.error}>{t(max && iso > max ? 'profile.futureDate' : 'profile.invalidDate')}</p>}
    </div>
  );
};
