import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  OnInit,
  afterNextRender,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButton } from '@angular/material/button';
import { MatError, MatFormField, MatLabel } from '@angular/material/form-field';
import { MatInput } from '@angular/material/input';
import { TranslocoPipe } from '@jsverse/transloco';
import { TotpSetup } from '../../../core/api/models';
import { AccountService } from '../../../core/account/account.service';
import { AuthService } from '../../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../../core/errors/error-message';
import { FormError } from '../../../shared/form-error/form-error';
import { Icon } from '../../../shared/icon/icon';
import { RecoveryCodesView } from './recovery-codes';

const CODE = [Validators.required, Validators.pattern(/^\d{6}$/)];

@Component({
  selector: 'mu-totp-section',
  imports: [
    ReactiveFormsModule,
    MatButton,
    MatFormField,
    MatLabel,
    MatInput,
    MatError,
    TranslocoPipe,
    FormError,
    Icon,
    RecoveryCodesView,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './totp-section.html',
  styles: `
    .qr {
      display: flex;
      flex-wrap: wrap;
      gap: var(--mu-space-4);
      align-items: center;

      img {
        width: 200px;
        height: 200px;
        padding: var(--mu-space-2);
        border-radius: var(--mu-radius-md);
        background: #ffffff;
      }
    }

    .secret {
      flex: 1;
      min-width: 200px;
    }
  `,
})
export class TotpSection implements OnInit {
  private readonly account = inject(AccountService);
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly user = inject(AuthService).user;
  private readonly injector = inject(Injector);
  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');

  readonly required = input(false);

  protected readonly enabled = computed(() => this.user()?.totpEnabled ?? false);
  protected readonly setup = signal<TotpSetup | null>(null);
  protected readonly codes = signal<readonly string[] | null>(null);
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly secret = computed(() => {
    const url = this.setup()?.otpauthUrl;
    if (!url) {
      return '';
    }
    try {
      return new URL(url).searchParams.get('secret') ?? '';
    } catch {
      return '';
    }
  });
  protected readonly enableCode = this.fb.control('', CODE);
  protected readonly disableForm = this.fb.group({
    password: ['', Validators.required],
    code: ['', CODE],
  });
  protected readonly regenerateCode = this.fb.control('', CODE);

  ngOnInit(): void {
    if (this.required()) {
      afterNextRender(
        () => {
          const heading = this.heading()?.nativeElement;
          heading?.scrollIntoView?.({ block: 'start' });
          heading?.focus();
        },
        { injector: this.injector },
      );
    }
  }

  protected start(): Promise<void> {
    return this.run(async () => {
      this.codes.set(null);
      this.setup.set(await this.account.totpSetup());
    });
  }

  protected enable(): Promise<void> {
    this.enableCode.markAsTouched();
    if (this.enableCode.invalid) {
      return Promise.resolve();
    }
    return this.run(async () => {
      this.codes.set(await this.account.totpEnable(this.enableCode.value));
      this.setup.set(null);
      this.enableCode.reset();
    });
  }

  protected disable(): Promise<void> {
    this.disableForm.markAllAsTouched();
    if (this.disableForm.invalid) {
      return Promise.resolve();
    }
    const { password, code } = this.disableForm.getRawValue();
    return this.run(async () => {
      await this.account.totpDisable(password, code);
      this.codes.set(null);
      this.disableForm.reset();
    });
  }

  protected regenerate(): Promise<void> {
    this.regenerateCode.markAsTouched();
    if (this.regenerateCode.invalid) {
      return Promise.resolve();
    }
    return this.run(async () => {
      this.codes.set(await this.account.regenerateRecoveryCodes(this.regenerateCode.value));
      this.regenerateCode.reset();
    });
  }

  protected cancel(): void {
    this.setup.set(null);
    this.error.set(null);
  }

  private async run(action: () => Promise<void>): Promise<void> {
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.error.set(null);
    try {
      await action();
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
