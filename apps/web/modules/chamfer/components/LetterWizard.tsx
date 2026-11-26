'use client';

/**
 * Step 3 — one letter end to end:
 *
 *   interstitial (if the letter declares one) → recipient resolution →
 *   profile + letter fields + follow-up questions → confirmations →
 *   gate verdict → preview (compose).
 *
 * The compose form NEVER renders while a blocker is active
 * (engine/gating.ts) — correctness first: a premature lawsuit or a
 * Widerspruch in a direct-Klage Land harms the user.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AlertTriangle, Loader2, X, OctagonAlert, ArrowLeft, ChevronRight } from 'lucide-react';
import { letterById, type LetterField } from '../data/letters';
import {
  hasPostalAddress, manualAuthority, resolveRecipient, type AuthorityCard, type Caveat,
  type RecipientResolution,
} from '../data/recipients';
import { evaluateGate } from '../engine/gating';
import type { Answers, ChoiceId, FlagId } from '../engine/logic';
import { isMonthOnly, profileComplete, requiredFieldsComplete, suggestMahnungDeadlineISO, todayISO } from '../engine/logic';
import { useWizard, type LetterDraft } from './WizardContext';
import RecipientCard, { CaveatList } from './RecipientCard';
import { GermanDateInput, IsoDateInput, LatinTextInput } from './inputs';
import LetterPreview from './LetterPreview';
import { useStageTop } from './useStageTop';
import s from '../chamfer.module.css';
import '../i18n/register';

const DATE_FIELDS: ReadonlySet<LetterField> = new Set([
  'applicationDate', 'oralRefusalDate', 'mahnungDeadline', 'bescheidDate',
  'authorityLetterDate', 'inquiryDate', 'fiktionExpiry', 'notificationDate',
]);

/** optional fields that only make sense for certain answers */
const OPTIONAL_VISIBLE: Partial<Record<LetterField, (a: Answers) => boolean>> = {
  inquiryDate: (a) => a.flags.priorInquirySent === true,
  fiktionExpiry: (a) => a.choices.fiktionSituation === 'expired',
};

const PROFILE_FIELDS = [
  ['name', 'text'], ['surname', 'text'], ['dob', 'dob'],
  ['street', 'text'], ['plzCity', 'text'],
] as const;

const LetterWizard: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const {
    letterId, place, placeSkip, remedy, answers, setAnswers, profile,
    setProfile, handFill, setHandFill, closeLetter, letterDraft, setLetterDraft,
  } = useWizard();

  const letter = letterId ? letterById(letterId) : undefined;

  const [interstitialOk, setInterstitialOk] = useState(false);
  const [resolution, setResolution] = useState<RecipientResolution | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveFailed, setResolveFailed] = useState(false);
  const [abhName, setAbhName] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { ort, manualMode, manName, manAddr, manFax,
    approxApp, userAnlagen, subKind } = letterDraft;
  const translationCosts = letter?.id === 'translation_costs';
  const regime = answers.choices.benefitRegime;
  const regimeChosen = regime === 'asylblg' || regime === 'sgb2';
  const recipientConfirmed = !translationCosts || (regimeChosen &&
    (!manualMode || letterDraft.manualBenefitRegime === regime));
  const pickedRecipient = recipientConfirmed ? letterDraft.pickedRecipient : null;
  const setDraftField = <K extends keyof LetterDraft>(key: K, value: LetterDraft[K]) =>
    setLetterDraft(prev => ({ ...prev, [key]: value }));
  const setPickedRecipient = (value: AuthorityCard | null) => setDraftField('pickedRecipient', value);
  const setOrt = (value: string) => setDraftField('ort', value);
  const setManualMode = (value: boolean) => setDraftField('manualMode', value);
  const setManName = (value: string) => setDraftField('manName', value);
  const setManAddr = (value: string) => setDraftField('manAddr', value);
  const setManFax = (value: string) => setDraftField('manFax', value);
  const setApproxApp = (value: boolean) => setDraftField('approxApp', value);
  const setUserAnlagen = (value: string) => setDraftField('userAnlagen', value);
  const setSubKind = (value: LetterDraft['subKind']) => setDraftField('subKind', value);

  // ------------------------------------------- recipient resolution
  useEffect(() => {
    if (!letter) return;
    if (manualMode || (translationCosts && !regimeChosen)) { setResolving(false); return; }
    let kind = letter.recipient === 'any_authority'
      ? subKind : letter.recipient;
    // translation_costs follows the benefit regime the letter cites
    // (engine/compose.ts): § 21 Abs. 6 SGB II is a Jobcenter claim,
    // § 6 Abs. 1 AsylbLG one against the AsylbLG office / Sozialamt
    if (letter.id === 'translation_costs' &&
        answers.choices.benefitRegime === 'sgb2') {
      kind = 'jobcenter';
    }
    if (!kind) return; // any_authority: waiting for the user's pick
    // BAMF is a static address — it works without a chosen place
    if (kind !== 'bamf' && !place) return;
    const ctl = new AbortController();
    const locality = ort ?? place?.name;
    const recipientKey = JSON.stringify([letter.id, kind, place?.ags, place?.plz, locality]);
    setResolving(true);
    setResolveFailed(false);
    setResolution(null);
    setLetterDraft(prev => prev.recipientKey === recipientKey ? prev : { ...prev, recipientKey, pickedRecipient: null });
    resolveRecipient(kind,
                     { ags: place?.ags ?? '', plz: place?.plz ?? '', ort: locality },
                     ctl.signal)
      .then((r) => {
        if (ctl.signal.aborted) return;
        setResolution(r);
        setLetterDraft(prev => prev.recipientKey !== recipientKey ? prev : { ...prev,
          pickedRecipient: r.candidates.find(c => c.id === prev.pickedRecipient?.id) ?? r.recipient ?? null });
      })
      .catch((e) => {
        if (!ctl.signal.aborted && (e as Error).name !== 'AbortError') setResolveFailed(true);
      })
      .finally(() => { if (!ctl.signal.aborted) setResolving(false); });
    // the ABH name is needed in escalation letters even when the
    // recipient is the supervisory authority or the court
    if (letter.recipient !== 'auslaenderbehoerde' && place) {
      resolveRecipient('auslaenderbehoerde',
                       { ags: place.ags, plz: place.plz }, ctl.signal)
        .then((r) => { if (!ctl.signal.aborted) setAbhName(r.recipient?.name ?? null); })
        .catch(() => {});
    }
    return () => ctl.abort();
  }, [letter, place, ort, subKind, answers.choices.benefitRegime, manualMode, translationCosts, regimeChosen, setLetterDraft]);

  // suggested Fristsetzung: prefill once, user can change
  useEffect(() => {
    if (letter?.id === 'mahnung_fristsetzung' &&
        !answers.fields.mahnungDeadline) {
      setAnswers((a) => ({
        ...a,
        fields: { ...a.fields, mahnungDeadline: suggestMahnungDeadlineISO() },
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [letter?.id]);

  const gate = useMemo(
    () => (letter ? evaluateGate(letter, answers, remedy, new Date(), manualMode ? '' : remedy.land) : null),
    [letter, answers, remedy, manualMode],
  );
  // form ↔ preview ↔ interstitial each open at their top
  const top = useStageTop(`${showPreview}:${interstitialOk}`);

  // place may be null (skipped step) — manual recipient entry covers it
  if (!letter || !gate) return null;

  // ------------------------------------------------------- helpers
  const setField = (f: LetterField, v: string) =>
    setAnswers((a) => ({ ...a, fields: { ...a.fields, [f]: v } }));
  const setFlag = (id: FlagId, v: boolean) =>
    setAnswers((a) => ({ ...a, flags: { ...a.flags, [id]: v } }));
  const setChoice = (id: ChoiceId, v: string) => {
    if (id === 'benefitRegime' && regime !== v) {
      setResolution(null);
      setLetterDraft(prev => ({ ...prev, pickedRecipient: null, recipientKey: null }));
    }
    setAnswers((a) => ({ ...a, choices: { ...a.choices, [id]: v } }));
  };
  const setConfirm = (id: string, v: boolean) =>
    setAnswers((a) => ({
      ...a, confirmations: { ...a.confirmations, [id]: v },
    }));

  const requiredFilled =
    requiredFieldsComplete(letter.fields, answers.fields, DATE_FIELDS) &&
    (handFill || profileComplete(profile));

  const manualReady = manName.trim() !== '' && manAddr.trim() !== '';
  const applyManual = () => setLetterDraft(prev => ({ ...prev, manualMode: true,
    manualBenefitRegime: translationCosts ? regime : undefined,
    pickedRecipient: manualAuthority(manName, manAddr.split('\n'), manFax) }));
  const postalReady = pickedRecipient && hasPostalAddress(pickedRecipient);
  const completePostalAddress = () => {
    if (!pickedRecipient) return;
    setLetterDraft(prev => ({ ...prev, manualMode: true, pickedRecipient: null,
      manName: pickedRecipient.name, manAddr: '', manFax: pickedRecipient.fax ?? '' }));
  };
  const anyKindPending =
    letter.recipient === 'any_authority' && !subKind && !pickedRecipient;
  const emptyResolution = Boolean(
    resolution && !resolution.recipient &&
    resolution.candidates.length === 0 && !resolution.ortOptions);
  const needsManual = !pickedRecipient && letter.recipient !== 'bamf' &&
    (!translationCosts || regimeChosen) && (manualMode || !place || resolveFailed || emptyResolution);

  const blockers = gate.issues.filter((i) => i.kind === 'blocker');
  const stopBlockers = blockers.filter((i) => i.stop);
  const warnings = gate.issues.filter((i) => i.kind === 'warning');
  const caveats: Caveat[] = resolution?.caveats ?? [];

  const backButton = (
    <button
      type="button"
      className={s.back}
      onClick={() => (showPreview ? setShowPreview(false) : closeLetter())}
    >
      <ArrowLeft aria-hidden="true" className="sntiq-inline-icon" />
      <span>{showPreview ? t('common.edit') : t('common.back')}</span>
    </button>
  );

  // ---------------------------------------------------- interstitial
  if (gate.interstitialKey && !interstitialOk) {
    return (
      <div ref={top} className={s.stage}>
        <div className={s.side}>
          {backButton}
          <p className={s.tone} data-tone="warn">
            {t(letter.titleKey)}
          </p>
          <h2 className={s.h2}>{t(`${gate.interstitialKey}.title`)}</h2>
        </div>
        <div className={s.main}>
          <p className={s.text} style={{ whiteSpace: 'pre-line' }}>
            {t(`${gate.interstitialKey}.body`)}
          </p>
          <div className={s.actions}>
            <button
              type="button"
              data-sb="interstitial-accept"
              className="sntiq-btn sntiq-btn-primary"
              onClick={() => setInterstitialOk(true)}
            >
              {t('interstitials.accept')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // -------------------------------------------------------- preview
  if (showPreview && pickedRecipient && postalReady) {
    return (
      <div ref={top} className={s.flow}>
        <LetterPreview
          letter={letter}
          recipient={pickedRecipient}
          userAttachments={userAnlagen.split('\n')}
          head={<>{backButton}<h2 className={s.h2}>{t(letter.titleKey)}</h2></>}
          regardingAuthority={
            letter.recipient === 'auslaenderbehoerde'
              ? undefined
              : abhName ?? (place
                  ? `Ausländerbehörde ${place.name}`
                  : 'zuständige Ausländerbehörde')
          }
        />
      </div>
    );
  }

  // ----------------------------------------------------------- form
  const required = <abbr>*</abbr>;
  const optionalMark = <em> · {t('common.optional')}</em>;

  return (
    <div ref={top} className={s.stage}>
      <div className={s.side}>
        {backButton}
        <h2 className={s.h2}>{t(letter.titleKey)}</h2>
        <p className={s.lead}>{t(letter.descriptionKey)}</p>
      </div>

      <div className={s.main}>
        {/* recipient */}
        <section className={s.section}>
          <h3 className={s.h3}>{t('recipient.title')}</h3>
          {resolving && (
            <p className={s.status} role="status">
              <Loader2 aria-hidden="true" className={s.spin} />
              {t('recipient.loading')}
            </p>
          )}
          {resolveFailed && !pickedRecipient && (
            <div className={s.notice} data-tone="bad" role="alert">
              <AlertTriangle aria-hidden="true" />
              <p>{t('recipient.error')}</p>
            </div>
          )}

          {/* any_authority: which office should receive this? */}
          {anyKindPending && place && !manualMode && (
            <>
              <p className={s.label}>{t('recipient.pickKind')}</p>
              <div className={s.rows}>
                <button type="button" className="sntiq-radio-card"
                        onClick={() => setSubKind('auslaenderbehoerde')}>
                  <span className={s.rowBody}>{t('recipient.kind.abh')}</span>
                  <ChevronRight aria-hidden="true" className={s.arrow} />
                </button>
                <button type="button" className="sntiq-radio-card"
                        onClick={() => setSubKind('asylblg_traeger')}>
                  <span className={s.rowBody}>{t('recipient.kind.sozialamt')}</span>
                  <ChevronRight aria-hidden="true" className={s.arrow} />
                </button>
                <button type="button" className="sntiq-radio-card"
                        onClick={() => setManualMode(true)}>
                  <span className={s.rowBody}>{t('recipient.enterManually')}</span>
                  <ChevronRight aria-hidden="true" className={s.arrow} />
                </button>
              </div>
            </>
          )}

          {/* manual recipient entry: place skipped or resolver down */}
          {needsManual && !manualMode && (
            <div className={s.rows}>
              <button
                type="button"
                className="sntiq-radio-card"
                onClick={() => setManualMode(true)}
              >
                <span className={s.rowBody}>{t('recipient.enterManually')}</span>
                <ChevronRight aria-hidden="true" className={s.arrow} />
              </button>
            </div>
          )}
          {needsManual && manualMode && (
            <div>
              <p className={s.label} style={{ marginBottom: '.875rem' }}>{t('recipient.manualTitle')}</p>
              {translationCosts && (
                <p className={s.hint}>{t('recipient.confirmRegime', { regime: t(`q.benefitRegime.${regime}`) })}</p>
              )}
              <div className={s.field}>
                <label htmlFor="chamfer-man-name">{t('recipient.manualName')}{required}</label>
                <input id="chamfer-man-name" type="text" className="sntiq-field"
                       value={manName}
                       onChange={(e) => setManName(e.target.value)} />
              </div>
              <div className={s.field}>
                <label htmlFor="chamfer-man-addr">{t('recipient.manualAddress')}{required}</label>
                <textarea id="chamfer-man-addr" rows={3} className="sntiq-field"
                          value={manAddr}
                          onChange={(e) => setManAddr(e.target.value)} />
              </div>
              <div className={s.field}>
                <label htmlFor="chamfer-man-fax">{t('recipient.manualFax')}{optionalMark}</label>
                <input id="chamfer-man-fax" type="text" className="sntiq-field"
                       value={manFax}
                       onChange={(e) => setManFax(e.target.value)} />
              </div>
              <button
                type="button"
                className="sntiq-btn"
                disabled={!manualReady}
                onClick={applyManual}
              >
                {t('common.next')}
              </button>
              <p className={s.hint}>{t('recipient.manualNote')}</p>
            </div>
          )}
          {resolution?.ortOptions && (
            <>
              <p className={s.label}>{t('recipient.pickOrt')}</p>
              <div className={s.rows}>
                {resolution.ortOptions.map((o) => (
                  <button key={o.ortk} type="button" className="sntiq-radio-card"
                          onClick={() => setOrt(o.ort)}>
                    <span className={s.rowBody}>{o.ort}</span>
                    <ChevronRight aria-hidden="true" className={s.arrow} />
                  </button>
                ))}
              </div>
            </>
          )}
          {resolution && resolution.candidates.length > 0 && !pickedRecipient && (
            <>
              <p className={s.label}>{t('recipient.pickOffice')}</p>
              <div className={s.rows}>
                {resolution.candidates.map((c) => (
                  <button key={c.id} type="button" className="sntiq-radio-card"
                          onClick={() => setPickedRecipient(c)}>
                    <span className={s.rowBody} lang="de">
                      <b>{c.name}</b>
                      <small>{[c.street, c.plz, c.city].filter(Boolean).join(', ')}</small>
                    </span>
                    <ChevronRight aria-hidden="true" className={s.arrow} />
                  </button>
                ))}
              </div>
            </>
          )}
          {pickedRecipient && <RecipientCard authority={pickedRecipient} />}
          {pickedRecipient && !postalReady && (
            <div>
              <p className={s.hint}>{t('recipient.incompletePostal')}</p>
              <button type="button" className={s.linkBtn} onClick={completePostalAddress}>
                {t('recipient.completePostal')}
              </button>
            </div>
          )}
          {pickedRecipient && manualMode && postalReady && (
            <button type="button" className={s.linkBtn} onClick={() => setPickedRecipient(null)}>
              {t('recipient.edit')}
            </button>
          )}
          {(resolution?.supervisory?.length ?? 0) > 0 &&
            letter.recipient !== 'aufsichtsbehoerde' && (
            <div style={{ marginTop: '1.25rem' }}>
              <p className={s.label}>{t('recipient.supervisoryTitle')}</p>
              {resolution!.supervisory!.map((a) => (
                <p key={a.id} className={s.text} style={{ fontSize: '.9375rem' }}>
                  <span lang="de">{a.name}</span>
                  {a.fax ? ` · ${t('channels.fax')} ${a.fax}` : ''}
                  {a.email ? ` · ${a.email}` : ''}
                </p>
              ))}
              <p className={s.hint}>{t('recipient.supervisoryNote')}</p>
            </div>
          )}
          <CaveatList caveats={caveats} />
        </section>

        {/* blockers stop everything below */}
        {(blockers.length > 0 || warnings.length > 0) && (
          <div className={s.section}>
            {blockers.map((b, i) => (
              <div key={`b${i}`} className={s.notice} data-tone="bad">
                <OctagonAlert aria-hidden="true" />
                <p>{t(b.key, b.params)}</p>
              </div>
            ))}
            {warnings.map((w, i) => (
              <div key={`w${i}`} className={s.notice} data-tone="warn">
                <AlertTriangle aria-hidden="true" />
                <p>{t(w.key, w.params)}</p>
              </div>
            ))}
          </div>
        )}

        {/* follow-up questions (they may resolve blockers, keep visible) */}
        {(letter.questions ?? []).map((q) => {
          if (q.kind === 'choice') {
            return (
              <div key={q.id} className={s.section} role="radiogroup"
                   aria-labelledby={`chamfer-q-${q.id}`}>
                <p id={`chamfer-q-${q.id}`} className={s.h3}>{t(q.labelKey)}</p>
                <div className={s.rows}>
                  {q.options.map((o) => (
                    <label key={o.value} className="sntiq-radio-card"
                           data-checked={answers.choices[q.id as ChoiceId] === o.value}>
                      <input
                        type="radio"
                        className="sntiq-radio"
                        name={q.id}
                        checked={answers.choices[q.id as ChoiceId] === o.value}
                        onChange={() => setChoice(q.id as ChoiceId, o.value)}
                      />
                      <span>{t(o.labelKey)}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          }
          return (
            <div key={q.id} className={s.section}>
              <label className={s.check}
                     data-checked={answers.flags[q.id as FlagId] === true}>
                <input
                  type="checkbox"
                  className="sntiq-check"
                  checked={answers.flags[q.id as FlagId] === true}
                  onChange={(e) => setFlag(q.id as FlagId, e.target.checked)}
                />
                <span>{t(q.labelKey)}</span>
              </label>
            </div>
          );
        })}

        {stopBlockers.length === 0 && (
          <>
            {/* profile */}
            <section className={s.section}>
              <h3 className={s.h3}>{t('profile.title')}</h3>
              <label className={s.check} data-checked={handFill}>
                <input
                  type="checkbox"
                  className="sntiq-check"
                  data-sb="handfill"
                  checked={handFill}
                  onChange={(e) => setHandFill(e.target.checked)}
                />
                <span>{t('profile.handFill')}</span>
              </label>
              {handFill ? (
                <p className={s.hint}>{t('profile.handFillNote')}</p>
              ) : (
                <div className={s.fields} style={{ marginTop: '.75rem' }}>
                  {PROFILE_FIELDS.map(([key, kind]) => (
                    <div key={key} className={s.field}>
                      <label htmlFor={`chamfer-p-${key}`}>{t(`profile.${key}`)}{required}</label>
                      <div>
                        {kind === 'dob' ? (
                          <GermanDateInput
                            id={`chamfer-p-${key}`}
                            value={profile[key]}
                            max={todayISO()}
                            onChange={(v) =>
                              setProfile((p) => ({ ...p, [key]: v }))}
                          />
                        ) : (
                          <LatinTextInput
                            id={`chamfer-p-${key}`}
                            value={profile[key]}
                            onChange={(v) =>
                              setProfile((p) => ({ ...p, [key]: v }))}
                          />
                        )}
                      </div>
                      <div></div>
                    </div>
                  ))}
                </div>
              )}
            </section>

            {/* co-applicants (family) */}
            <CoApplicantsEditor />

            {/* letter fields */}
            <section className={s.section}>
              <h3 className={s.h3}>{t('letter.fieldsTitle')}</h3>
              <div className={s.fields}>
                {[...letter.fields, ...(letter.optionalFields ?? [])].map((f) => {
                  const optional = !letter.fields.includes(f);
                  const visible = OPTIONAL_VISIBLE[f];
                  if (optional && visible && !visible(answers)) return null;
                  const monthMode = f === 'applicationDate' &&
                    (approxApp || isMonthOnly(answers.fields[f]));
                  const hint = t(`fields.${f}Hint`, { defaultValue: '' });
                  return (
                    <div key={f} className={s.field}>
                      <label htmlFor={`chamfer-f-${f}`}>
                        {t(`fields.${f}`)}
                        {!optional ? required : optionalMark}
                      </label>
                      <div>
                        {DATE_FIELDS.has(f) && !monthMode ? (
                          <IsoDateInput
                            id={`chamfer-f-${f}`}
                            value={answers.fields[f] ?? ''}
                            onChange={(v) => setField(f, v)}
                          />
                        ) : (
                          <input
                            id={`chamfer-f-${f}`}
                            type={monthMode ? 'month' : 'text'}
                            className="sntiq-field"
                            value={answers.fields[f] ?? ''}
                            onChange={(e) => setField(f, e.target.value)}
                          />
                        )}
                      </div>
                      <div>
                        {hint !== '' && <p className={s.hint}>{hint}</p>}
                        {f === 'applicationDate' && (
                          <label className={s.check}>
                            <input
                              type="checkbox"
                  className="sntiq-check"
                              data-sb="approx"
                              checked={monthMode}
                              onChange={(e) => {
                                setApproxApp(e.target.checked);
                                setField(f, '');
                              }}
                            />
                            <span>{t('fields.approxToggle')}</span>
                          </label>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* optional Anlagen */}
                <div className={`${s.field} ${s.wide}`}>
                  <label htmlFor="chamfer-anlagen">{t('fields.anlagen')}{optionalMark}</label>
                  <div>
                    <textarea
                      id="chamfer-anlagen"
                      rows={2}
                      className="sntiq-field"
                      placeholder={t('fields.anlagenPlaceholder')}
                      value={userAnlagen}
                      onChange={(e) => setUserAnlagen(e.target.value)}
                    />
                  </div>
                  <p className={s.hint}>{t('fields.anlagenHint')}</p>
                </div>
              </div>
            </section>

            {/* confirmations */}
            {(letter.gate?.confirmations ?? []).length > 0 && (
              <section className={s.section}>
                <h3 className={s.h3}>{t('gate.confirmTitle')}</h3>
                <div className={s.rows}>
                  {(letter.gate?.confirmations ?? []).map((c) => (
                    <label key={c} className="sntiq-radio-card"
                           data-checked={answers.confirmations[c] === true}>
                      <input
                        type="checkbox"
                  className="sntiq-check"
                        checked={answers.confirmations[c] === true}
                        onChange={(e) => setConfirm(c, e.target.checked)}
                      />
                      <span>{t(`gate.confirm.${c}`)}</span>
                    </label>
                  ))}
                </div>
              </section>
            )}

            <div className={s.actions}>
              <button
                type="button"
                data-sb="preview"
                className="sntiq-btn sntiq-btn-primary"
                disabled={!gate.allowed || !requiredFilled || !postalReady
                  || (!manualMode && (resolving || resolveFailed || !resolution))}
                onClick={() => setShowPreview(true)}
              >
                {t('letter.previewButton')}
              </button>
              {!requiredFilled && <p className={s.small}>{t('letter.fillAll')}</p>}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

const RELATIONS = ['partner', 'husband', 'wife', 'son', 'daughter',
                   'other'] as const;

/** family members co-signing: name + relation; main applicant stays
 *  the profile person */
const CoApplicantsEditor: React.FC = () => {
  const { t } = useTranslation('chamfer');
  const { coApplicants, setCoApplicants } = useWizard();
  return (
    <section className={s.section}>
      <h3 className={s.h3}>{t('profile.coTitle')}</h3>
      {coApplicants.map((c, i) => (
        <div key={i} className={s.person}>
          <div>
            <LatinTextInput
              id={`chamfer-co-${i}`}
              value={c.name}
              placeholder={t('profile.coName')}
              ariaLabel={t('profile.coName')}
              onChange={(v) => setCoApplicants((list) =>
                list.map((x, j) => (j === i ? { ...x, name: v } : x)))}
            />
          </div>
          <select
            className="sntiq-field"
            aria-label={t('profile.coRelation')}
            value={c.relation}
            onChange={(e) => setCoApplicants((list) =>
              list.map((x, j) =>
                (j === i ? { ...x, relation: e.target.value } : x)))}
          >
            {RELATIONS.map((r) => (
              <option key={r} value={r}>{t(`profile.relations.${r}`)}</option>
            ))}
          </select>
          <button
            type="button"
            aria-label={t('profile.coRemove')}
            title={t('profile.coRemove')}
            className={s.iconBtn}
            onClick={() => setCoApplicants((list) =>
              list.filter((_, j) => j !== i))}
          >
            <X aria-hidden="true" />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="sntiq-btn"
        onClick={() => setCoApplicants((list) =>
          [...list, { name: '', relation: 'partner' }])}
      >
        <span aria-hidden="true">+</span>
        <span>{t('profile.coAdd')}</span>
      </button>
    </section>
  );
};

export default LetterWizard;
