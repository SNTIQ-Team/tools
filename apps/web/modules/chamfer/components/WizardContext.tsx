'use client';

/**
 * Wizard state for the Chamfer flow:
 *
 *   place → triage (decision tree) → letter (gates → form → preview)
 *
 * Everything lives in memory only — no localStorage, no cookies: the
 * letters carry personal data and the privacy story is "close the tab,
 * it's gone". The Taper place is the only thing kept across
 * letters in a session. Single exception: the strictly opt-in local
 * draft (DraftBar + core/useLocalDraft) — the user explicitly asks to
 * keep a snapshot on this device, and can delete it with one click.
 */

import React, {
  createContext, useCallback, useContext, useMemo, useState,
} from 'react';
import type { AuthorityCard, PlaceMatch } from '../data/recipients';
import type { LandRemedy } from '../data/remedies';
import { remedyFor } from '../data/remedies';
import type { Answers } from '../engine/logic';
import { emptyAnswers } from '../engine/logic';
import type { Profile } from '../engine/compose';
import { TREE_ROOT } from '../data/decision-tree';

export type WizardStep = 'place' | 'triage' | 'letter';

export interface ChosenPlace extends PlaceMatch {
  /** user's PLZ inside the Gemeinde (court resolution + letter head) */
  plz: string;
}

/** why the place step was skipped — drives manual-recipient mode */
export type PlaceSkipReason = 'not_found' | 'abroad' | 'other';

/** answer presets a decision-tree option may carry (TreeOption.preset) */
export interface AnswerPreset {
  choices?: Record<string, string>;
  flags?: Record<string, boolean>;
}

/** Editable per-letter data survives a draft restore; loading/preview state does not. */
export interface LetterDraft {
  pickedRecipient: AuthorityCard | null;
  recipientKey: string | null;
  ort?: string;
  manualMode: boolean;
  /** Regime for which the user last confirmed this manual translation-costs recipient. */
  manualBenefitRegime?: string;
  manName: string;
  manAddr: string;
  manFax: string;
  approxApp: boolean;
  userAnlagen: string;
  subKind: 'auslaenderbehoerde' | 'asylblg_traeger' | null;
  faxLine: boolean;
}

export const emptyLetterDraft = (): LetterDraft => ({
  pickedRecipient: null, recipientKey: null, manualMode: false,
  manName: '', manAddr: '', manFax: '', approxApp: false,
  userAnlagen: '', subKind: null, faxLine: true,
});

/** Serializable snapshot of the whole wizard — the opt-in local draft. */
export interface WizardSnapshot {
  step: WizardStep;
  place: ChosenPlace | null;
  placeSkip: PlaceSkipReason | null;
  treePath: string[];
  letterId: string | null;
  answers: Answers;
  profile: Profile;
  handFill: boolean;
  coApplicants: { name: string; relation: string }[];
  letterDraft: LetterDraft;
  prefill: AnswerPreset;
}

interface WizardState {
  letterDraft: LetterDraft;
  setLetterDraft: React.Dispatch<React.SetStateAction<LetterDraft>>;
  step: WizardStep;
  place: ChosenPlace | null;
  /** set when the user skipped the place step (with a reason) */
  placeSkip: PlaceSkipReason | null;
  remedy: LandRemedy;
  /** decision-tree path, last entry = current node id */
  treePath: string[];
  letterId: string | null;
  answers: Answers;
  profile: Profile;
  /** "fill in by hand later" — profile fields become blanks */
  handFill: boolean;
  /** family members co-signing letters (name + relation key) */
  coApplicants: { name: string; relation: string }[];
  setCoApplicants: React.Dispatch<
    React.SetStateAction<{ name: string; relation: string }[]>>;

  setPlace: (p: ChosenPlace) => void;
  skipPlace: (reason: PlaceSkipReason) => void;
  goToStep: (s: WizardStep) => void;
  treeAdvance: (next: string, preset?: AnswerPreset) => void;
  treeBack: () => void;
  openLetter: (id: string) => void;
  closeLetter: () => void;
  setAnswers: React.Dispatch<React.SetStateAction<Answers>>;
  setProfile: React.Dispatch<React.SetStateAction<Profile>>;
  setHandFill: (v: boolean) => void;

  /** current state as a plain-data snapshot (draft autosave source) */
  snapshot: WizardSnapshot;
  /** replace the whole wizard state from a validated snapshot */
  restoreSnapshot: (s: WizardSnapshot) => void;
}

const EMPTY_PROFILE: Profile = {
  name: '', surname: '', dob: '', street: '', plzCity: '',
};

/** Baseline snapshot — merge target for restored drafts, so fields
 *  added after a draft was saved keep their defaults. */
export const emptyWizardSnapshot = (): WizardSnapshot => ({
  step: 'place',
  place: null,
  placeSkip: null,
  treePath: [TREE_ROOT],
  letterId: null,
  answers: emptyAnswers(),
  profile: { ...EMPTY_PROFILE },
  handFill: false,
  coApplicants: [],
  letterDraft: emptyLetterDraft(),
  prefill: {},
});

const Ctx = createContext<WizardState | null>(null);

export const WizardProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [step, setStep] = useState<WizardStep>('place');
  const [place, setPlaceState] = useState<ChosenPlace | null>(null);
  const [placeSkip, setPlaceSkip] = useState<PlaceSkipReason | null>(null);
  const [treePath, setTreePath] = useState<string[]>([TREE_ROOT]);
  const [letterId, setLetterId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Answers>(emptyAnswers());
  const [profile, setProfile] = useState<Profile>(EMPTY_PROFILE);
  const [handFill, setHandFill] = useState(false);
  const [coApplicants, setCoApplicants] = useState<
    { name: string; relation: string }[]>([]);
  // answers pre-selected by decision-tree options, applied on openLetter
  const [prefill, setPrefill] = useState<AnswerPreset>({});
  const [letterDraft, setLetterDraft] = useState<LetterDraft>(emptyLetterDraft);

  const setPlace = useCallback((p: ChosenPlace) => {
    setPlaceState(p);
    setPlaceSkip(null);
    setProfile((prev) => ({
      ...prev,
      plzCity: prev.plzCity || `${p.plz} ${p.name}`,
    }));
    setStep('triage');
  }, []);

  const skipPlace = useCallback((reason: PlaceSkipReason) => {
    setPlaceState(null);
    setPlaceSkip(reason);
    setStep('triage');
  }, []);

  const goToStep = useCallback((s: WizardStep) => setStep(s), []);

  const treeAdvance = useCallback((next: string, preset?: AnswerPreset) => {
    if (preset) {
      setPrefill(prev => ({
        choices: { ...prev.choices, ...preset.choices },
        flags: { ...prev.flags, ...preset.flags },
      }));
    }
    setTreePath((p) => [...p, next]);
  }, []);
  const treeBack = useCallback(() => {
    // dropping presets on back-navigation keeps prefill consistent
    setPrefill({});
    setTreePath((p) => (p.length > 1 ? p.slice(0, -1) : p));
  }, []);

  const openLetter = useCallback((id: string) => {
    setLetterId(id);
    // per-letter answers start fresh (+ tree presets); profile persists
    const seeded = emptyAnswers();
    Object.assign(seeded.choices, prefill.choices);
    Object.assign(seeded.flags, prefill.flags);
    setAnswers(seeded);
    setLetterDraft(emptyLetterDraft());
    setStep('letter');
  }, [prefill]);

  const closeLetter = useCallback(() => {
    setLetterId(null);
    setStep('triage');
  }, []);

  const remedy = useMemo(
    () => remedyFor(place ? place.ags.slice(0, 2) : ''),
    [place],
  );

  const snapshot = useMemo<WizardSnapshot>(() => ({
    step, place, placeSkip, treePath, letterId, answers, profile,
    handFill, coApplicants, letterDraft, prefill,
  }), [step, place, placeSkip, treePath, letterId, answers, profile,
       handFill, coApplicants, letterDraft, prefill]);

  const restoreSnapshot = useCallback((s: WizardSnapshot) => {
    setStep(s.step);
    setPlaceState(s.place);
    setPlaceSkip(s.placeSkip);
    setTreePath(s.treePath.length > 0 ? s.treePath : [TREE_ROOT]);
    setLetterId(s.letterId);
    setAnswers(s.answers);
    setProfile(s.profile);
    setHandFill(s.handFill);
    setCoApplicants(s.coApplicants);
    setPrefill(s.prefill ?? {});
    setLetterDraft({ ...emptyLetterDraft(), ...s.letterDraft });
  }, []);

  const value = useMemo<WizardState>(() => ({
    step, place, placeSkip, remedy, treePath, letterId, answers, profile,
    handFill, coApplicants, setCoApplicants, letterDraft, setLetterDraft,
    setPlace, skipPlace, goToStep, treeAdvance, treeBack, openLetter,
    closeLetter, setAnswers, setProfile, setHandFill,
    snapshot, restoreSnapshot,
  }), [step, place, placeSkip, remedy, treePath, letterId, answers,
       profile, handFill, coApplicants, setPlace, skipPlace, goToStep,
       treeAdvance, treeBack, openLetter, closeLetter, snapshot,
       restoreSnapshot, letterDraft]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};

export function useWizard(): WizardState {
  const v = useContext(Ctx);
  if (!v) throw new Error('useWizard outside WizardProvider');
  return v;
}
