import type { LatheFormData, WizardStep } from './types';
import { isPastGermanDate, isValidGermanDate, parseEuroDE } from './validation';

export type StepErrors = Record<string, string>;
export const fieldValue = (data: LatheFormData, path: string): unknown =>
  path.split('.').reduce<unknown>((value, key) =>
    value && typeof value === 'object' ? (value as Record<string, unknown>)[key] : undefined, data);

/** Validate visible answers without erasing or reinterpreting the entered text. */
export function getStepErrors(step: WizardStep, data: LatheFormData): StepErrors {
  const errors: StepErrors = {};
  for (const field of step.fields) {
    if (field.visibleIf && !field.visibleIf(data)) continue;
    const value = fieldValue(data, field.path);
    const empty = value === null || value === undefined || (typeof value === 'string' && !value.trim());
    if ((field.required || field.requiredIf?.(data)) && empty) {
      errors[field.id] = 'validation.required';
    } else if (!empty && field.type === 'euro') {
      const amount = typeof value === 'string' ? parseEuroDE(value) : NaN;
      if (!Number.isFinite(amount)) errors[field.id] = 'validation.amount';
      else if (!field.allowNegative && amount < 0) errors[field.id] = 'validation.nonnegative';
    } else if (!empty && field.type === 'date') {
      if (typeof value !== 'string' || !(field.pastOnly ? isPastGermanDate(value) : isValidGermanDate(value))) {
        errors[field.id] = 'validation.date';
      }
    } else if (field.type === 'dependents') {
      if (!data.dependents.length) errors['dependent-0-name'] = 'validation.required';
      data.dependents.forEach((dep, index) => {
        if (!dep.name.trim()) errors[`dependent-${index}-name`] = 'validation.required';
        if (dep.birthDate && !isPastGermanDate(dep.birthDate)) errors[`dependent-${index}-birthDate`] = 'validation.date';
        for (const key of ['monthlySupport', 'ownIncomeAmount'] as const) {
          if (key === 'ownIncomeAmount' && !dep.hasOwnIncome) continue;
          if (dep[key] && (!Number.isFinite(parseEuroDE(dep[key])) || parseEuroDE(dep[key]) < 0)) {
            errors[`dependent-${index}-${key}`] = 'validation.nonnegative';
          }
        }
      });
    }
  }
  return errors;
}
