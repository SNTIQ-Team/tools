import { LatheFormData, IncomeType, WizardStep, IncomeRows, DeductionRows } from './types';
import { parseEuroDE } from './validation';

import { todayGerman } from '@/core/jurisdiction';
import { LATHE_JURISDICTION } from './jurisdiction';

const emptyIncome = (): IncomeRows => ({
  employment: '',
  selfEmployment: '',
  rental: '',
  capital: '',
  kindergeld: '',
  wohngeld: '',
  unterhalt: '',
  pension: '',
  alg: '',
  buergergeld: '',
  krankengeld: '',
  elterngeld: '',
  other1Label: '',
  other1Amount: '',
  other2Label: '',
  other2Amount: '',
});

const emptyDeductions = (): DeductionRows => ({
  taxes: '',
  socialSecurity: '',
  otherInsurance: '',
  commuting: '',
  workExpenses: '',
});

export const INITIAL_DATA: LatheFormData = {
  incomeType: null,
  useSgbXiiExemption: null,
  benefitAmount: '',
  personal: {
    courtInfo: '',
    firstName: '',
    lastName: '',
    birthName: '',
    occupation: '',
    birthDate: '',
    maritalStatus: '',
    address: '',
    phone: '',
    representative: '',
  },
  insurance: {
    hasInsurance: null,
    insuranceDetails: '',
    hasLegalInsurance: null,
    potentialInsuranceDetails: '',
  },
  maintenance: { hasClaim: null, opponentName: '' },
  hasDependents: null,
  dependents: [],
  financials: {
    income: emptyIncome(),
    partnerIncome: emptyIncome(),
    expectedChanges: '',
    deductions: emptyDeductions(),
    partnerDeductions: emptyDeductions(),

    livingSpace: '',
    roomCount: '',
    totalPeople: '',
    housingRole: null,
    rent: '',
    ownerLoan: '',
    heatingCosts: '',
    otherHousingCosts: '',
    totalHousingCosts: '',
    housingPaidAlone: '',

    hasObligations: null,
    obligations: [{ description: '', total: '', monthly: '', paidAlone: '' }],

    hasSpecialBurdens: null,
    specialBurdenDescription: '',
    specialBurdenCost: '',

    hasBank: null,
    bankAccount: '',
    bankBalance: '',
    hasRealEstate: null,
    realEstate: '',
    realEstateValue: '',
    hasVehicle: null,
    vehicle: '',
    vehicleValue: '',
    hasCash: null,
    cash: '',
    cashValue: '',
    hasLifeInsurance: null,
    lifeInsurance: '',
    lifeInsuranceValue: '',
    hasOtherAssets: null,
    otherAssets: '',
    otherAssetsValue: '',
  },
  // The date is filled in by createInitialData: never at module load, which
  // froze it at the moment the code was loaded (server or tab).
  declaration: { date: '', dateIsAuto: true, place: '', docCount: '0' },
};

/** Fresh answers with today's date in Berlin as the automatic signing date. */
export function createInitialData(now = new Date()): LatheFormData {
  const data = structuredClone(INITIAL_DATA);
  data.declaration.date = todayGerman(LATHE_JURISDICTION, now);
  data.declaration.dateIsAuto = true;
  return data;
}

/** § 2 Abs. 2 PKHFV: only the explicit SGB XII election waives E–J. */
export const isSimplified = (d: LatheFormData): boolean =>
  d.incomeType === IncomeType.BENEFITS_SGB_XII && d.useSgbXiiExemption === true;

export const hasPartner = (d: LatheFormData) =>
  d.personal.maritalStatus === 'verheiratet' ||
  d.personal.maritalStatus === 'eingetragene Lebenspartnerschaft';

const num = (v: string) => {
  const n = parseEuroDE(v);
  return Number.isNaN(n) ? 0 : n;
};

export const hasWorkIncome = (d: LatheFormData) =>
  num(d.financials.income.employment) !== 0 || num(d.financials.income.selfEmployment) !== 0;

export const partnerHasWorkIncome = (d: LatheFormData) =>
  num(d.financials.partnerIncome.employment) !== 0 ||
  num(d.financials.partnerIncome.selfEmployment) !== 0;

const anyIncomeRow = (r: IncomeRows) =>
  [
    r.employment,
    r.selfEmployment,
    r.rental,
    r.capital,
    r.kindergeld,
    r.wohngeld,
    r.unterhalt,
    r.pension,
    r.alg,
    r.buergergeld,
    r.krankengeld,
    r.elterngeld,
    r.other1Amount,
    r.other2Amount,
  ].some((v) => num(v) !== 0);

/** any declared income — F deductions (taxes, insurance, …) apply to every
 *  income type on the official ZP 1a, not only to work income */
export const hasAnyIncome = (d: LatheFormData) =>
  anyIncomeRow(d.financials.income) ||
  (d.incomeType === IncomeType.BENEFITS_ASYL && num(d.benefitAmount) > 0);

export const partnerHasAnyIncome = (d: LatheFormData) => anyIncomeRow(d.financials.partnerIncome);

/* ------------------------------------------------------------------ */

const incomeRowFields = (
  base: 'income' | 'partnerIncome',
  prefix: string
): import('./types').WizardField[] => {
  const rows: [keyof IncomeRows, string][] = [
    ['employment', 'field.inc.employment'],
    ['selfEmployment', 'field.inc.selfEmployment'],
    ['buergergeld', base === 'income' ? 'field.inc.buergergeldSelf' : 'field.inc.buergergeld'],
    ['pension', 'field.inc.pension'],
    ['alg', 'field.inc.alg'],
    ['krankengeld', 'field.inc.krankengeld'],
    ['elterngeld', 'field.inc.elterngeld'],
    ['kindergeld', 'field.inc.kindergeld'],
    ['wohngeld', 'field.inc.wohngeld'],
    ['unterhalt', 'field.inc.unterhalt'],
    ['rental', 'field.inc.rental'],
    ['capital', 'field.inc.capital'],
  ];
  return rows.map(([key, label]) => ({
    id: `${prefix}_${key}`,
    label,
    type: 'euro' as const,
    path: `financials.${base}.${key}`,
    placeholder: '0,00',
    allowNegative: key === 'selfEmployment',
    ...(base === 'income' && key === 'buergergeld'
      ? { requiredIf: (d: LatheFormData) =>
          d.incomeType === IncomeType.BENEFITS_SGB_II || d.incomeType === IncomeType.BENEFITS_SGB_XII }
      : {}),
  }));
};

export const STEPS: WizardStep[] = [
  /* ---------------- INTRO ---------------- */
  {
    id: 'intro',
    title: 'step.intro.title',
    description: 'step.intro.desc',
    fields: [
      { id: 'disclaimer', label: 'disclaimer.title', type: 'info', path: 'dummy', placeholder: 'disclaimer.text' },
      {
        id: 'courtInfo',
        label: 'field.courtInfo.label',
        type: 'text',
        path: 'personal.courtInfo',
        placeholder: 'field.courtInfo.placeholder',
        required: true,
      },
      {
        id: 'incomeType',
        label: 'field.incomeType.label',
        type: 'radio',
        path: 'incomeType',
        required: true,
        options: [
          { label: 'opt.income.sgb2', value: IncomeType.BENEFITS_SGB_II },
          { label: 'opt.income.sgb12', value: IncomeType.BENEFITS_SGB_XII },
          { label: 'opt.income.asyl', value: IncomeType.BENEFITS_ASYL },
          { label: 'opt.income.other', value: IncomeType.OTHER },
        ],
      },
      {
        id: 'useSgbXiiExemption',
        label: 'field.sgbXiiExemption.label',
        type: 'radio',
        path: 'useSgbXiiExemption',
        required: true,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
        hint: 'field.sgbXiiExemption.hint',
        visibleIf: (d) => d.incomeType === IncomeType.BENEFITS_SGB_XII,
      },
      {
        id: 'benefitAmount',
        label: 'field.benefitAmount.label',
        type: 'euro',
        path: 'benefitAmount',
        placeholder: '0,00',
        visibleIf: (d) => d.incomeType === IncomeType.BENEFITS_ASYL,
        hint: 'field.benefitAmount.hint',
      },
      {
        id: 'benefitInfo',
        label: 'field.benefitInfo.label',
        type: 'info',
        path: 'dummy',
        placeholder: 'field.benefitInfo.text',
        visibleIf: (d) => isSimplified(d),
      },
      {
        id: 'asylInfo',
        label: 'field.benefitInfo.label',
        type: 'info',
        path: 'dummy',
        placeholder: 'field.asylInfo.text',
        visibleIf: (d) => d.incomeType === IncomeType.BENEFITS_ASYL,
      },
    ],
  },

  /* ---------------- A — PERSONAL ---------------- */
  {
    id: 'personal',
    title: 'step.personal.title',
    fields: [
      { id: 'firstName', label: 'field.firstName.label', type: 'text', path: 'personal.firstName', required: true, hint: 'hint.latin', autoComplete: 'given-name' },
      { id: 'lastName', label: 'field.lastName.label', type: 'text', path: 'personal.lastName', required: true, autoComplete: 'family-name' },
      { id: 'birthName', label: 'field.birthName.label', type: 'text', path: 'personal.birthName' },
      { id: 'occupation', label: 'field.occupation.label', type: 'text', path: 'personal.occupation', autoComplete: 'organization-title' },
      { id: 'birthDate', label: 'field.birthDate.label', type: 'date', path: 'personal.birthDate', required: true, pastOnly: true },
      {
        id: 'maritalStatus',
        label: 'field.maritalStatus.label',
        type: 'select',
        path: 'personal.maritalStatus',
        required: true,
        options: [
          { label: 'opt.marital.single', value: 'ledig' },
          { label: 'opt.marital.married', value: 'verheiratet' },
          { label: 'opt.marital.partnership', value: 'eingetragene Lebenspartnerschaft' },
          { label: 'opt.marital.divorced', value: 'geschieden' },
          { label: 'opt.marital.widowed', value: 'verwitwet' },
          { label: 'opt.marital.separated', value: 'getrennt lebend' },
        ],
      },
      { id: 'address', label: 'field.address.label', type: 'text', path: 'personal.address', required: true, autoComplete: 'street-address' },
      { id: 'phone', label: 'field.phone.label', type: 'text', path: 'personal.phone', autoComplete: 'tel', inputMode: 'tel' },
      { id: 'representative', label: 'field.representative.label', type: 'text', path: 'personal.representative', hint: 'field.representative.hint' },
    ],
  },

  /* ---------------- B — INSURANCE ---------------- */
  {
    id: 'insurance',
    title: 'step.insurance.title',
    fields: [
      {
        id: 'hasInsurance',
        label: 'field.hasInsurance.label',
        type: 'radio',
        path: 'insurance.hasInsurance',
        required: true,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
      },
      {
        id: 'insuranceDetails',
        label: 'field.insuranceDetails.label',
        type: 'text',
        path: 'insurance.insuranceDetails',
        placeholder: 'field.insuranceDetails.placeholder',
        visibleIf: (d) => d.insurance.hasInsurance === true,
      },
      {
        id: 'hasLegalInsurance',
        label: 'field.hasLegalInsurance.label',
        type: 'radio',
        path: 'insurance.hasLegalInsurance',
        // B.2 answers "if no" to B.1: left empty, the form is incomplete.
        requiredIf: (d) => d.insurance.hasInsurance === false,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
        visibleIf: (d) => d.insurance.hasInsurance === false,
      },
      {
        id: 'potentialInsuranceDetails',
        label: 'field.potentialInsurance.label',
        type: 'text',
        path: 'insurance.potentialInsuranceDetails',
        visibleIf: (d) =>
          d.insurance.hasInsurance === false && d.insurance.hasLegalInsurance === true,
      },
    ],
  },

  /* ---------------- C — MAINTENANCE (was missing entirely) ---------------- */
  {
    id: 'maintenance',
    title: 'step.maintenance.title',
    description: 'step.maintenance.desc',
    fields: [
      {
        id: 'hasClaim',
        label: 'field.hasClaim.label',
        type: 'radio',
        path: 'maintenance.hasClaim',
        required: true,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
      },
      {
        id: 'opponentName',
        label: 'field.opponentName.label',
        type: 'text',
        path: 'maintenance.opponentName',
        visibleIf: (d) => d.maintenance.hasClaim === true,
      },
    ],
  },

  /* ---------------- D — DEPENDENTS (was missing entirely) ---------------- */
  {
    id: 'dependents',
    title: 'step.dependents.title',
    description: 'step.dependents.desc',
    fields: [
      {
        id: 'hasDependents',
        label: 'field.hasDependents.label',
        type: 'radio',
        path: 'hasDependents',
        required: true,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
      },
      {
        id: 'dependentsList',
        label: 'field.dependents.label',
        type: 'dependents',
        path: 'dependents',
        visibleIf: (d) => d.hasDependents === true,
      },
    ],
  },

  /* ---------------- E — INCOME (self) ---------------- */
  {
    id: 'income',
    title: 'step.income.title',
    description: 'step.income.desc',
    condition: (d) => !isSimplified(d),
    fields: [
      ...incomeRowFields('income', 'self'),
      { id: 'other1Label', label: 'field.inc.other1Label', type: 'text', path: 'financials.income.other1Label', placeholder: 'field.inc.otherLabel.placeholder', requiredIf: d => num(d.financials.income.other1Amount) !== 0 },
      { id: 'other1Amount', label: 'field.inc.other1Amount', type: 'euro', path: 'financials.income.other1Amount', placeholder: '0,00' },
      { id: 'expectedChanges', label: 'field.expectedChanges.label', type: 'textarea', path: 'financials.expectedChanges', hint: 'field.expectedChanges.hint' },
    ],
  },

  /* ---------------- E — INCOME (partner) ---------------- */
  {
    id: 'partnerIncome',
    title: 'step.partnerIncome.title',
    description: 'step.partnerIncome.desc',
    condition: (d) => !isSimplified(d) && hasPartner(d),
    fields: [
      ...incomeRowFields('partnerIncome', 'partner'),
      { id: 'pOther1Label', label: 'field.inc.other1Label', type: 'text', path: 'financials.partnerIncome.other1Label', placeholder: 'field.inc.otherLabel.placeholder', requiredIf: d => num(d.financials.partnerIncome.other1Amount) !== 0 },
      { id: 'pOther1Amount', label: 'field.inc.other1Amount', type: 'euro', path: 'financials.partnerIncome.other1Amount', placeholder: '0,00' },
    ],
  },

  /* ---------------- F — DEDUCTIONS (was missing entirely) ---------------- */
  {
    id: 'deductions',
    title: 'step.deductions.title',
    description: 'step.deductions.desc',
    // F deductions (taxes, social/health contributions, other insurance)
    // apply to ANY income on the official form — pensions, rental, capital —
    // not only to work income; commuting/Werbungskosten stay work-specific
    condition: (d) =>
      !isSimplified(d) && (hasAnyIncome(d) || (hasPartner(d) && partnerHasAnyIncome(d))),
    fields: [
      { id: 'dedInfo', label: 'info.deductions.title', type: 'info', path: 'dummy', placeholder: 'info.deductions.text' },
      { id: 'taxes', label: 'field.ded.taxes', type: 'euro', path: 'financials.deductions.taxes', placeholder: '0,00', visibleIf: hasAnyIncome },
      { id: 'social', label: 'field.ded.social', type: 'euro', path: 'financials.deductions.socialSecurity', placeholder: '0,00', visibleIf: hasAnyIncome },
      { id: 'otherIns', label: 'field.ded.otherIns', type: 'euro', path: 'financials.deductions.otherInsurance', placeholder: '0,00', visibleIf: hasAnyIncome },
      { id: 'commuting', label: 'field.ded.commuting', type: 'euro', path: 'financials.deductions.commuting', placeholder: '0,00', visibleIf: hasWorkIncome },
      { id: 'workExp', label: 'field.ded.workExp', type: 'euro', path: 'financials.deductions.workExpenses', placeholder: '0,00', visibleIf: hasWorkIncome },
      { id: 'pDedHeader', label: 'header.partner', type: 'info', path: 'dummy', placeholder: 'desc.partnerDeductions', visibleIf: (d) => hasPartner(d) && partnerHasAnyIncome(d) },
      { id: 'pTaxes', label: 'field.ded.taxes', type: 'euro', path: 'financials.partnerDeductions.taxes', placeholder: '0,00', visibleIf: (d) => hasPartner(d) && partnerHasAnyIncome(d) },
      { id: 'pSocial', label: 'field.ded.social', type: 'euro', path: 'financials.partnerDeductions.socialSecurity', placeholder: '0,00', visibleIf: (d) => hasPartner(d) && partnerHasAnyIncome(d) },
      { id: 'pOtherIns', label: 'field.ded.otherIns', type: 'euro', path: 'financials.partnerDeductions.otherInsurance', placeholder: '0,00', visibleIf: (d) => hasPartner(d) && partnerHasAnyIncome(d) },
      { id: 'pCommuting', label: 'field.ded.commuting', type: 'euro', path: 'financials.partnerDeductions.commuting', placeholder: '0,00', visibleIf: (d) => hasPartner(d) && partnerHasWorkIncome(d) },
      { id: 'pWorkExp', label: 'field.ded.workExp', type: 'euro', path: 'financials.partnerDeductions.workExpenses', placeholder: '0,00', visibleIf: (d) => hasPartner(d) && partnerHasWorkIncome(d) },
    ],
  },

  /* ---------------- G — ASSETS (now per-category, incl. vehicles & life insurance) ---------------- */
  {
    id: 'assets',
    title: 'step.assets.title',
    description: 'step.assets.desc',
    condition: (d) => !isSimplified(d),
    fields: [
      { id: 'hasBank', label: 'field.hasBank.label', type: 'radio', path: 'financials.hasBank', required: true, options: [{ label: 'opt.yes', value: true }, { label: 'opt.no', value: false }] },
      { id: 'bankAccount', label: 'field.bankAccount.label', type: 'text', path: 'financials.bankAccount', placeholder: 'field.bankAccount.placeholder', visibleIf: (d) => d.financials.hasBank === true },
      { id: 'bankBalance', label: 'field.bankBalance.label', type: 'euro', path: 'financials.bankBalance', placeholder: '0,00', allowNegative: true, visibleIf: (d) => d.financials.hasBank === true },

      { id: 'hasRealEstate', label: 'field.hasRealEstate.label', type: 'radio', path: 'financials.hasRealEstate', required: true, options: [{ label: 'opt.yes', value: true }, { label: 'opt.no', value: false }] },
      { id: 'realEstate', label: 'field.realEstate.label', type: 'text', path: 'financials.realEstate', visibleIf: (d) => d.financials.hasRealEstate === true },
      { id: 'realEstateValue', label: 'field.value.label', type: 'euro', path: 'financials.realEstateValue', placeholder: '0,00', visibleIf: (d) => d.financials.hasRealEstate === true },

      { id: 'hasVehicle', label: 'field.hasVehicle.label', type: 'radio', path: 'financials.hasVehicle', required: true, options: [{ label: 'opt.yes', value: true }, { label: 'opt.no', value: false }] },
      { id: 'vehicle', label: 'field.vehicle.label', type: 'text', path: 'financials.vehicle', placeholder: 'field.vehicle.placeholder', visibleIf: (d) => d.financials.hasVehicle === true },
      { id: 'vehicleValue', label: 'field.value.label', type: 'euro', path: 'financials.vehicleValue', placeholder: '0,00', visibleIf: (d) => d.financials.hasVehicle === true },

      { id: 'hasCash', label: 'field.hasCash.label', type: 'radio', path: 'financials.hasCash', required: true, options: [{ label: 'opt.yes', value: true }, { label: 'opt.no', value: false }] },
      { id: 'cash', label: 'field.cash.label', type: 'text', path: 'financials.cash', placeholder: 'field.cash.placeholder', visibleIf: (d) => d.financials.hasCash === true },
      { id: 'cashValue', label: 'field.value.label', type: 'euro', path: 'financials.cashValue', placeholder: '0,00', visibleIf: (d) => d.financials.hasCash === true },

      { id: 'hasLifeInsurance', label: 'field.hasLifeIns.label', type: 'radio', path: 'financials.hasLifeInsurance', required: true, options: [{ label: 'opt.yes', value: true }, { label: 'opt.no', value: false }] },
      { id: 'lifeInsurance', label: 'field.lifeIns.label', type: 'text', path: 'financials.lifeInsurance', visibleIf: (d) => d.financials.hasLifeInsurance === true },
      { id: 'lifeInsuranceValue', label: 'field.lifeInsValue.label', type: 'euro', path: 'financials.lifeInsuranceValue', placeholder: '0,00', visibleIf: (d) => d.financials.hasLifeInsurance === true },

      { id: 'hasOtherAssets', label: 'field.hasOtherAssets.label', type: 'radio', path: 'financials.hasOtherAssets', required: true, options: [{ label: 'opt.yes', value: true }, { label: 'opt.no', value: false }] },
      { id: 'otherAssets', label: 'field.otherAssets.label', type: 'text', path: 'financials.otherAssets', placeholder: 'field.otherAssets.placeholder', visibleIf: (d) => d.financials.hasOtherAssets === true },
      { id: 'otherAssetsValue', label: 'field.value.label', type: 'euro', path: 'financials.otherAssetsValue', placeholder: '0,00', visibleIf: (d) => d.financials.hasOtherAssets === true },
    ],
  },

  /* ---------------- H — HOUSING (tenant/owner toggle added) ---------------- */
  {
    id: 'housing',
    title: 'step.housing.title',
    condition: (d) => !isSimplified(d),
    fields: [
      { id: 'housingInfo', label: 'info.housing.title', type: 'info', path: 'dummy', placeholder: 'info.housing.text' },
      { id: 'livingSpace', label: 'field.livingSpace.label', type: 'text', path: 'financials.livingSpace', placeholder: 'm²', inputMode: 'decimal' },
      { id: 'roomCount', label: 'field.roomCount.label', type: 'text', path: 'financials.roomCount', inputMode: 'numeric' },
      { id: 'totalPeople', label: 'field.totalPeople.label', type: 'text', path: 'financials.totalPeople', inputMode: 'numeric' },
      {
        // required: courts return section H as incomplete when neither the
        // Mieter nor the Eigentümer question is answered; 'none' covers
        // rent-free living (both answered "Nein")
        id: 'housingRole',
        label: 'field.housingRole.label',
        type: 'radio',
        path: 'financials.housingRole',
        required: true,
        options: [
          { label: 'opt.housing.tenant', value: 'tenant' },
          { label: 'opt.housing.owner', value: 'owner' },
          { label: 'opt.housing.none', value: 'none' },
        ],
      },
      { id: 'rent', label: 'field.rent.label', type: 'euro', path: 'financials.rent', placeholder: '0,00', visibleIf: (d) => d.financials.housingRole === 'tenant' },
      { id: 'ownerLoan', label: 'field.ownerLoan.label', type: 'euro', path: 'financials.ownerLoan', placeholder: '0,00', visibleIf: (d) => d.financials.housingRole === 'owner' },
      { id: 'heatingCosts', label: 'field.heatingCosts.label', type: 'euro', path: 'financials.heatingCosts', placeholder: '0,00', visibleIf: (d) => d.financials.housingRole === 'tenant' || d.financials.housingRole === 'owner' },
      { id: 'otherHousingCosts', label: 'field.otherHousingCosts.label', type: 'euro', path: 'financials.otherHousingCosts', placeholder: '0,00', visibleIf: (d) => d.financials.housingRole === 'tenant' || d.financials.housingRole === 'owner' },
      { id: 'totalHousingCosts', label: 'field.totalHousingCosts.label', type: 'euro', path: 'financials.totalHousingCosts', placeholder: '0,00', visibleIf: (d) => d.financials.housingRole === 'tenant' || d.financials.housingRole === 'owner' },
      { id: 'housingPaidAlone', label: 'field.housingPaidAlone.label', type: 'euro', path: 'financials.housingPaidAlone', placeholder: '0,00', hint: 'field.housingPaidAlone.hint', visibleIf: (d) => d.financials.housingRole === 'tenant' || d.financials.housingRole === 'owner' },
    ],
  },

  /* ---------------- I — OBLIGATIONS ---------------- */
  {
    id: 'obligations',
    title: 'step.obligations.title',
    condition: (d) => !isSimplified(d),
    fields: [
      {
        id: 'hasObligations',
        label: 'field.hasObligations.label',
        type: 'radio',
        path: 'financials.hasObligations',
        required: true,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
      },
      { id: 'obDesc1', label: 'field.obDesc.label', type: 'text', path: 'financials.obligations.0.description', placeholder: 'field.obDesc.placeholder', visibleIf: (d) => d.financials.hasObligations === true },
      { id: 'obTotal1', label: 'field.obTotal.label', type: 'euro', path: 'financials.obligations.0.total', placeholder: '0,00', visibleIf: (d) => d.financials.hasObligations === true },
      { id: 'obMonthly1', label: 'field.obMonthly.label', type: 'euro', path: 'financials.obligations.0.monthly', placeholder: '0,00', visibleIf: (d) => d.financials.hasObligations === true },
      { id: 'obAlone1', label: 'field.obAlone.label', type: 'euro', path: 'financials.obligations.0.paidAlone', placeholder: '0,00', visibleIf: (d) => d.financials.hasObligations === true },
      { id: 'obDesc2', label: 'field.obDesc2.label', type: 'text', path: 'financials.obligations.1.description', placeholder: 'field.obDesc.placeholder', visibleIf: (d) => d.financials.hasObligations === true && !!d.financials.obligations[0]?.description },
      { id: 'obTotal2', label: 'field.obTotal.label', type: 'euro', path: 'financials.obligations.1.total', placeholder: '0,00', visibleIf: (d) => !!d.financials.obligations[1]?.description },
      { id: 'obMonthly2', label: 'field.obMonthly.label', type: 'euro', path: 'financials.obligations.1.monthly', placeholder: '0,00', visibleIf: (d) => !!d.financials.obligations[1]?.description },
    ],
  },

  /* ---------------- J — SPECIAL BURDENS ---------------- */
  {
    id: 'special',
    title: 'step.special.title',
    condition: (d) => !isSimplified(d),
    fields: [
      { id: 'specialInfo', label: 'info.special.title', type: 'info', path: 'dummy', placeholder: 'info.special.text' },
      {
        id: 'hasSpecial',
        label: 'field.hasSpecial.label',
        type: 'radio',
        path: 'financials.hasSpecialBurdens',
        required: true,
        options: [
          { label: 'opt.yes', value: true },
          { label: 'opt.no', value: false },
        ],
      },
      { id: 'specDesc', label: 'field.specDesc.label', type: 'textarea', path: 'financials.specialBurdenDescription', visibleIf: (d) => d.financials.hasSpecialBurdens === true },
      { id: 'specCost', label: 'field.specCost.label', type: 'euro', path: 'financials.specialBurdenCost', placeholder: '0,00', visibleIf: (d) => d.financials.hasSpecialBurdens === true },
    ],
  },

  /* ---------------- K — DECLARATION ---------------- */
  {
    id: 'declaration',
    title: 'step.declaration.title',
    description: 'step.declaration.desc',
    fields: [
      { id: 'place', label: 'field.place.label', type: 'text', path: 'declaration.place', required: true, autoComplete: 'address-level2' },
      { id: 'date', label: 'field.date.label', type: 'date', path: 'declaration.date', required: true },
      { id: 'docCount', label: 'field.docCount.label', type: 'text', path: 'declaration.docCount', inputMode: 'numeric' },
      { id: 'signatureReminder', label: 'info.signature.title', type: 'info', path: 'dummy', placeholder: 'info.signature.text' },
    ],
  },
];
