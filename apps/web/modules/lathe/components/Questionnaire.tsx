'use client';

import React, { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, TriangleAlert, X, ArrowLeft, ArrowRight } from 'lucide-react';
import { STEPS } from '../wizard';
import { useForm } from './FormContext';
import StepView from './Step';
import { buildZp1aOperations } from '../engine/mapping';
import { IncomeType } from '../types';
import { getStepErrors } from '../formValidation';
import '../i18n/register';

const PDF_URL = '/dt/lathe/forms/zp1a.pdf';

/** `onStepChange` reports the visible step (0 = welcome) and its id, e.g. to
    fold the module band and turn the preview to the step's page. */
const Questionnaire: React.FC<{ onStepChange?: (index: number, id: string) => void }> = ({ onStepChange } = {}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const { data } = useForm();
  const { t } = useTranslation('lathe');
  const [generating, setGenerating] = useState(false);
  // non-fatal fillPdf warnings from the last generation — shown prominently:
  // the user must know the printed form is incomplete BEFORE submitting it
  const [fillWarnings, setFillWarnings] = useState<string[]>([]);

  const activeSteps = useMemo(
    () => STEPS.filter((step) => !step.condition || step.condition(data)),
    [data]
  );

  const safeIndex = Math.min(currentStepIndex, activeSteps.length - 1);
  // Steps can also come and go with the answers (conditions); report those
  // too. Only a real change is reported: the callback sits in a ref, so a
  // parent passing a new function on every render does not get called again
  // (that fed a render loop).
  const onStepChangeRef = useRef(onStepChange);
  onStepChangeRef.current = onStepChange;
  const reportedId = activeSteps[Math.max(0, safeIndex)]?.id;
  useEffect(() => {
    if (reportedId) onStepChangeRef.current?.(Math.max(0, safeIndex), reportedId);
  }, [safeIndex, reportedId]);

  // One press, one step: a double click or double tap on Next must not run
  // the check of the step it has just opened (which would flood it with
  // errors the person has not caused), nor skip a step without fields.
  const lastMove = useRef(Number.NEGATIVE_INFINITY);
  const goTo = (index: number) => {
    lastMove.current = performance.now();
    setCurrentStepIndex(index);
    // Reported in the same update as the step itself, so the module band
    // folds in the same render and the scroll below measures the final page.
    if (activeSteps[index]) onStepChangeRef.current?.(index, activeSteps[index].id);
  };
  const tooSoon = () => performance.now() - lastMove.current < 450;
  const currentStep = activeSteps[safeIndex];
  const isLastStep = safeIndex === activeSteps.length - 1;
  const isFirstStep = safeIndex === 0;

  const invalidSteps = activeSteps.flatMap((step, index) =>
    Object.keys(getStepErrors(step, data)).length ? [index] : []);
  const isValid = Boolean(currentStep) && !invalidSteps.includes(safeIndex);
  const canDownload = invalidSteps.length === 0;

  // Which errors are SHOWN (never what is valid): the fields the user has
  // left, and the steps on which Next was pressed while something was missing.
  const [touched, setTouched] = useState<ReadonlySet<string>>(() => new Set());
  const [attempted, setAttempted] = useState<ReadonlySet<string>>(() => new Set());
  const [focusRequest, setFocusRequest] = useState<{ fieldId: string } | null>(null);
  const touch = (fieldId: string) =>
    setTouched((prev) => (prev.has(fieldId) ? prev : new Set(prev).add(fieldId)));
  const markAttempted = (stepId: string) =>
    setAttempted((prev) => (prev.has(stepId) ? prev : new Set(prev).add(stepId)));

  // Next is blocked on an invalid step exactly as before. The button is no
  // longer a dead, disabled control though: pressing it shows what is
  // missing and moves the focus to the first such field.
  const handleNext = () => {
    if (isLastStep || !currentStep || tooSoon()) return;
    if (isValid) {
      goTo(safeIndex + 1);
      return;
    }
    markAttempted(currentStep.id);
    const fieldId = Object.keys(getStepErrors(currentStep, data))[0];
    if (fieldId) setFocusRequest({ fieldId });
  };
  const handleBack = () => {
    if (!isFirstStep && !tooSoon()) goTo(safeIndex - 1);
  };

  // A new step starts at its top: reset the sheet's own scroll (desktop) and,
  // where the sheet sits in normal page flow (phone), bring its top back
  // below the fixed site header.
  const sheetRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const shownStep = useRef<string | undefined>(undefined);
  const stepId = currentStep?.id;
  // Before paint: the old step's scroll position never shows (no flash of
  // the footer when a long step gives way to a short one), and the band has
  // already folded, so the measured top is the final one. Instant, not the
  // page's smooth scrolling. Focus moves to the new step's heading, so the
  // keyboard continues at its first field and screen readers announce it.
  useLayoutEffect(() => {
    const previous = shownStep.current;
    shownStep.current = stepId;
    if (previous === undefined || previous === stepId) return;
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
    if (window.matchMedia('(min-width: 1024px)').matches) {
      // Desktop: the workspace is one screen tall; back to its top, so the
      // band, the view tabs and the draft line stay in view.
      if (window.scrollY > 0) window.scrollTo({ top: 0, behavior: 'instant' });
    } else {
      // Phone: the sheet is in the page flow; bring its top below the header.
      const top = sheetRef.current?.getBoundingClientRect().top ?? 0;
      if (top < 72) window.scrollTo({ top: window.scrollY + top - 80, behavior: 'instant' });
    }
    sheetRef.current?.querySelector<HTMLElement>('.lathe-stepTitle')?.focus({ preventScroll: true });
  }, [stepId]);

  // After a blocked Next: focus the first field that needs attention (its
  // error text is announced through aria-describedby).
  useEffect(() => {
    if (!focusRequest || typeof document === 'undefined') return;
    const id = focusRequest.fieldId;
    // text controls carry the field id; a radio group carries it as the name
    const field = document.getElementById(id) ?? document.getElementsByName(id)[0];
    field?.focus();
  }, [focusRequest]);

  const handleDownload = async () => {
    if (!canDownload) return;
    setGenerating(true);
    try {
      const response = await fetch(PDF_URL);
      if (!response.ok) throw new Error(`PDF_FETCH_${response.status}`);
      const buffer = await response.arrayBuffer();

      // pdf-lib and fontkit (about 1.1 MB) load only for the download.
      const { fillPdf } = await import('../engine/fill');
      const { bytes, warnings } = await fillPdf(buffer, buildZp1aOperations(data));
      setFillWarnings(warnings);
      if (warnings.length) {
        // field names only — never user data
        console.warn('[SNTIQ:LATHE] PDF fill warnings:', warnings.join(', '));
      }

      const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);

      const clean = (value: string) =>
        (value || 'UNBEKANNT').toUpperCase().replace(/[^A-ZА-ЯЁЇІЄҐ0-9]/gi, '') || 'UNBEKANNT';
      link.download = `lathe_antrag_${clean(data.personal.lastName)}_${clean(
        data.personal.firstName
      )}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(link.href);
    } catch (e: any) {
      console.error(`[SNTIQ:LATHE] PDF generation failed. Code: ${e?.message ?? 'ERR-PDF'}`);
      alert(t('error.pdf_gen'));
    } finally {
      setGenerating(false);
    }
  };

  if (!currentStep)
    return <div className="lathe-placeholder">{t('nav.loading')}</div>;

  const showBenefitReminder =
    isLastStep && data.incomeType !== IncomeType.OTHER && data.incomeType !== null;

  // split the last generation's warnings by kind (see FillResult in fill.ts)
  const fontEmbedFailed = fillWarnings.includes('FONT_EMBED_FAILED');
  const glyphWarnFields = fillWarnings
    .filter((w) => w.startsWith('UNSUPPORTED_CHARS:'))
    .map((w) => w.slice('UNSUPPORTED_CHARS:'.length));
  const unmappedFields = fillWarnings.filter(
    (w) => w !== 'FONT_EMBED_FAILED' && !w.startsWith('UNSUPPORTED_CHARS:')
  );

  const progressText = `${t('progress.step')} ${safeIndex + 1} ${t('progress.of')} ${activeSteps.length}`;

  return (
    <div ref={sheetRef} className="flex flex-col h-full w-full min-h-0">
      {/* Progress: the step as text; the 2px track is the sheet's top rule */}
      <div className="lathe-paneHead">
        <p className="sntiq-kicker lathe-stepNo">{progressText}</p>
      </div>
      <div
        className="lathe-track"
        role="progressbar"
        aria-valuemin={1}
        aria-valuemax={activeSteps.length}
        aria-valuenow={safeIndex + 1}
        aria-valuetext={progressText}
      >
        <div className="lathe-fill" style={{ width: `${((safeIndex + 1) / activeSteps.length) * 100}%` }} />
      </div>

      {/* Content */}
      <div ref={bodyRef} className="lathe-paneBody">
        <div className="lathe-column">
          <StepView
            step={currentStep}
            touched={touched}
            attempted={attempted.has(currentStep.id)}
            onTouch={touch}
          />

          {isLastStep && !canDownload && (
            <div role="alert" className="lathe-note mt-6">
              <p className="lathe-status" data-tone="bad">
                <TriangleAlert aria-hidden="true" />
                <strong>{t('validation.review')}</strong>
              </p>
              <ul className="mt-1 ml-7">{invalidSteps.map(index => <li key={activeSteps[index].id}>
                <button type="button" className="sntiq-link min-h-11 text-left text-[0.9375rem] font-medium" onClick={() => { markAttempted(activeSteps[index].id); setCurrentStepIndex(index); }}>{t(activeSteps[index].title)}</button>
              </li>)}</ul>
            </div>
          )}

          {showBenefitReminder && (
            <div className="lathe-note mt-6">
              <p className="lathe-status" data-tone="warn">
                <TriangleAlert aria-hidden="true" />
                <span>{t('warning.benefit_notice')}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      {/* PDF fill warnings — kept directly above the navigation, outside the
          scrolling content, so they cannot be scrolled out of view; the
          download is never blocked, but the user must see which answers did
          not make it onto the printed form */}
      {fillWarnings.length > 0 && (
        <div role="alert" className="lathe-paneFoot lathe-warnings">
          <div className="lathe-status" data-tone="bad">
            <TriangleAlert aria-hidden="true" />
            <div className="flex-1 min-w-0 space-y-2">
              <p><strong>{t('warning.fill.title')}</strong></p>
              {fontEmbedFailed && <p>{t('warning.fill.font')}</p>}
              {glyphWarnFields.length > 0 && (
                <div>
                  {t('warning.fill.glyphs')}
                  <ul>
                    {glyphWarnFields.map((f, i) => (
                      <li key={`${f}-${i}`}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
              {unmappedFields.length > 0 && (
                <div>
                  {t('warning.fill.fields')}
                  <ul>
                    {unmappedFields.map((f, i) => (
                      <li key={`${f}-${i}`}>{f}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setFillWarnings([])}
              className="lathe-icon"
              aria-label={t('warning.fill.dismiss')}
              title={t('warning.fill.dismiss')}
            >
              <X aria-hidden="true" />
            </button>
          </div>
        </div>
      )}

      {/* Navigation — always the last row of the sheet */}
      <div className="lathe-paneFoot lathe-actions">
        <button
          type="button"
          onClick={handleBack}
          aria-label={t('nav.back')}
          disabled={isFirstStep}
          className="sntiq-btn"
        >
          <ArrowLeft className="w-4 h-4 shrink-0" aria-hidden="true" />
          {t('nav.back')}
        </button>

        {isLastStep ? (
          <button
            type="button"
            onClick={handleDownload}
            disabled={!canDownload || generating}
            className="sntiq-btn sntiq-btn-primary lathe-next"
          >
            <Download className="w-4 h-4 shrink-0" aria-hidden="true" />
            {generating ? t('nav.loading') : t('nav.download')}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleNext}
            className="sntiq-btn sntiq-btn-primary lathe-next"
          >
            {t('nav.next')}
            <ArrowRight className="w-4 h-4 shrink-0" aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
};

export default Questionnaire;
