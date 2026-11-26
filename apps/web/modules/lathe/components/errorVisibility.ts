import type { StepErrors } from '../formValidation';

const NONE: ReadonlySet<string> = new Set();

/**
 * Which of a step's errors are SHOWN — presentation only. What is valid is
 * decided by getStepErrors and is not touched here: an unanswered required
 * field still blocks Next from the first moment.
 *
 * An error appears once the user has left that field (touched) or has
 * tried to go on from the step (attempted). That holds for "fill in this
 * field" (nobody has been asked yet) and for format errors too: a date or
 * amount that is still being typed is not wrong yet, and an error popping
 * up and vanishing under the field moved everything below it.
 */
export function visibleErrors(
  errors: StepErrors,
  touched: ReadonlySet<string> = NONE,
  attempted = false,
  /** The field the person is typing in: its format error waits for them. */
  editing: string | null = null,
): StepErrors {
  if (attempted) {
    if (!editing || errors[editing] === undefined || errors[editing] === 'validation.required') return errors;
    const { [editing]: _typing, ...rest } = errors;
    return rest;
  }
  const shown: StepErrors = {};
  for (const [id, code] of Object.entries(errors)) {
    if (touched.has(id)) shown[id] = code;
  }
  return shown;
}
