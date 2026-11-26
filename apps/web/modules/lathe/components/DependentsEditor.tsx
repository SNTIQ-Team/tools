'use client';

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Plus, TriangleAlert } from 'lucide-react';
import { useForm } from './FormContext';
import { Dependent } from '../types';
import type { StepErrors } from '../formValidation';
import DateField from '@/core/DateField';
import { todayIsoIn } from '@/core/jurisdiction';
import { LATHE_JURISDICTION } from '../jurisdiction';
import { normalizeEuroDE, parseEuroDE, isPastGermanDate } from '../validation';
import '../i18n/register';

const MAX_DEPENDENTS = 5;

const emptyDependent = (): Dependent => ({
  name: '',
  birthDate: '',
  relationship: '',
  monthlySupport: '',
  hasOwnIncome: null,
  ownIncomeAmount: '',
});

const DependentsEditor = ({ errors, onTouch }: { errors: StepErrors; onTouch?: (id: string) => void }) => {
  const { t } = useTranslation('lathe');
  const { data, updateField } = useForm();
  const list = data.dependents.length ? data.dependents : [emptyDependent()];

  // Cyrillic is removed (the form must match the passport), but never
  // silently: the same notice as in the main questionnaire.
  const [latinWarn, setLatinWarn] = React.useState(false);
  const warnTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (warnTimer.current) clearTimeout(warnTimer.current); }, []);
  const latin = (value: string) => {
    const cleaned = value.replace(/[А-Яа-яЁёІіЇїЄєҐґ]/g, '');
    if (cleaned !== value) {
      setLatinWarn(true);
      if (warnTimer.current) clearTimeout(warnTimer.current);
      warnTimer.current = setTimeout(() => setLatinWarn(false), 3000);
    }
    return cleaned;
  };

  const update = (i: number, patch: Partial<Dependent>) => {
    if (patch.name !== undefined) patch.name = latin(patch.name);
    if (patch.relationship !== undefined) patch.relationship = latin(patch.relationship);
    const next = list.map((d, idx) => (idx === i ? { ...d, ...patch } : d));
    updateField('dependents', next);
  };

  const add = () => {
    if (list.length >= MAX_DEPENDENTS) return;
    updateField('dependents', [...list, emptyDependent()]);
  };

  const remove = (i: number) => {
    updateField('dependents', list.filter((_, idx) => idx !== i));
  };

  const amountError = (v: string) => Boolean(v) && (!Number.isFinite(parseEuroDE(v)) || parseEuroDE(v) < 0);

  return (
    <div className="grid gap-6">
      {latinWarn && (
        <p role="status" className="lathe-status" data-tone="warn">
          <TriangleAlert aria-hidden="true" />
          <strong>{t('latinWarn')}</strong>
        </p>
      )}
      {list.map((dep, i) => {
        const nameId = `dependent-${i}-name`;
        const badDate = Boolean(dep.birthDate) && !isPastGermanDate(dep.birthDate);
        return (
          <div key={i} role="group" aria-labelledby={`dependent-${i}-title`} className="lathe-person">
            <div className="lathe-personHead">
              <h3 id={`dependent-${i}-title`} className="sntiq-kicker">
                {t('dep.row')} {i + 1}
              </h3>
              {list.length > 1 && <button type="button" onClick={() => remove(i)} className="sntiq-btn lathe-small" aria-label={`${t('dep.remove')}: ${t('dep.row')} ${i + 1}`}>
                {t('dep.remove')}
              </button>}
            </div>

            <div className="lathe-personGrid">
              <div>
                <label htmlFor={nameId} className="lathe-label">{t('dep.name')} <span className="lathe-req">*</span></label>
                <input id={nameId} className="sntiq-field" value={dep.name} aria-required="true"
                  aria-invalid={Boolean(errors[nameId])} aria-describedby={errors[nameId] ? `${nameId}-error` : undefined}
                  onBlur={() => onTouch?.(nameId)} onChange={(e) => update(i, { name: e.target.value })} />
                {errors[nameId] && <p id={`${nameId}-error`} className="lathe-error">{t(errors[nameId])}</p>}
              </div>
              <div>
                <label htmlFor={`dependent-${i}-birthDate`} className="lathe-label">{t('dep.birthDate')}</label>
                <DateField id={`dependent-${i}-birthDate`} invalid={badDate} describedBy={badDate ? `dependent-${i}-birthDate-error` : undefined} max={todayIsoIn(LATHE_JURISDICTION)} value={dep.birthDate} onChange={(v) => update(i, { birthDate: v })} />
                {badDate && <p id={`dependent-${i}-birthDate-error`} className="lathe-error">{t('validation.date')}</p>}
              </div>
              <div>
                <label htmlFor={`dependent-${i}-relationship`} className="lathe-label">{t('dep.relationship')}</label>
                <input id={`dependent-${i}-relationship`} className="sntiq-field" placeholder={t('dep.relationship.placeholder')} value={dep.relationship} onChange={(e) => update(i, { relationship: e.target.value })} />
              </div>
              <div>
                <label htmlFor={`dependent-${i}-monthlySupport`} className="lathe-label">{t('dep.monthlySupport')}</label>
                <div className="relative"><input id={`dependent-${i}-monthlySupport`} aria-invalid={amountError(dep.monthlySupport)} aria-describedby={amountError(dep.monthlySupport) ? `dependent-${i}-monthlySupport-error` : undefined} className="sntiq-field sntiq-field-end" inputMode="decimal" placeholder="0,00" value={dep.monthlySupport} onChange={(e) => update(i, { monthlySupport: e.target.value })} onBlur={(e) => update(i, { monthlySupport: normalizeEuroDE(e.target.value) || e.target.value })} /><span className="lathe-unit" aria-hidden="true">€</span></div>
                {amountError(dep.monthlySupport) && <p id={`dependent-${i}-monthlySupport-error`} className="lathe-error">{t('validation.nonnegative')}</p>}
              </div>
            </div>

            <div className="mt-4">
              <span id={`dependent-${i}-income-label`} className="lathe-label">{t('dep.hasOwnIncome')}</span>
              <div role="radiogroup" aria-labelledby={`dependent-${i}-income-label`} className="lathe-choices">
                {[true, false].map((v) => (
                  <label
                    key={String(v)}
                    data-checked={dep.hasOwnIncome === v}
                    className="lathe-choice"
                  >
                    <input type="radio" name={`dependent-${i}-income`} value={String(v)} checked={dep.hasOwnIncome === v} onChange={() => update(i, { hasOwnIncome: v })} className="sntiq-radio" />
                    {v ? t('opt.yes') : t('opt.no')}
                  </label>
                ))}
              </div>
            </div>

            {dep.hasOwnIncome === true && (
              <div className="mt-4">
                <label htmlFor={`dependent-${i}-ownIncomeAmount`} className="lathe-label">{t('dep.ownIncomeAmount')}</label>
                <div className="relative"><input id={`dependent-${i}-ownIncomeAmount`} aria-invalid={amountError(dep.ownIncomeAmount)} aria-describedby={amountError(dep.ownIncomeAmount) ? `dependent-${i}-ownIncomeAmount-error` : undefined} className="sntiq-field sntiq-field-end" inputMode="decimal" placeholder="0,00" value={dep.ownIncomeAmount} onChange={(e) => update(i, { ownIncomeAmount: e.target.value })} onBlur={(e) => update(i, { ownIncomeAmount: normalizeEuroDE(e.target.value) || e.target.value })} /><span className="lathe-unit" aria-hidden="true">€</span></div>
                {amountError(dep.ownIncomeAmount) && <p id={`dependent-${i}-ownIncomeAmount-error`} className="lathe-error">{t('validation.nonnegative')}</p>}
              </div>
            )}
          </div>
        );
      })}

      {list.length < MAX_DEPENDENTS && (
        <div className={list.length ? 'lathe-person' : undefined}>
          <button type="button" onClick={add} className="sntiq-btn">
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            {t('dep.add')}
          </button>
        </div>
      )}
    </div>
  );
};

export default DependentsEditor;
