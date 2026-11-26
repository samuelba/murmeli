import { AbstractControl } from '@angular/forms';
import { ApiError, isApiError } from '../http/api-error';

/**
 * Marks controls named in a VALIDATION_FAILED response with a `server` error so <mat-error>
 * can show them next to the field. Returns true when at least one field matched.
 */
export function applyServerFieldErrors(
  form: AbstractControl,
  error: unknown,
  fieldMap: Readonly<Record<string, string>> = {},
): boolean {
  if (!isApiError(error) || error.code !== 'VALIDATION_FAILED') {
    return false;
  }
  let matched = false;
  for (const detail of (error as ApiError).details ?? []) {
    const control = form.get(fieldMap[detail.field] ?? detail.field);
    if (control) {
      control.setErrors({ ...control.errors, server: true });
      control.markAsTouched();
      matched = true;
    }
  }
  return matched;
}
