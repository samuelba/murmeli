import { FormControl, FormGroup, Validators } from '@angular/forms';
import { applyServerFieldErrors } from './server-errors';
import {
  exactTextValidator,
  fieldErrorKey,
  matchesSibling,
  nicknameValidator,
  passwordStrength,
} from './validators';

describe('form helpers', () => {
  it.each([
    ['', 0],
    ['short', 1],
    ['aaaaaaaaaaaa', 1],
    ['password1234', 1],
    ['lowercaseonly', 2],
    ['Mixed-Case-12', 3],
    ['Mixed case words 2026!', 4],
  ])('rates %j as %i', (password, score) => {
    expect(passwordStrength(password)).toBe(score);
  });

  it.each([
    ['Mia', null],
    ['Léa-Sophie 2', null],
    ['', null],
    ['<script>', { nickname: true }],
    ['a'.repeat(21), { nickname: true }],
  ])('validates nickname %j', (value, expected) => {
    expect(nicknameValidator(new FormControl(value))).toEqual(expected);
  });

  it('compares a field with its sibling', () => {
    const group = new FormGroup({
      password: new FormControl('one'),
      confirm: new FormControl('two', matchesSibling('password')),
    });
    expect(group.controls.confirm.errors).toEqual({ mismatch: true });
    group.controls.confirm.setValue('one');
    expect(group.controls.confirm.errors).toBeNull();
  });

  it('checks typed confirmation text', () => {
    expect(exactTextValidator('DELETE')(new FormControl('DELETE'))).toBeNull();
    expect(exactTextValidator('DELETE')(new FormControl('delete'))).toEqual({ confirmText: true });
  });

  it('picks the most relevant error key', () => {
    expect(fieldErrorKey(null)).toBeNull();
    expect(fieldErrorKey(new FormControl('x'))).toBeNull();
    expect(fieldErrorKey(new FormControl('', Validators.required))).toBe('forms.required');
    expect(fieldErrorKey(new FormControl('a', Validators.email))).toBe('forms.email');
    expect(fieldErrorKey(new FormControl('a', Validators.minLength(3)))).toBe(
      'forms.passwordTooShort',
    );
    const custom = new FormControl('');
    custom.setErrors({ weird: true });
    expect(fieldErrorKey(custom)).toBe('forms.invalid');
  });

  it('maps server validation details onto controls', () => {
    const form = new FormGroup({
      email: new FormControl(''),
      passwords: new FormGroup({ password: new FormControl('') }),
    });
    const error = {
      status: 400,
      code: 'VALIDATION_FAILED',
      message: 'x',
      details: [
        { field: 'email', constraints: ['isEmail'], messages: [] },
        { field: 'password', constraints: ['minLength'], messages: [] },
        { field: 'unknown', constraints: [], messages: [] },
      ],
    };
    expect(applyServerFieldErrors(form, error, { password: 'passwords.password' })).toBe(true);
    expect(form.get('email')?.errors).toEqual({ server: true });
    expect(form.get('passwords.password')?.errors).toEqual({ server: true });
    expect(fieldErrorKey(form.get('email'))).toBe('forms.server');
  });

  it('ignores errors that are not validation failures', () => {
    const form = new FormGroup({ email: new FormControl('') });
    expect(applyServerFieldErrors(form, { status: 401, code: 'X', message: '' })).toBe(false);
    expect(applyServerFieldErrors(form, new Error('x'))).toBe(false);
  });
});
