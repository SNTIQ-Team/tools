'use client';

import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { FormProvider } from './components/FormContext';
import Questionnaire from './components/Questionnaire';
import PdfViewer from './components/PdfViewer';
import DraftBar from './components/DraftBar';
import { useModuleActions } from '@/core/shell/ModuleActions';
import ModuleBand from '@/core/shell/ModuleBand';
import SplitPanes from '@/core/SplitPanes';
import { useMediaQuery } from '@/core/useMediaQuery';
import { previewPageFor } from './previewPage';
import './lathe.css';
import './i18n/register';

type LayoutMode = 'form' | 'split' | 'preview';

/** "What am I looking at": plain text tabs with a rule under the current
 *  one — the same idiom as Chamfer's stepper. It lives next to the
 *  workspace it switches. */
function ViewSwitch<T extends LayoutMode>({ options, value, onChange, label, labels, className }: {
  options: readonly T[];
  value: T;
  onChange: (next: T) => void;
  label: string;
  labels: Record<LayoutMode, string>;
  className: string;
}) {
  return (
    <div role="group" aria-label={label} className={`lathe-tabs ${className}`}>
      {options.map((option) => (
        <button key={option} type="button" aria-pressed={value === option} onClick={() => onChange(option)}>
          {labels[option]}
        </button>
      ))}
    </div>
  );
}

const LatheModule: React.FC = () => {
  const { t } = useTranslation('lathe');
  // One view for every width: on a phone "Side by side" shows the form, so
  // crossing 1024 px keeps what the person was looking at.
  const [view, setView] = useState<LayoutMode>('split');
  const [step, setStep] = useState<{ index: number; id: string }>({ index: 0, id: 'intro' });
  const narrowView: 'form' | 'preview' = view === 'preview' ? 'preview' : 'form';
  const desktop = useMediaQuery('(min-width: 1024px)');
  const visibleView = desktop ? view : narrowView;
  // Same step, same state object: no re-render for a repeated report.
  const onStepChange = useCallback((index: number, id: string) => {
    setStep((prev) => (prev.index === index && prev.id === id ? prev : { index, id }));
  }, []);
  // Switching views: the layout changes at once and the panes are then
  // animated from where they were (FLIP, translate only, 200 ms, a sharp
  // curve). A pane that stays glides to its new place; a pane that appears
  // fades in with a short slide; a pane that goes disappears at once. No
  // view-transition snapshots: those stretched and clipped the panes and
  // rose above the cookie card during theme switches.
  const workRef = useRef<HTMLDivElement>(null);
  const before = useRef<Map<string, DOMRect | null> | null>(null);
  const measure = () => {
    const work = workRef.current;
    if (!work) return null;
    const rects = new Map<string, DOMRect | null>();
    for (const pane of work.querySelectorAll<HTMLElement>('.lathe-pane')) {
      rects.set(pane.dataset.pane ?? '', pane.offsetParent ? pane.getBoundingClientRect() : null);
    }
    return rects;
  };
  const switchTo = (next: LayoutMode) => {
    if (next === view) return;
    before.current = measure();
    setView(next);
  };
  const chooseWide = (next: LayoutMode) => switchTo(next);
  const chooseNarrow = (next: 'form' | 'preview') => {
    if (next === narrowView) return;
    switchTo(next === 'preview' ? 'preview' : 'split');
  };
  useLayoutEffect(() => {
    const old = before.current;
    before.current = null;
    const work = workRef.current;
    if (!old || !work) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      || document.documentElement.classList.contains('reduce-motion');
    if (reduced) return;
    const easing = 'cubic-bezier(0.2, 0, 0, 1)';
    const panes = [...work.querySelectorAll<HTMLElement>('.lathe-pane')].filter((pane) => pane.offsetParent);
    const moves = panes.map((pane) => {
      const was = old.get(pane.dataset.pane ?? '');
      return { pane, dx: was ? was.left - pane.getBoundingClientRect().left : null };
    });
    // An arriving pane waits until a moving one has passed its place, so the
    // two never overlap; with nothing moving it comes in at once.
    const someoneMoves = moves.some((m) => m.dx !== null && Math.abs(m.dx) > 1);
    for (const { pane, dx } of moves) {
      if (dx !== null) {
        if (Math.abs(dx) > 1) pane.animate([{ transform: `translateX(${dx}px)` }, { transform: 'none' }], { duration: 200, easing });
      } else {
        const from = pane.dataset.pane === 'preview' ? 12 : -12;
        pane.animate([{ opacity: 0, transform: `translateX(${from}px)` }, { opacity: 1, transform: 'none' }],
          { duration: someoneMoves ? 130 : 180, delay: someoneMoves ? 100 : 0, easing, fill: 'backwards' });
      }
    }
  }, [view]);

  // Register module UI into the universal shell (auto-cleanup on unmount)
  useModuleActions('lathe', { footerNote: <span>{t('footer.disclaimer')}</span> }, [t]);

  const labels: Record<LayoutMode, string> = {
    form: t('nav.form'),
    split: t('layout.split'),
    preview: t('nav.preview'),
  };

  return (
    <FormProvider>
      {/* The module band on entry; from the first question on it folds to a
          strip so the work moves up (ModuleBand). On a desktop the band and
          the workspace share one viewport-height frame. */}
      <div className="lathe-shell" data-module="lathe">
      <ModuleBand
        module="lathe"
        name="Lathe"
        line={t('app.subtitle')}
        compact={step.index > 0}
        crumbsLabel={t('a11y:breadcrumb')}
        crumbs={[{ href: '/', label: 'SNTIQ' }, { href: '/#projects', label: 'Deutschland Together' }]}
      />
      {/* Same horizontal frame as the site header: padding outside the max-width box. */}
      <div className="lathe-page px-4 sm:px-6 lg:px-8">
        <div className="lathe-frame max-w-screen-xl mx-auto w-full">
          <div className="lathe-nav">
            <ViewSwitch<LayoutMode>
              className="lathe-tabsWide"
              options={['form', 'split', 'preview'] as const}
              value={view}
              onChange={chooseWide}
              label={t('layout.label')}
              labels={labels}
            />
            <ViewSwitch<'form' | 'preview'>
              className="lathe-tabsNarrow"
              options={['form', 'preview'] as const}
              value={narrowView}
              onChange={chooseNarrow}
              label={t('layout.label')}
              labels={labels}
            />
          </div>

          {/* Opt-in local draft (device-local, default off) */}
          <DraftBar />

          <div ref={workRef} className="lathe-work" data-mode={view} data-tab={narrowView}>
            <SplitPanes
              id="lathe-form-preview"
              mode={visibleView === 'split' ? 'split' : visibleView === 'form' ? 'first' : 'second'}
              label={t('layout.resize')}
              defaultSize="50%" minSize="32%" secondMinSize="32%"
              className="lathe-split"
              firstClassName="lathe-paneSlot" secondClassName="lathe-paneSlot"
              first={
                <section aria-label={t('nav.form')} className="lathe-pane lathe-formPane" data-pane="form">
                  <Questionnaire onStepChange={onStepChange} />
                </section>
              }
              second={
                <section aria-label={t('nav.preview')} className="lathe-pane lathe-previewPane" data-pane="preview">
                  <PdfViewer followPage={previewPageFor(step.id)} followKey={step.id} />
                </section>
              }
            />
          </div>
        </div>
      </div>
      </div>
    </FormProvider>
  );
};

export default LatheModule;
