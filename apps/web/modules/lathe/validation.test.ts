import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEuroDE, normalizeEuroDE } from './validation';
import { INITIAL_DATA, STEPS } from './wizard';
import { buildZp1aOperations } from './engine/mapping';
import { IncomeType } from './types';
import { getStepErrors } from './formValidation';

test('signed balances keep their amount and sign in German normalization and PDF mapping', () => {
  assert.equal(parseEuroDE('-1.234,56'), -1234.56);
  assert.equal(normalizeEuroDE('-1.234,56'), '-1.234,56');
  const data = structuredClone(INITIAL_DATA);
  data.incomeType = IncomeType.OTHER;
  data.financials.hasBank = true;
  data.financials.bankBalance = normalizeEuroDE('-1.234,56');
  assert.deepEqual(buildZp1aOperations(data).find(op => op.field === 'Kontostand'),
    { op: 'text', field: 'Kontostand', value: '-1.234,56' });
});

test('overflow and amounts outside safe cent precision are rejected', () => {
  for (const value of ['9'.repeat(310), '999999999999999999999', '--12', '12-', '12x34']) {
    assert.ok(Number.isNaN(parseEuroDE(value)), value);
    assert.equal(normalizeEuroDE(value), '', value);
  }
  assert.equal(normalizeEuroDE('1200.50'), '1.200,50');
});

test('an amount-only other-income declaration is never mapped to No or omitted', () => {
  for (const partner of [false, true]) {
    const data = structuredClone(INITIAL_DATA);
    data.incomeType = IncomeType.OTHER;
    data.personal.maritalStatus = 'verheiratet';
    const income = partner ? data.financials.partnerIncome : data.financials.income;
    income.other1Amount = '350,00';
    const ops = buildZp1aOperations(data);
    assert.ok(ops.some(op => op.op === 'check' && op.field === (partner ? 'E52' : 'E26')));
    assert.ok(!ops.some(op => op.op === 'check' && op.field === (partner ? 'E51' : 'E25')));
    assert.ok(ops.some(op => op.op === 'text' && op.field === (partner ? 'Bruttobezug Partner/Partnerin 1' : 'Bruttobezug 1') && op.value === '350,00'));
  }
});

test('legitimate self-employment losses are retained rather than declared absent', () => {
  const data = structuredClone(INITIAL_DATA);
  data.incomeType = IncomeType.OTHER;
  data.financials.income.selfEmployment = '-100,00';
  const ops = buildZp1aOperations(data);
  assert.ok(ops.some(op => op.op === 'check' && op.field === 'E4'));
  assert.ok(ops.some(op => op.op === 'text' && op.value === '-100,00'));
  assert.ok(STEPS.find(s => s.id === 'deductions')!.condition!(data));
});

test('validation requires the missing income description and rejects unsupported negative amounts', () => {
  const data = structuredClone(INITIAL_DATA);
  data.financials.income.other1Amount = '350,00';
  assert.equal(getStepErrors(STEPS.find(s => s.id === 'income')!, data).other1Label, 'validation.required');
  data.financials.partnerIncome.other1Amount = '350,00';
  assert.equal(getStepErrors(STEPS.find(s => s.id === 'partnerIncome')!, data).pOther1Label, 'validation.required');
  data.financials.income.employment = '-100,00';
  assert.equal(getStepErrors(STEPS.find(s => s.id === 'income')!, data).self_employment, 'validation.nonnegative');
  data.financials.hasBank = true;
  data.financials.bankBalance = '-100,00';
  assert.equal(getStepErrors(STEPS.find(s => s.id === 'assets')!, data).bankBalance, undefined);
});

test('only the current SGB XII election can omit financial sections, including restored drafts', () => {
  const data = { ...structuredClone(INITIAL_DATA), attachBescheid: true };
  const financial = STEPS.find(s => s.id === 'income')!;
  const intro = STEPS.find(s => s.id === 'intro')!;
  for (const kind of [IncomeType.BENEFITS_SGB_II, IncomeType.BENEFITS_ASYL, IncomeType.OTHER]) {
    data.incomeType = kind;
    data.useSgbXiiExemption = true;
    assert.ok(financial.condition!(data), kind);
  }
  data.incomeType = IncomeType.BENEFITS_SGB_XII;
  data.useSgbXiiExemption = null;
  assert.ok(financial.condition!(data));
  assert.equal(getStepErrors(intro, data).useSgbXiiExemption, 'validation.required');
  data.useSgbXiiExemption = false;
  assert.ok(financial.condition!(data));
  assert.equal(getStepErrors(financial, data).self_buergergeld, 'validation.required');
  data.useSgbXiiExemption = true;
  assert.equal(financial.condition!(data), false);
  assert.ok(!buildZp1aOperations(data).some(op => op.field === 'E19'));
});

test('declaring dependents requires an identified person in every row', () => {
  const step = STEPS.find(s => s.id === 'dependents')!;
  const data = structuredClone(INITIAL_DATA);
  data.hasDependents = true;
  assert.equal(getStepErrors(step, data)['dependent-0-name'], 'validation.required');
  const row = { name: 'Alex', birthDate: '', relationship: '', monthlySupport: '', hasOwnIncome: null, ownIncomeAmount: '' };
  data.dependents = [row, { ...row, name: '  ' }];
  assert.deepEqual(getStepErrors(step, data), { 'dependent-1-name': 'validation.required' });
  data.dependents.pop();
  assert.deepEqual(getStepErrors(step, data), {});
  data.hasDependents = false;
  data.dependents = [];
  assert.deepEqual(getStepErrors(step, data), {});
});

test('B.2 must be answered when B.1 is "no": the court reads an empty B.2 as an incomplete form', async () => {
  const { STEPS, INITIAL_DATA } = await import('./wizard');
  const { getStepErrors } = await import('./formValidation');
  const step = STEPS.find((s) => s.id === 'insurance')!;
  const data = structuredClone(INITIAL_DATA);
  data.insurance.hasInsurance = false;
  data.insurance.hasLegalInsurance = null as unknown as boolean;
  assert.equal(getStepErrors(step, data).hasLegalInsurance, 'validation.required');
  data.insurance.hasLegalInsurance = false;
  assert.equal(getStepErrors(step, data).hasLegalInsurance, undefined);
});
