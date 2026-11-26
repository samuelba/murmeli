import { AbstractControl, ValidationErrors, ValidatorFn, Validators } from '@angular/forms';

export const PASSWORD_MIN = 10;
export const PASSWORD_MAX = 128;
export const NICKNAME_PATTERN = /^[\p{L}\p{N} -]{1,20}$/u;

export const passwordValidators: ValidatorFn[] = [
  Validators.required,
  Validators.minLength(PASSWORD_MIN),
  Validators.maxLength(PASSWORD_MAX),
];

export const emailValidators: ValidatorFn[] = [
  Validators.required,
  Validators.email,
  Validators.maxLength(254),
];

export function matchesSibling(sibling: string): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(sibling)?.value as unknown;
    return control.value && control.value !== other ? { mismatch: true } : null;
  };
}

export function nicknameValidator(control: AbstractControl): ValidationErrors | null {
  const value = typeof control.value === 'string' ? control.value.trim() : '';
  return value === '' || NICKNAME_PATTERN.test(value) ? null : { nickname: true };
}

export function exactTextValidator(expected: string): ValidatorFn {
  return (control) => (control.value === expected ? null : { confirmText: true });
}

/** Translation key for the first error on a control, for <mat-error>. */
export function fieldErrorKey(control: AbstractControl | null): string | null {
  const errors = control?.errors;
  if (!errors) {
    return null;
  }
  const order: [string, string][] = [
    ['required', 'forms.required'],
    ['email', 'forms.email'],
    ['mismatch', 'forms.mismatch'],
    ['minlength', 'forms.passwordTooShort'],
    ['maxlength', 'forms.tooLong'],
    ['nickname', 'forms.nickname'],
    ['pattern', 'forms.pattern'],
    ['min', 'forms.min'],
    ['max', 'forms.max'],
    ['confirmText', 'forms.confirmText'],
    ['server', 'forms.server'],
  ];
  return order.find(([key]) => key in errors)?.[1] ?? 'forms.invalid';
}

export type PasswordStrength = 0 | 1 | 2 | 3 | 4;

export function passwordStrength(password: string): PasswordStrength {
  if (password.length < PASSWORD_MIN) {
    return password.length === 0 ? 0 : 1;
  }
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length;
  const repetitive =
    /^(.)\1+$/.test(password) || /(0123|1234|2345|abcd|qwert|passw)/i.test(password);
  let score = 2 + (password.length >= 14 ? 1 : 0) + (classes >= 3 ? 1 : 0);
  if (repetitive) {
    score = 1;
  }
  return Math.min(4, score) as PasswordStrength;
}
