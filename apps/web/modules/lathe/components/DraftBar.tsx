'use client';

/**
 * Opt-in local draft bar (§25 TTDSG / GDPR data-minimisation):
 * default OFF; while ON the wizard state is autosaved (debounced) to
 * localStorage on this device only — unencrypted, never uploaded.
 * Turning the toggle OFF deletes the stored draft immediately. While
 * a found draft is still offered, autosave is held so the stored copy
 * is not overwritten before the user restores or deletes it.
 */

import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  useLocalDraft,
  readDraft,
  clearDraft,
  readDraftOptIn,
  writeDraftOptIn,
  mergeDraft,
  type DraftEnvelope,
} from '@/core/useLocalDraft';
import { htmlLang } from '@/core/i18n/config';
import { useForm } from './FormContext';
import { createInitialData } from '../wizard';
import { todayGerman } from '@/core/jurisdiction';
import { LATHE_JURISDICTION } from '../jurisdiction';
import { IncomeType, LatheFormData } from '../types';
import { parseEuroDE } from '../validation';
import '../i18n/register';

const DRAFT_KEY = 'lathe';

/** Cheap shape check — a v1 Lathe draft always has these branches. */
const looksLikeLatheDraft = (d: unknown): d is LatheFormData =>
  !!d &&
  typeof d === 'object' &&
  typeof (d as LatheFormData).personal === 'object' &&
  (d as LatheFormData).personal !== null &&
  typeof (d as LatheFormData).financials === 'object' &&
  (d as LatheFormData).financials !== null;

const DraftBar: React.FC = () => {
  const { t, i18n } = useTranslation('lathe');
  const { data, setData } = useForm();
  const [optIn, setOptIn] = useState(false);
  // draft found in storage, not yet restored/deleted — read once on mount
  const [pending, setPending] = useState<DraftEnvelope<LatheFormData> | null>(null);

  useEffect(() => {
    setOptIn(readDraftOptIn(DRAFT_KEY));
    const envelope = readDraft<LatheFormData>(DRAFT_KEY);
    if (envelope && looksLikeLatheDraft(envelope.data)) setPending(envelope);
    else if (envelope) clearDraft(DRAFT_KEY); // shape mismatch → discard silently
  }, []);

  // autosave held while an unrestored draft is offered (see header note)
  useLocalDraft(DRAFT_KEY, data, optIn && pending === null);

  const handleToggle = (on: boolean) => {
    setOptIn(on);
    writeDraftOptIn(DRAFT_KEY, on); // OFF → deletes the stored draft too
    if (!on) setPending(null);
  };

  const handleRestore = () => {
    if (!pending) return;
    // merge over fresh defaults: fields added since the save keep defaults
    const restored = mergeDraft(createInitialData(), pending.data);
    // An automatic date in the draft (or one from before the flag existed)
    // means "the day of signing": that is today, not the day it was saved.
    if (restored.declaration.dateIsAuto !== false) {
      restored.declaration.date = todayGerman(LATHE_JURISDICTION);
      restored.declaration.dateIsAuto = true;
    }
    // Older drafts could record the SGB amount in the introduction instead of E.
    if (pending.data.useSgbXiiExemption === undefined &&
        (restored.incomeType === IncomeType.BENEFITS_SGB_II || restored.incomeType === IncomeType.BENEFITS_SGB_XII)) {
      const income = restored.financials.income;
      if (restored.benefitAmount && (!income.buergergeld?.trim() || parseEuroDE(income.buergergeld) === 0)) {
        income.buergergeld = restored.benefitAmount;
      }
      restored.benefitAmount = '';
    }
    setData(restored);
    setPending(null);
  };

  const handleDelete = () => {
    clearDraft(DRAFT_KEY);
    setPending(null);
  };

  const savedAt = pending ? new Date(pending.savedAt) : null;
  const savedLabel =
    savedAt && !Number.isNaN(savedAt.getTime())
      ? savedAt.toLocaleString(htmlLang(i18n.language), {
          dateStyle: 'medium',
          timeStyle: 'short',
        })
      : '';

  return (
    <div className="lathe-draft">
      <label className="lathe-draftToggle">
        <input
          type="checkbox"
          className="sntiq-check"
          checked={optIn}
          aria-describedby="lathe-draft-note"
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span>{t('draft.toggle')}</span>
      </label>
      <p id="lathe-draft-note" className="lathe-draftNote">{t('draft.note')}</p>

      {pending && (
        <div className="lathe-draftFound">
          <span>{t('draft.found', { date: savedLabel })}</span>
          <button type="button" onClick={handleRestore} className="sntiq-btn lathe-small">
            {t('draft.restore')}
          </button>
          <button type="button" onClick={handleDelete} className="sntiq-btn lathe-small">
            {t('draft.delete')}
          </button>
        </div>
      )}
    </div>
  );
};

export default DraftBar;
