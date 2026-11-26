/**
 * ZP 1a mapping — the ONLY file that knows the PDF field names of the
 * Erklärung über die persönlichen und wirtschaftlichen Verhältnisse.
 *
 * Checkbox convention in the form: each question has two checkboxes,
 * e.g. E1 (on-state "Nein") and E2 (on-state "Ja"). `check()` activates
 * the checkbox's own on-state, so checking E1 marks "Nein".
 */

import { LatheFormData, IncomeType } from '../types';
import { Operation } from './fill';
import {
  isSimplified,
  hasPartner,
  hasWorkIncome,
  partnerHasWorkIncome,
  hasAnyIncome,
  partnerHasAnyIncome,
} from '../wizard';
import { parseEuroDE } from '../validation';

const fmtDate = (s: string): string => {
  if (!s) return '';
  if (s.includes('.')) return s;
  const p = s.split('-');
  return p.length === 3 ? `${p[2]}.${p[1]}.${p[0]}` : s;
};

const filled = (v: string | undefined | null) => !!v && v.trim().length > 0;

/** an amount counts as declared unless it is empty or parses to exactly 0
 *  (users type the visible '0,00' placeholder to mean "none") */
const filledAmount = (v: string | undefined | null) => {
  if (!filled(v)) return false;
  const n = parseEuroDE(v as string);
  return Number.isNaN(n) || n !== 0;
};

export const buildZp1aOperations = (d: LatheFormData): Operation[] => {
  const ops: Operation[] = [];
  const text = (field: string, value: string) => {
    if (value !== undefined && value !== null) ops.push({ op: 'text', field, value });
  };
  const check = (field: string) => ops.push({ op: 'check', field });
  /** yes/no pair: `noField` has on-state "Nein", `yesField` has on-state "Ja" */
  const yesNo = (yesField: string, noField: string, isYes: boolean | null) => {
    if (isYes === true) check(yesField);
    else if (isYes === false) check(noField);
  };
  /** amount row: if value present → Ja + amount, else → Nein */
  const amountRow = (yesField: string, noField: string, amountField: string, value: string) => {
    if (filledAmount(value)) {
      check(yesField);
      text(amountField, value);
    } else {
      check(noField);
    }
  };

  /* ---------- Header / A ---------- */
  text('Bezeichnung, Ort und Geschäftsnummer des Gerichts', d.personal.courtInfo);
  text(
    'Name, Vorname, ggf. Geburtsname',
    `${d.personal.lastName}, ${d.personal.firstName}${
      d.personal.birthName ? ` (geb. ${d.personal.birthName})` : ''
    }`
  );
  text('Beruf, Erwerbstätigkeit', d.personal.occupation);
  text('Geburtsdatum', fmtDate(d.personal.birthDate));
  text('Familienstand', d.personal.maritalStatus);
  text('Anschrift (Straße, Hausnummer, Postleitzahl, Wohnort)', d.personal.address);
  text('Tagsüber erreichbar unter Nummer', d.personal.phone);
  text(
    'Sofern vorhanden: Gesetzlicher Vertreter (Name, Vorname, Anschrift, Telefon',
    d.personal.representative
  );

  /* ---------- B — insurance ---------- */
  if (d.insurance.hasInsurance === true) {
    check('B2'); // Ja
    text('Höhe der Kosten', d.insurance.insuranceDetails);
  } else if (d.insurance.hasInsurance === false) {
    check('B1'); // Nein
    if (d.insurance.hasLegalInsurance === true) {
      check('B4');
      text('Bezeichnung der Versicherung', d.insurance.potentialInsuranceDetails);
    } else if (d.insurance.hasLegalInsurance === false) {
      check('B3');
    }
  }

  /* ---------- C — maintenance ---------- */
  if (d.maintenance.hasClaim === true) {
    check('C2');
    text('Name des Unterhaltspflichtigen', d.maintenance.opponentName);
  } else if (d.maintenance.hasClaim === false) {
    check('C1');
  }

  /* ---------- D — dependents (rows 1..5) ---------- */
  // gated on the explicit "Ja": a list entered before flipping the answer
  // back to "Nein" must never leak into the declaration
  if (d.hasDependents === true) {
    d.dependents.slice(0, 5).forEach((dep, i) => {
      const n = i + 1;
      text(`Angehöriger Nr. ${n}`, `${dep.name}${dep.relationship ? '' : ''}`);
      text(`Geburtsdatum ${n}`, fmtDate(dep.birthDate));
      text(`Verhältnis ${n}`, dep.relationship);
      text(`Monatsbetrag ${n}`, dep.monthlySupport);
      // per-row own-income checkbox pair: D1/D2 (row1) ... D9/D10 (row5)
      const noField = `D${2 * i + 1}`;
      const yesField = `D${2 * i + 2}`;
      if (dep.hasOwnIncome === true) {
        check(yesField);
        text(`Betrag ${n}`, dep.ownIncomeAmount);
      } else if (dep.hasOwnIncome === false) {
        check(noField);
      }
    });
  }

  /* ---------- E–J: skipped when the SGB XII exemption applies ---------- */
  if (isSimplified(d)) {
    text('Ort, Datum', `${d.declaration.place}, ${fmtDate(d.declaration.date)}`);
    text('Anzahl der beigefügten Belege', d.declaration.docCount);
    return ops;
  }

  /* ---------- E — income (self) ---------- */
  const inc = d.financials.income;
  amountRow('E2', 'E1', 'Monatliche Bruttoeinnahmen durch nichtselbständige Arbeit in Euro', inc.employment);
  amountRow('E4', 'E3', 'Monatliche Bruttoeinnahmen durch selbständige Arbeit/Gewerbebetrieb/Land- und Forstwirtschaft in Eur', inc.selfEmployment);
  amountRow('E6', 'E5', 'Monatliche Bruttoeinnahmen durch Vermietung und Verpachtung in Euro', inc.rental);
  amountRow('E8', 'E7', 'Monatliche Bruttoeinnahmen durch Kapitalvermögen in Euro', inc.capital);
  amountRow('E10', 'E9', 'Monatliche Bruttoeinnahmen durch Kindergeld/Kinderzuschlag in Euro\r', inc.kindergeld);
  amountRow('E12', 'E11', 'Monatliche Bruttoeinnahmen durch Wohngeld in Euro', inc.wohngeld);
  amountRow('E14', 'E13', 'Monatliche Bruttoeinnahmen durch Unterhalt in Euro\r', inc.unterhalt);
  amountRow('E16', 'E15', 'Monatliche Bruttoeinnahmen durch Rente/Pension in Euro', inc.pension);
  amountRow('E18', 'E17', 'Monatliche Bruttoeinnahmen durch Arbeitslosengeld in Euro\r', inc.alg);
  // SGB II is recorded in E20. SGB XII belongs under other income.
  if (d.incomeType === IncomeType.BENEFITS_SGB_II) {
    check('E20');
    text('Monatliche Bruttoeinnahmen durch Bürgergeld in Euro\r', inc.buergergeld);
  } else if (d.incomeType === IncomeType.BENEFITS_SGB_XII) {
    check('E19');
  } else {
    amountRow('E20', 'E19', 'Monatliche Bruttoeinnahmen durch Bürgergeld in Euro\r', inc.buergergeld);
  }
  amountRow('E22', 'E21', 'Monatliche Bruttoeinnahmen durch Krankengeld in Euro\r', inc.krankengeld);
  amountRow('E24', 'E23', 'Monatliche Bruttoeinnahmen durch Elterngeld in Euro\r', inc.elterngeld);

  // "Andere Einnahmen" rows 1..2, filled left to right so entries can never
  // overwrite each other. AsylbLG and SGB XII benefits are injected here
  // (neither is covered by the E19/E20 Bürgergeld row).
  const otherRows: { label: string; amount: string }[] = [];
  if (filled(inc.other1Label) || filledAmount(inc.other1Amount)) {
    otherRows.push({ label: inc.other1Label, amount: inc.other1Amount });
  }
  if (d.incomeType === IncomeType.BENEFITS_ASYL) {
    otherRows.push({ label: 'Leistungen nach AsylbLG (siehe Bescheid)', amount: d.benefitAmount });
  } else if (d.incomeType === IncomeType.BENEFITS_SGB_XII) {
    otherRows.push({
      label: 'Laufende Leistungen nach SGB XII (siehe Bescheid)',
      amount: inc.buergergeld,
    });
  }
  // only real income flips E26 to "Ja" — the expected-changes note is
  // informational, never carries an amount and never claims income exists
  if (otherRows.length > 0) check('E26');
  else check('E25');
  if (filled(d.financials.expectedChanges)) {
    const note = `Erwartete Änderungen: ${d.financials.expectedChanges}`;
    if (otherRows.length < 2) otherRows.push({ label: note, amount: '' });
    else otherRows[1].label += `; ${note}`;
  }
  otherRows.slice(0, 2).forEach((row, i) => {
    text(`Andere Einnahmen ${i + 1}`, row.label);
    if (filledAmount(row.amount)) text(`Bruttobezug ${i + 1}`, row.amount);
  });

  /* ---------- E — income (partner). Offset +26 to self checkboxes ---------- */
  // written only while a spouse/registered partner exists: stale partner data
  // from an earlier marital-status answer must never reach the PDF
  if (hasPartner(d)) {
    const p = d.financials.partnerIncome;
    const partnerRow = (selfYes: number, amountField: string, value: string) =>
      amountRow(`E${selfYes + 26}`, `E${selfYes + 25}`, amountField, value);
    partnerRow(2, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch nichtselbständige Arbeit in Euro', p.employment);
    partnerRow(4, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch selbständige Arbeit/Gewerbebetrieb/Land- und Fors', p.selfEmployment);
    partnerRow(6, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Vermietung und Verpachtung in Euro\r', p.rental);
    partnerRow(8, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Kapitalvermögen in Euro\r', p.capital);
    partnerRow(10, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Kindergeld/Kinderzuschlag in Euro\r', p.kindergeld);
    partnerRow(12, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Wohngeld in Euro\r', p.wohngeld);
    partnerRow(14, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Unterhalt in Euro\r', p.unterhalt);
    partnerRow(16, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Rente/Pension in Euro\r', p.pension);
    partnerRow(18, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Arbeitslosengeld in Euro\r', p.alg);
    partnerRow(20, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Bürgergeld in Euro\r', p.buergergeld);
    partnerRow(22, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Krankengeld in Euro\r', p.krankengeld);
    partnerRow(24, 'Monatliche Bruttoeinnahmen Partner/Partnerin durch Elterngeld in Euro\r', p.elterngeld);
    if (filled(p.other1Label) || filledAmount(p.other1Amount)) {
      check('E52');
      text('Andere Einnahmen Partner/Partnerin 1', p.other1Label);
      text('Bruttobezug Partner/Partnerin 1', p.other1Amount);
    } else {
      check('E51');
    }
  }

  /* ---------- F — deductions ---------- */
  // gated on the income that makes them possible: amounts from a since-hidden
  // F step (income deleted after filling it) must not be printed
  const ded = d.financials.deductions;
  const pded = d.financials.partnerDeductions;
  const dedRow = (label: string, amountField: string, value: string) => {
    if (filledAmount(value)) {
      text(label, 'X');
      text(amountField, value);
    }
  };
  if (hasAnyIncome(d)) {
    dedRow('Steuern/Solidarzuschlag', 'Monatliche Abzüge in Euro durch Steuern/Solidaritätszuschlag', ded.taxes);
    dedRow('Sozialversicherungsbeiträge', 'Monatliche Abzüge in Euro durch Sozialversicherungsbeiträge', ded.socialSecurity);
    dedRow('Sonstige Versicherungen', 'Monatliche Abzüge in Euro durch Sonstige Versicherungen', ded.otherInsurance);
    if (hasWorkIncome(d)) {
      dedRow('Fahrt zur Arbeit (Kosten für öffentliche Verkehrsmittel oder einfache Entfernung bei KFZ-Nutzung)', 'Monatliche Abzüge in Euro durch Fahrtkosten', ded.commuting);
      dedRow('Sonstige Werbungskosten/Betriebsausgaben', 'Monatliche Abzüge in Euro durch Sonstige Werbungskosten/Betriebsausgaben', ded.workExpenses);
    }
  }
  if (hasPartner(d) && partnerHasAnyIncome(d)) {
    dedRow('Steuern/Solidarzuschlag Partner/Partnerin', 'Monatliche Abzüge in Euro durch Steuern/Solidaritätszuschlag Partner/Partnerin', pded.taxes);
    dedRow('Sozialversicherungsbeiträge Partner/Partnerin', 'Monatliche Abzüge in Euro durch Sozialversicherungsbeiträge Partner/Partnerin', pded.socialSecurity);
    dedRow('Sonstige Versicherungen Partner/Partnerin', 'Monatliche Abzüge in Euro durch Sonstige Versicherungen Partner/Partnerin', pded.otherInsurance);
    if (partnerHasWorkIncome(d)) {
      dedRow('Fahrt zur Arbeit (Kosten für öffentliche Verkehrsmittel oder einfache Entfernung bei KFZ-Nutzung) Pa', 'Monatliche Abzüge in Euro durch Fahrtkosten Partner/Partnerin', pded.commuting);
      dedRow('Sonstige Werbungskosten/Betriebsausgaben Partner/Partnerin', 'Monatliche Abzüge in Euro durch Sonstige Werbungskosten/Betriebsausgaben Partner/Partnerin', pded.workExpenses);
    }
  }

  /* ---------- G — assets ---------- */
  const f = d.financials;
  if (f.hasBank === true) {
    check('G2');
    text('Art des Kontos, Kontoinhaber, Kreditinstitut', f.bankAccount);
    text('Kontostand', f.bankBalance);
  } else if (f.hasBank === false) check('G1');

  if (f.hasRealEstate === true) {
    check('G4');
    text('Größe, Anschrift/Grundbuchbezeichnung, Allein- oder Miteigentum, Zahl der Wohneinheiten ', f.realEstate);
    text('Verkehrswert Grundeigentum', f.realEstateValue);
  } else if (f.hasRealEstate === false) check('G3');

  if (f.hasVehicle === true) {
    check('G6');
    text('Marke, Typ, Baujahr, Anschaffungsjahr, Allein- oder Miteigentum, Kilometerstand ', f.vehicle);
    text('Verkehrswert Kfz', f.vehicleValue);
  } else if (f.hasVehicle === false) check('G5');

  if (f.hasCash === true) {
    check('G8');
    text('Bargeldbetrag in EUR, Bezeichnung der Wertgegenstände, Allein- oder Miteigentum ', f.cash);
    text('Verkehrswert Bargeld', f.cashValue);
  } else if (f.hasCash === false) check('G7');

  if (f.hasLifeInsurance === true) {
    check('G10');
    text('Versicherung, Versicherungsnehmer, Datum des Vertrages/Handelt es sich um eine zusätzliche Altersvor', f.lifeInsurance);
    text('Rückkaufswert ', f.lifeInsuranceValue);
  } else if (f.hasLifeInsurance === false) check('G9');

  if (f.hasOtherAssets === true) {
    check('G12');
    text('Bezeichnung, Allein- oder Miteigentum ', f.otherAssets);
    text('Verkehrswert sonstige Vermögenswerte', f.otherAssetsValue);
  } else if (f.hasOtherAssets === false) check('G11');

  /* ---------- H — housing ---------- */
  text('1. Gesamtgröße des Wohnraums, den Sie allein oder gemeinsam mit anderen Personen bewohnen', f.livingSpace);
  text('2. Zahl der Zimmer', f.roomCount);
  text('3. \u0007Anzahl der Personen, die den Wohnraum insgesamt bewohnen', f.totalPeople);

  if (f.housingRole === 'tenant') {
    check('H2');
    check('H3'); // owner: Nein
    text('Wohnkosten als Mieter/Mieterin - Miete ohne Nebenkosten', f.rent);
    text('Wohnkosten als Mieter/Mieterin - Heizungskosten', f.heatingCosts);
    text('Wohnkosten als Mieter/Mieterin - übrige Nebenkosten', f.otherHousingCosts);
    text('Gesamtbetrag als Mieter/Mieterin', f.totalHousingCosts);
    text('Ich allein zahle davon als Mieter/Mieterin', f.housingPaidAlone);
  } else if (f.housingRole === 'owner') {
    check('H4');
    check('H1'); // tenant: Nein
    text('Kosten als Eigentümer/Eigentümerin - Zinsen und Tilgung', f.ownerLoan);
    text('Kosten als Eigentümer/Eigentümerin - Heizungskosten', f.heatingCosts);
    text('Kosten als Eigentümer/Eigentümerin - übrige Nebenkosten', f.otherHousingCosts);
    text('Gesamtbetrag als Eigentümer/Eigentümerin', f.totalHousingCosts);
    text('Ich allein zahle davon als Eigentümer/Eigentümerin', f.housingPaidAlone);
  } else if (f.housingRole === 'none') {
    // lives rent-free (e.g. with relatives / in a shelter): both questions
    // answered "Nein", no cost figures
    check('H1'); // tenant: Nein
    check('H3'); // owner: Nein
  }

  /* ---------- I — obligations (rows 1..3) ---------- */
  if (f.hasObligations === true) {
    f.obligations.slice(0, 3).forEach((ob, i) => {
      // a row counts as soon as anything was entered — declared amounts
      // without a description must still reach the court form
      if (
        !filled(ob.description) &&
        !filledAmount(ob.total) &&
        !filledAmount(ob.monthly) &&
        !filledAmount(ob.paidAlone)
      )
        return;
      const n = i + 1;
      text(`Sonstige Zahlungsverpflichtungen ${n}`, ob.description);
      text(`Restschuld in Euro ${n}`, ob.total);
      text(`Gesamtbelastung mtl. ${n}`, ob.monthly);
      text(`Ich allein zahle davon (sonstige Zahlungsverpflichtungen) ${n}`, ob.paidAlone);
    });
  }

  /* ---------- J — special burdens ---------- */
  if (
    f.hasSpecialBurdens === true &&
    (filled(f.specialBurdenDescription) || filledAmount(f.specialBurdenCost))
  ) {
    text('Besondere Belastungen 1', f.specialBurdenDescription);
    // the monthly cost belongs in the form's dedicated amount column, not
    // buried inside the description text
    if (filledAmount(f.specialBurdenCost)) {
      text('Ich allein zahle davon (besondere Belastungen) 1', f.specialBurdenCost);
    }
  }

  /* ---------- K ---------- */
  text('Ort, Datum', `${d.declaration.place}, ${fmtDate(d.declaration.date)}`);
  text('Anzahl der beigefügten Belege', d.declaration.docCount);

  return ops;
};
