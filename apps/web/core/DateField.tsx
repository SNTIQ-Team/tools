'use client';

import React, { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CalendarDays } from 'lucide-react';
import { formatGermanDate } from '@/core/forms';
import { germanToIso, isoToGerman } from '@/core/dateInput';

/**
 * The site's date field (the form kit, docs/DESIGN.md section 6): every date
 * on the site is entered here, in every module.
 *
 * A date is always day, month, year with dots, as in Germany. The visible
 * field is text (typing closes segments and adds the dots, see
 * formatGermanDate): `<input type="date">` would show the browser's own
 * format, mm/dd/yyyy in an American browser. The hint in the empty field and
 * the calendar button's name come from the platform texts in the reader's
 * language (DD.MM.YYYY, TT.MM.JJJJ, ДД.ММ.ГГГГ, ДД.ММ.РРРР); a module cannot
 * pass its own. Beside the field a button opens the system calendar through a
 * hidden date input (showPicker); the chosen day is written back with dots.
 * The hidden input is out of the tab order and the accessibility tree.
 *
 * `min` and `max` are YYYY-MM-DD and bound the calendar (a birth date: max is
 * today in the tool's jurisdiction, core/jurisdiction.ts).
 */
export type DateFieldProps = {
  id?: string;
  /** TT.MM.JJJJ, or what has been typed so far */
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onFocus?: () => void;
  min?: string;
  max?: string;
  /** Extra classes for the visible field (sizes); the look is the kit's. */
  className?: string;
  invalid?: boolean;
  describedBy?: string;
  required?: boolean;
  ariaLabel?: string;
};

const DateField: React.FC<DateFieldProps> = ({
  id, value, onChange, onBlur, onFocus, min = '1900-01-01', max, className = '', invalid, describedBy, required, ariaLabel,
}) => {
  const { t } = useTranslation();
  const picker = useRef<HTMLInputElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const calendar = t('forms:calendar');

  const openCalendar = () => {
    const el = picker.current;
    if (!el) return;
    try {
      el.showPicker();
    } catch {
      // No showPicker (very old browser) or not allowed: typing still works.
      field.current?.focus();
    }
  };

  return (
    <div className="sntiq-date">
      <input
        ref={field}
        type="text"
        inputMode="numeric"
        id={id}
        className={`sntiq-field ${className}`}
        value={value}
        placeholder={t('forms:date_placeholder')}
        aria-label={ariaLabel}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        aria-required={required || undefined}
        onChange={(e) => onChange(formatGermanDate(e.target.value))}
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <input
        ref={picker}
        type="date"
        tabIndex={-1}
        aria-hidden="true"
        className="sntiq-date-picker"
        value={germanToIso(value)}
        min={min}
        max={max}
        onChange={(e) => { onChange(isoToGerman(e.target.value)); onBlur?.(); }}
      />
      <button type="button" className="sntiq-date-button" aria-label={calendar} title={calendar} onClick={openCalendar}>
        <CalendarDays aria-hidden="true" />
      </button>
    </div>
  );
};

/**
 * The same field for a value kept as YYYY-MM-DD (date logic, URLs, APIs).
 * What is typed lives here until it is a whole, real date; only then, or
 * when the field is emptied, does `onChange` receive the ISO day ('' for
 * empty). A new `value` from outside replaces what is shown.
 */
export const IsoDateField: React.FC<Omit<DateFieldProps, 'value' | 'onChange'> & {
  value: string;
  onChange: (iso: string) => void;
}> = ({ value, onChange, ...rest }) => {
  const [text, setText] = useState(() => isoToGerman(value));
  const [seen, setSeen] = useState(value);
  if (value !== seen) {
    setSeen(value);
    const shown = isoToGerman(value);
    if (shown !== text && germanToIso(text) !== value) setText(shown);
  }
  return (
    <DateField
      {...rest}
      value={text}
      onChange={(v) => {
        setText(v);
        const iso = germanToIso(v);
        if (iso || v === '') { setSeen(iso); onChange(iso); }
      }}
    />
  );
};

export default DateField;
