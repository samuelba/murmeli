import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  signal,
  inject,
  input,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  FormBuilder,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  PASSWORD_MIN,
  fieldErrorKey,
  matchesSibling,
  passwordValidators,
} from '../../core/forms/validators';
import { PasswordStrengthMeter } from '../password-strength/password-strength';

export type NewPasswordGroup = FormGroup<{
  password: FormControl<string>;
  confirm: FormControl<string>;
}>;

export function newPasswordGroup(fb: FormBuilder): NewPasswordGroup {
  return fb.nonNullable.group({
    password: ['', passwordValidators],
    confirm: ['', [Validators.required, matchesSibling('password')]],
  });
}

@Component({
  selector: 'mu-new-password',
  imports: [
    ReactiveFormsModule,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatHint,
    TranslocoPipe,
    PasswordStrengthMeter,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="fields" [formGroup]="group()">
      <mat-form-field appearance="outline">
        <mat-label>{{ labelKey() | transloco }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="new-password"
          formControlName="password"
          data-testid="new-password"
        />
        <mat-hint>{{ 'password.hint' | transloco: { min: min } }}</mat-hint>
        <mat-error>{{
          fieldError(group().controls.password) ?? '' | transloco: { min: min }
        }}</mat-error>
      </mat-form-field>
      <mu-password-strength [password]="password()" />
      <mat-form-field appearance="outline">
        <mat-label>{{ 'fields.passwordConfirm' | transloco }}</mat-label>
        <input
          matInput
          type="password"
          autocomplete="new-password"
          formControlName="confirm"
          data-testid="new-password-confirm"
        />
        <mat-error>{{ fieldError(group().controls.confirm) ?? '' | transloco }}</mat-error>
      </mat-form-field>
    </div>
  `,
  styles: `
    .fields {
      display: flex;
      flex-direction: column;
      gap: var(--mu-space-2);
    }

    mat-form-field {
      width: 100%;
    }

    mu-password-strength {
      margin-top: var(--mu-space-2);
    }
  `,
})
export class NewPasswordFields implements OnInit {
  private readonly destroyRef = inject(DestroyRef);

  readonly group = input.required<NewPasswordGroup>();
  readonly labelKey = input('fields.newPassword');

  protected readonly min = PASSWORD_MIN;
  protected readonly fieldError = fieldErrorKey;
  protected readonly password = signal('');

  ngOnInit(): void {
    const { password, confirm } = this.group().controls;
    this.password.set(password.value);
    password.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((value) => {
      this.password.set(value);
      confirm.updateValueAndValidity({ emitEvent: false });
    });
  }
}
