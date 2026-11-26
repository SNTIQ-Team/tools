export enum IncomeType {
  BENEFITS_SGB_II = 'SGB_II',
  BENEFITS_SGB_XII = 'SGB_XII',
  BENEFITS_ASYL = 'ASYL',
  OTHER = 'OTHER',
}

export interface PersonalData {
  courtInfo: string;
  firstName: string;
  lastName: string;
  birthName: string;
  occupation: string;
  birthDate: string;
  maritalStatus: string;
  address: string;
  phone: string;
  representative: string; // Gesetzlicher Vertreter (A)
}

export interface LegalInsurance {
  hasInsurance: boolean | null; // B q1: third party covers costs?
  insuranceDetails: string;
  hasLegalInsurance: boolean | null; // B q2: Rechtsschutzversicherung / membership?
  potentialInsuranceDetails: string;
}

export interface Maintenance {
  hasClaim: boolean | null; // C
  opponentName: string;
}

export interface Dependent {
  name: string;
  birthDate: string;
  relationship: string;
  monthlySupport: string; // what the applicant pays (cash)
  hasOwnIncome: boolean | null;
  ownIncomeAmount: string; // net monthly
}

/** One income category row (self or partner) */
export interface IncomeRows {
  employment: string;
  selfEmployment: string;
  rental: string;
  capital: string;
  kindergeld: string;
  wohngeld: string;
  unterhalt: string;
  pension: string;
  alg: string; // Arbeitslosengeld
  buergergeld: string;
  krankengeld: string;
  elterngeld: string;
  other1Label: string;
  other1Amount: string;
  other2Label: string;
  other2Amount: string;
}

/** Section F deductions (self or partner) */
export interface DeductionRows {
  taxes: string;
  socialSecurity: string;
  otherInsurance: string;
  commuting: string;
  workExpenses: string;
}

export interface Financials {
  income: IncomeRows;
  partnerIncome: IncomeRows;
  expectedChanges: string; // potential/expected income changes — appended as note
  deductions: DeductionRows;
  partnerDeductions: DeductionRows;

  // H — Housing
  livingSpace: string;
  roomCount: string;
  totalPeople: string;
  housingRole: 'tenant' | 'owner' | 'none' | null; // 'none' = lives rent-free
  rent: string; // tenant: cold rent
  ownerLoan: string; // owner: interest + amortization (Zinsen und Tilgung)
  heatingCosts: string;
  otherHousingCosts: string;
  totalHousingCosts: string;
  housingPaidAlone: string; // "Ich allein zahle davon"

  // I — Obligations (up to 3)
  hasObligations: boolean | null;
  obligations: { description: string; total: string; monthly: string; paidAlone: string }[];

  // J — Special burdens
  hasSpecialBurdens: boolean | null;
  specialBurdenDescription: string;
  specialBurdenCost: string;

  // G — Assets
  hasBank: boolean | null;
  bankAccount: string;
  bankBalance: string;
  hasRealEstate: boolean | null;
  realEstate: string;
  realEstateValue: string;
  hasVehicle: boolean | null;
  vehicle: string; // Marke, Typ, Baujahr, km
  vehicleValue: string;
  hasCash: boolean | null;
  cash: string;
  cashValue: string;
  hasLifeInsurance: boolean | null;
  lifeInsurance: string;
  lifeInsuranceValue: string; // Rückkaufswert
  hasOtherAssets: boolean | null;
  otherAssets: string;
  otherAssetsValue: string;
}

export interface LatheFormData {
  incomeType: IncomeType | null;
  useSgbXiiExemption: boolean | null; // explicit election under § 2(2) PKHFV
  benefitAmount: string; // monthly benefit amount (used for ASYL row)
  personal: PersonalData;
  insurance: LegalInsurance;
  maintenance: Maintenance;
  hasDependents: boolean | null;
  dependents: Dependent[];
  financials: Financials;
  declaration: {
    date: string;
    /** True while the date is the automatic "today in Berlin": it then
        follows the calendar (midnight, a draft opened days later). The
        person picking a date turns it off. */
    dateIsAuto?: boolean;
    place: string;
    docCount: string;
  };
}

export type FieldType =
  | 'text'
  | 'euro'
  | 'date'
  | 'select'
  | 'radio'
  | 'textarea'
  | 'info'
  | 'dependents';

export interface WizardField {
  id: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string | boolean }[];
  placeholder?: string;
  path: string;
  required?: boolean;
  requiredIf?: (data: LatheFormData) => boolean;
  allowNegative?: boolean;
  hint?: string;
  pastOnly?: boolean; // date fields: must not be in the future (birth dates)
  /** What the field holds, for the browser's autofill (HTML autocomplete token). */
  autoComplete?: string;
  /** Text fields: the keyboard a phone shows, and `tel` for phone numbers. */
  inputMode?: 'numeric' | 'decimal' | 'tel';
  visibleIf?: (data: LatheFormData) => boolean;
}

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  fields: WizardField[];
  condition?: (data: LatheFormData) => boolean;
}
