'use client';

/**
 * Step 2 — triage. Walks data/decision-tree.ts: question cards until an
 * outcome, then the outcome panel: urgency banner, explanation, per-Land
 * remedy branch (remedies.ts), notes and the recommended letter cards.
 * Outcomes only RECOMMEND — every letter still runs its gate.
 */

import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, ChevronDown, Clock, Info, ArrowLeft, ChevronRight } from 'lucide-react';
import { treeNode, type OutcomeNode } from '../data/decision-tree';
import { LETTER_GROUPS, letterById } from '../data/letters';
import { DEADLINES } from '../data/remedies';
import { useWizard } from './WizardContext';
import s from '../chamfer.module.css';
import '../i18n/register';

/** urgency → status tone (deadline = bad, high = warn, normal = neutral) */
const URGENCY_TONE: Record<OutcomeNode['urgency'], string | undefined> = {
  deadline: 'bad',
  high: 'warn',
  normal: undefined,
};

const RemedyBranch: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const { remedy } = useWizard();

  const confirmed = remedy.confidence === 'confirmed';
  let key = 'remedies.double';
  if (confirmed && remedy.status === 'direct_klage') key = 'remedies.directKlage';
  else if (confirmed && remedy.status === 'widerspruch') key = 'remedies.widerspruch';

  return (
    <div className={s.section}>
      <h4 className={s.h3}>{t('remedies.title', { land: remedy.name })}</h4>
      <p className={s.text}>
        {t(key, {
          land: remedy.name,
          klageMonths: DEADLINES.klageMonths,
          wrongMonths: DEADLINES.klageWrongInstructionMonths,
        })}
      </p>
      {!confirmed && (
        <p className={s.tone} data-tone="warn" style={{ margin: '.75rem 0 0' }}>
          <AlertTriangle aria-hidden="true" />
          {t('remedies.verifyFlag')}
        </p>
      )}
    </div>
  );
};

const LetterCard: React.FC<{ id: string }> = ({ id }) => {
  const { t } = useTranslation('chamfer');
  const { openLetter } = useWizard();
  const letter = letterById(id);
  if (!letter) return null;
  return (
    <button
      type="button"
      data-sb="letter"
      className="sntiq-radio-card"
      onClick={() => openLetter(id)}
    >
      <span className={s.rowBody}>
        <b>{t(letter.titleKey)}</b>
        <small>{t(letter.descriptionKey)}</small>
      </span>
      <ChevronRight aria-hidden="true" className={s.arrow} />
    </button>
  );
};

/** every letter, grouped — for users whose case the tree did not fit */
const AllLetters: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const [open, setOpen] = useState(false);
  return (
    <div className={s.section}>
      <button
        type="button"
        className={s.linkBtn}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {t('letter.allLetters')}
        <ChevronDown aria-hidden="true" />
      </button>
      {open && LETTER_GROUPS.map((g) => (
        <div key={g.titleKey} style={{ marginTop: '1.25rem' }}>
          <h5 className="sntiq-kicker" style={{ marginBottom: '.5rem' }}>{t(g.titleKey)}</h5>
          <div className={s.rows}>
            {g.ids.map((id) => <LetterCard key={id} id={id} />)}
          </div>
        </div>
      ))}
    </div>
  );
};

const Outcome: React.FC<{ node: OutcomeNode }> = ({ node }) => {
  const { t } = useTranslation('chamfer');

  return (
    <div data-sb="outcome">
      <p className={s.tone} data-tone={URGENCY_TONE[node.urgency]}>
        {node.urgency === 'deadline'
          ? <Clock aria-hidden="true" />
          : node.urgency === 'high'
            ? <AlertTriangle aria-hidden="true" />
            : <Info aria-hidden="true" />}
        {t(`urgency.${node.urgency}`)}
      </p>
      <p className={s.guide}>{t(node.guideKey)}</p>

      {node.remedyBranch && <RemedyBranch />}

      {(node.counseling || (node.noteKeys ?? []).length > 0) && (
        <ul className={s.notes}>
          {node.counseling && <li>{t('notes.counseling')}</li>}
          {(node.noteKeys ?? []).map((k) => <li key={k}>{t(k)}</li>)}
        </ul>
      )}

      {node.letters.length > 0 && (
        <div className={s.section}>
          <h4 className={s.h3}>{t('tree.lettersTitle')}</h4>
          <div className={s.rows}>
            {node.letters.map((id) => <LetterCard key={id} id={id} />)}
          </div>
        </div>
      )}

      <AllLetters />
    </div>
  );
};

const Triage: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const { treePath, treeAdvance, treeBack, place } = useWizard();

  const node = treeNode(treePath[treePath.length - 1]);
  if (!node) return null;

  return (
    <div className={s.stage}>
      <div className={s.side}>
        <h2 className={s.h2}>{t('tree.title')}</h2>
        <p className={s.lead}>{t('tree.hint')}</p>
        {place && <p className={s.meta}>{place.plz} {place.name}</p>}
        {treePath.length > 1 && (
          <button type="button" className={s.back} onClick={treeBack}>
            <ArrowLeft aria-hidden="true" className="sntiq-inline-icon" /> {t('common.back')}
          </button>
        )}
      </div>

      <div className={s.main}>
        {node.kind === 'question' ? (
          <div key={node.id}>
            <h3 className={s.h3}>{t(node.questionKey)}</h3>
            <div className={s.rows}>
              {node.options.map((o) => (
                <button
                  key={o.labelKey}
                  type="button"
                  className="sntiq-radio-card"
                  onClick={() => treeAdvance(o.next, o.preset)}
                >
                  <span className={s.rowBody}>{t(o.labelKey)}</span>
                  <ChevronRight aria-hidden="true" className={s.arrow} />
                </button>
              ))}
            </div>
          </div>
        ) : (
          <Outcome key={node.id} node={node} />
        )}
      </div>
    </div>
  );
};

export default Triage;
