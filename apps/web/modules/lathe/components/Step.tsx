'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { TriangleAlert } from 'lucide-react';
import { WizardStep } from '../types';
import { useForm } from './FormContext';
import DependentsEditor from './DependentsEditor';
import { CYRILLIC_RE } from '@/core/forms';
import DateField from '@/core/DateField';
import { todayIsoIn } from '@/core/jurisdiction';
import { LATHE_JURISDICTION } from '../jurisdiction';
import { normalizeEuroDE } from '../validation';
import { getStepErrors } from '../formValidation';
import { visibleErrors } from './errorVisibility';
import '../i18n/register';

interface StepProps {
  step: WizardStep;
  /** ids of the fields the user has already left (see errorVisibility.ts) */
  touched?: ReadonlySet<string>;
  /** the user has tried to go on from this step */
  attempted?: boolean;
  onTouch?: (fieldId: string) => void;
}

const StepView: React.FC<StepProps> = ({ step, touched, attempted, onTouch }) => {
  const { getValue, updateField, data } = useForm();
  const { t } = useTranslation('lathe');
  // Validity is unchanged; only "required" waits until the user has had the
  // chance to answer (left the field, or pressed Next on this step).
  // The field with the caret: a date or amount still being typed is not
  // called wrong, even after Next was pressed on this step.
  const [editing, setEditing] = React.useState<string | null>(null);
  const errors = visibleErrors(getStepErrors(step, data), touched, attempted, editing);
  // transient "please use Latin letters" warning (shared UX with
  // Chamfer): stripping silently confused users
  const [latinWarn, setLatinWarn] = React.useState(false);
  const warnTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (warnTimer.current) clearTimeout(warnTimer.current); }, []);

  const handleTextChange = (path: string, value: string) => {
    if (CYRILLIC_RE.test(value)) {
      setLatinWarn(true);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => setLatinWarn(false), 3000);
    }
    updateField(path, value.replace(CYRILLIC_RE, ''));
  };

  const handleEuroChange = (path: string, value: string) => {
    // Keep the entered fact intact. Invalid text is visible and blocks Next.
    updateField(path, value);
  };

  // on blur amounts snap to canonical German notation ('1.234,56');
  // malformed input ('1,2,3', '1..2') is rejected — garbled amounts on a
  // court form invite rejection of the whole application
  const handleEuroBlur = (path: string, value: string) => {
    updateField(path, normalizeEuroDE(value) || value);
  };

  return (
    <div>
      <h2 className="lathe-stepTitle" tabIndex={-1}>{t(step.title)}</h2>
      {step.description && <p className="lathe-stepLead">{t(step.description)}</p>}

      {latinWarn && (
        <p role="status" className="lathe-status mt-5" data-tone="warn">
          <TriangleAlert aria-hidden="true" />
          <strong>{t('latinWarn', { defaultValue:
            'Bitte lateinische Buchstaben verwenden (wie im Pass) — ' +
            'kyrillische Zeichen wurden entfernt.' })}</strong>
        </p>
      )}
      <div className="lathe-fields">
        {step.fields.map((field) => {
          if (field.visibleIf && !field.visibleIf(data)) return null;

          if (field.type === 'info') {
            return (
              <div key={field.id} className="lathe-note">
                <h3>{t(field.label)}</h3>
                <p>{t(field.placeholder || '')}</p>
              </div>
            );
          }

          if (field.type === 'dependents') {
            return <DependentsEditor key={field.id} errors={errors} onTouch={onTouch} />;
          }

          const required = Boolean(field.required || field.requiredIf?.(data));
          const describedBy = [errors[field.id] && `${field.id}-error`, field.hint && `${field.id}-hint`]
            .filter(Boolean).join(' ') || undefined;

          return (
            <div key={field.id}>
              <label
                id={`${field.id}-label`}
                htmlFor={field.type === 'radio' ? undefined : field.id}
                className="lathe-label"
              >
                {t(field.label)} {required && <span className="lathe-req">*</span>}
              </label>

              {field.type === 'text' && (
                <input
                  type={field.inputMode === 'tel' ? 'tel' : 'text'}
                  inputMode={field.inputMode}
                  autoComplete={field.autoComplete}
                  id={field.id}
                  aria-invalid={Boolean(errors[field.id])}
                  aria-describedby={describedBy}
                  aria-required={required || undefined}
                  className="sntiq-field"
                  value={getValue(field.path)}
                  placeholder={field.placeholder ? t(field.placeholder) : ''}
                  onChange={(e) => handleTextChange(field.path, e.target.value)}
                  onFocus={() => setEditing(field.id)}
                  onBlur={() => { setEditing(null); onTouch?.(field.id); }}
                />
              )}

              {field.type === 'euro' && (
                <div className="relative">
                  <input
                    type="text"
                    inputMode="decimal"
                    id={field.id}
                    aria-invalid={Boolean(errors[field.id])}
                    aria-describedby={describedBy}
                    aria-required={required || undefined}
                    className="sntiq-field sntiq-field-end"
                    value={getValue(field.path)}
                    placeholder={field.placeholder || '0,00'}
                    onChange={(e) => handleEuroChange(field.path, e.target.value)}
                    onFocus={() => setEditing(field.id)}
                    onBlur={(e) => { setEditing(null); handleEuroBlur(field.path, e.target.value); onTouch?.(field.id); }}
                  />
                  <span className="lathe-unit" aria-hidden="true">€</span>
                </div>
              )}

              {field.type === 'date' && (
                <DateField
                  id={field.id}
                  value={getValue(field.path)}
                  onChange={(v) => updateField(field.path, v)}
                  onFocus={() => setEditing(field.id)}
                  onBlur={() => { setEditing(null); onTouch?.(field.id); }}
                  max={field.pastOnly ? todayIsoIn(LATHE_JURISDICTION) : undefined}
                  invalid={Boolean(errors[field.id])}
                  describedBy={describedBy}
                  required={required}
                />
              )}

              {field.type === 'textarea' && (
                <textarea
                  id={field.id}
                  rows={3}
                  aria-describedby={describedBy}
                  className="sntiq-field"
                  value={getValue(field.path)}
                  placeholder={field.placeholder ? t(field.placeholder) : ''}
                  onChange={(e) => handleTextChange(field.path, e.target.value)}
                  onFocus={() => setEditing(field.id)}
                  onBlur={() => { setEditing(null); onTouch?.(field.id); }}
                />
              )}

              {field.type === 'select' && (
                <select
                  id={field.id}
                  aria-invalid={Boolean(errors[field.id])}
                  aria-describedby={describedBy}
                  aria-required={required || undefined}
                  className="sntiq-field"
                  value={getValue(field.path)}
                  onChange={(e) => handleTextChange(field.path, e.target.value)}
                  onFocus={() => setEditing(field.id)}
                  onBlur={() => { setEditing(null); onTouch?.(field.id); }}
                >
                  <option value="">{t('select.placeholder')}</option>
                  {field.options?.map((o) => (
                    <option key={String(o.value)} value={String(o.value)}>
                      {t(o.label)}
                    </option>
                  ))}
                </select>
              )}

              {field.type === 'radio' && (
                <div
                  role="radiogroup"
                  aria-labelledby={`${field.id}-label`}
                  aria-describedby={describedBy}
                  aria-required={required || undefined}
                  className="lathe-choices"
                  // the group is "left" when focus moves out of it, not
                  // when it moves from one option to the next
                  onBlur={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) onTouch?.(field.id);
                  }}
                >
                  {field.options?.map((o) => {
                    const current = getValue(field.path);
                    const checked = current === o.value;
                    return (
                      <label
                        key={String(o.value)}
                        data-checked={checked}
                        className="lathe-choice"
                      >
                        <input
                          type="radio"
                          name={field.id}
                          value={String(o.value)}
                          checked={checked}
                          onChange={() => updateField(field.path, o.value)}
                          className="sntiq-radio"
                        />
                        <span className="min-w-0 break-words">{t(o.label)}</span>
                      </label>
                    );
                  })}
                </div>
              )}

              {errors[field.id] && <p id={`${field.id}-error`} className="lathe-error">{t(errors[field.id])}</p>}

              {field.hint && <p id={`${field.id}-hint`} className="lathe-hint">{t(field.hint)}</p>}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepView;
