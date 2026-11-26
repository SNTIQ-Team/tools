'use client';

/**
 * Opt-in local draft bar (§25 TTDSG / GDPR data-minimisation):
 * default OFF; while ON the wizard snapshot is autosaved (debounced)
 * to localStorage on this device only — unencrypted, never uploaded.
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
import {
  useWizard, emptyWizardSnapshot,
  type WizardSnapshot, type WizardStep,
} from './WizardContext';
import s from '../chamfer.module.css';
import '../i18n/register';

const DRAFT_KEY = 'chamfer';

const STEP_IDS: readonly WizardStep[] = ['place', 'triage', 'letter'];

/** Cheap shape check — a v1 Chamfer draft always has these branches. */
const looksLikeSnapshot = (d: unknown): d is WizardSnapshot =>
  !!d &&
  typeof d === 'object' &&
  STEP_IDS.includes((d as WizardSnapshot).step) &&
  Array.isArray((d as WizardSnapshot).treePath) &&
  typeof (d as WizardSnapshot).answers === 'object' &&
  (d as WizardSnapshot).answers !== null &&
  typeof (d as WizardSnapshot).profile === 'object' &&
  (d as WizardSnapshot).profile !== null;

const DraftBar: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const { t, i18n } = useTranslation('chamfer');
  const { snapshot, restoreSnapshot } = useWizard();
  const [optIn, setOptIn] = useState(false);
  // draft found in storage, not yet restored/deleted — read once on mount
  const [pending, setPending] = useState<DraftEnvelope<WizardSnapshot> | null>(null);

  useEffect(() => {
    setOptIn(readDraftOptIn(DRAFT_KEY));
    const envelope = readDraft<WizardSnapshot>(DRAFT_KEY);
    if (envelope && looksLikeSnapshot(envelope.data)) setPending(envelope);
    else if (envelope) clearDraft(DRAFT_KEY); // shape mismatch → discard silently
  }, []);

  // autosave held while an unrestored draft is offered (see header note)
  useLocalDraft(DRAFT_KEY, snapshot, optIn && pending === null);

  const handleToggle = (on: boolean) => {
    setOptIn(on);
    writeDraftOptIn(DRAFT_KEY, on); // OFF → deletes the stored draft too
    if (!on) setPending(null);
  };

  const handleRestore = () => {
    if (!pending) return;
    // merge over fresh defaults: fields added since the save keep defaults
    const snap = mergeDraft(emptyWizardSnapshot(), pending.data);
    if (snap.step === 'letter' && !snap.letterId) snap.step = 'triage';
    restoreSnapshot(snap);
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

  const toggle = (
    <>
      <label className={s.check}>
        <input
          type="checkbox"
          className="sntiq-check"
          checked={optIn}
          onChange={(e) => handleToggle(e.target.checked)}
        />
        <span>{t('draft.toggle')}</span>
      </label>
      <p className={s.draftNote}>{t('draft.note')}</p>
    </>
  );

  // The option sits above the step on a wide screen and below it on a narrow
  // one, where it would otherwise push the step's own input off the first
  // screen. Only one of the two is ever displayed (see .draftTop/.draftEnd).
  return (
    <>
      <div className={`${s.draft} ${s.draftTop}`}>{toggle}</div>

      {pending && (
        <div className={s.draftFound}>
          <span>{t('draft.found', { date: savedLabel })}</span>
          <div>
            <button type="button" onClick={handleRestore} className="sntiq-btn">
              {t('draft.restore')}
            </button>
            <button type="button" onClick={handleDelete} className="sntiq-btn">
              {t('draft.delete')}
            </button>
          </div>
        </div>
      )}

      {children}

      <div className={`${s.draft} ${s.draftEnd}`}>{toggle}</div>
    </>
  );
};

export default DraftBar;
