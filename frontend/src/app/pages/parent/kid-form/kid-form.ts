import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatHint, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { MatRadioButton, MatRadioGroup } from '@angular/material/radio';
import { MatOption, MatSelect } from '@angular/material/select';
import { MatSlideToggle } from '@angular/material/slide-toggle';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  Kid,
  KidInput,
  READ_ALOUD_MODES,
  ReadAloud,
  START_CLASSES,
  StartClass,
} from '../../../core/api/models';
import { AuthService } from '../../../core/auth/auth.service';
import { Avatar, randomAvatar } from '../../../core/avatars/avatar-catalog';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { applyServerFieldErrors } from '../../../core/forms/server-errors';
import { fieldErrorKey, nicknameValidator } from '../../../core/forms/validators';
import { LanguageService } from '../../../core/i18n/language.service';
import { LANGUAGES } from '../../../core/i18n/languages';
import { KidsService } from '../../../core/kids/kids.service';
import { AvatarBuilder } from '../../../shared/avatar-builder/avatar-builder';
import { FormError } from '../../../shared/form-error/form-error';
import { PageCard } from '../../../shared/page-card/page-card';
import { PinSetup } from '../pin-setup/pin-setup';

export type PinMode = 'keep' | 'none' | 'set';
export const DAILY_LIMITS = [0, 15, 20, 30, 45, 60, 90, 120] as const;

@Component({
  selector: 'mu-kid-form',
  imports: [
    ReactiveFormsModule,
    RouterLink,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    MatHint,
    MatSelect,
    MatOption,
    MatSlideToggle,
    MatRadioGroup,
    MatRadioButton,
    TranslocoPipe,
    AvatarBuilder,
    FormError,
    PageCard,
    PinSetup,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './kid-form.html',
  styleUrl: './kid-form.scss',
})
export class KidForm implements OnInit {
  private readonly kids = inject(KidsService);
  private readonly router = inject(Router);
  private readonly id = inject(ActivatedRoute).snapshot.paramMap.get('id');

  protected readonly isNew = this.id === null;
  protected readonly classes = START_CLASSES;
  protected readonly languages = LANGUAGES;
  protected readonly readAloudModes = READ_ALOUD_MODES;
  protected readonly limits = DAILY_LIMITS;
  protected readonly fieldError = fieldErrorKey;
  protected readonly avatar = signal<Avatar>(randomAvatar());
  protected readonly existing = signal<Kid | null>(null);
  protected readonly pinMode = signal<PinMode>('none');
  protected readonly newPin = signal<number[] | null>(null);
  protected readonly pinMissing = signal(false);
  protected readonly loading = signal(!this.isNew);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly form = inject(FormBuilder).nonNullable.group({
    nickname: ['', [Validators.required, Validators.maxLength(20), nicknameValidator]],
    startClass: ['KG1' as StartClass, Validators.required],
    language: [
      inject(AuthService).user()?.locale ?? inject(LanguageService).language(),
      Validators.required,
    ],
    dailyLimitMinutes: [0],
    soundEnabled: [true],
    readAloud: ['auto' as ReadAloud],
  });

  async ngOnInit(): Promise<void> {
    if (this.id === null) {
      return;
    }
    try {
      const kid = await this.kids.get(this.id);
      if (!kid) {
        this.error.set({ key: 'errors.KID_NOT_FOUND' });
        return;
      }
      this.existing.set(kid);
      this.avatar.set(kid.avatar);
      this.pinMode.set(kid.hasPin ? 'keep' : 'none');
      this.form.setValue({
        nickname: kid.nickname,
        startClass: kid.startClass,
        language: kid.language,
        dailyLimitMinutes: kid.dailyLimitMinutes ?? 0,
        soundEnabled: kid.soundEnabled,
        readAloud: kid.readAloud,
      });
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  protected setPinMode(mode: PinMode): void {
    this.pinMode.set(mode);
    this.newPin.set(null);
    this.pinMissing.set(false);
  }

  protected onPin(pin: number[] | null): void {
    this.newPin.set(pin);
    if (pin) {
      this.pinMissing.set(false);
    }
  }

  protected async save(): Promise<void> {
    this.form.markAllAsTouched();
    this.pinMissing.set(this.pinMode() === 'set' && this.newPin() === null);
    if (this.form.invalid || this.pinMissing() || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      const input = this.toInput();
      const existing = this.existing();
      await (existing ? this.kids.update(existing.id, input) : this.kids.create(input));
      await this.router.navigateByUrl('/parent');
    } catch (error) {
      applyServerFieldErrors(this.form, error);
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }

  private toInput(): KidInput {
    const value = this.form.getRawValue();
    const base: KidInput = {
      nickname: value.nickname.trim(),
      avatar: this.avatar(),
      startClass: value.startClass,
      language: value.language,
      dailyLimitMinutes: value.dailyLimitMinutes > 0 ? value.dailyLimitMinutes : null,
      soundEnabled: value.soundEnabled,
      readAloud: value.readAloud,
    };
    switch (this.pinMode()) {
      case 'set':
        return { ...base, pin: this.newPin() };
      case 'none':
        return this.existing()?.hasPin ? { ...base, pin: null } : base;
      default:
        return base;
    }
  }
}
