'use client';

/**
 * Chamfer — Module 1 of Deutschland Together.
 * Shell chrome (header/footer/theme/i18n) comes from the platform core;
 * this component renders the guided flow: place → situation → letter.
 */

import React from 'react';
import { useTranslation } from 'react-i18next';
import { Check } from 'lucide-react';
import { useModuleActions } from '@/core/shell/ModuleActions';
import ModuleBand from '@/core/shell/ModuleBand';
import {
  WizardProvider, useWizard, type WizardStep,
} from './components/WizardContext';
import PlacePicker from './components/PlacePicker';
import Triage from './components/Triage';
import LetterWizard from './components/LetterWizard';
import ConsentGate from './components/ConsentGate';
import FaqPanel from './components/FaqPanel';
import DraftBar from './components/DraftBar';
import { useStageTop } from './components/useStageTop';
import s from './chamfer.module.css';
import './i18n/register';

const STEPS: WizardStep[] = ['place', 'triage', 'letter'];

/** Plain navigation: number, name, and a rule under the current step.
 *  Completed steps are links back; nothing skips forward. */
const Stepper: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const { step, place, placeSkip, goToStep } = useWizard();
  const current = STEPS.indexOf(step);

  return (
    <nav aria-label={t('steps.label')} className={s.steps}>
      {STEPS.map((id, i) => {
        const done = i < current;
        const active = i === current;
        // back-navigation only onto completed steps; never forward-skip
        const clickable = done &&
          (id !== 'triage' || place !== null || placeSkip !== null);
        return (
          <button
            key={id}
            type="button"
            aria-current={active ? 'step' : undefined}
            data-done={done || undefined}
            disabled={!clickable}
            onClick={() => clickable && goToStep(id)}
            className={s.step}
          >
            {done ? <Check aria-hidden="true" /> : <i aria-hidden="true">{i + 1}</i>}
            <span>{t(`steps.${id}`)}</span>
          </button>
        );
      })}
    </nav>
  );
};

const Flow: React.FC = () => {
  const { step } = useWizard();
  const top = useStageTop(step);
  return (
    <div ref={top} className={s.flow}>
      {step === 'place' && <PlacePicker />}
      {step === 'triage' && <Triage />}
      {step === 'letter' && <LetterWizard />}
    </div>
  );
};

const Inner: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const { step } = useWizard();
  const [showFaq, setShowFaq] = React.useState(false);

  useModuleActions(
    'chamfer',
    { footerNote: <span>{t('footer.disclaimer')}</span> },
    [t],
  );

  return (
    <div data-module="chamfer">
      {/* The module's band (ModuleBand, DESIGN.md section 7): open on entry
          (the terms and the city), folded to a strip from the situation on,
          so the work moves up. */}
      <ModuleBand
        module="chamfer"
        name="Chamfer"
        line={t('app.subtitle')}
        compact={step !== 'place'}
        crumbsLabel={t('a11y:breadcrumb')}
        crumbs={[{ href: '/', label: 'SNTIQ' }, { href: '/#projects', label: 'Deutschland Together' }]}
      />
    {/* Same horizontal frame as the site header: padding outside the max-width box. */}
    <div className={`${s.page} px-4 sm:px-6 lg:px-8`}>
      <div className="max-w-screen-xl mx-auto w-full">
        <div className={s.nav} data-faq={showFaq || undefined}>
          <Stepper />
          <button
            type="button"
            data-sb="faq"
            aria-expanded={showFaq}
            onClick={() => setShowFaq((v) => !v)}
            className={s.step}
          >
            {t('steps.faq')}
          </button>
        </div>

        <ConsentGate>
          {/* Opt-in local draft (device-local, default off) */}
          <DraftBar>
            {showFaq ? <FaqPanel onClose={() => setShowFaq(false)} /> : <Flow />}
          </DraftBar>
        </ConsentGate>
      </div>
    </div>
    </div>
  );
};

const ChamferModule: React.FC = () => (
  <WizardProvider>
    <Inner />
  </WizardProvider>
);

export default ChamferModule;
