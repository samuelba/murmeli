import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  effect,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { TranslocoService } from '@jsverse/transloco';
import { LanguageService } from '../../core/i18n/language.service';
import { apiUrl } from '../../core/http/api-paths';
import { ALTCHA_LOADER } from './altcha-loader';

const STRING_KEYS = [
  'ariaLinkLabel',
  'enterCode',
  'enterCodeAria',
  'error',
  'expired',
  'footer',
  'getAudioChallenge',
  'label',
  'loading',
  'reload',
  'verify',
  'verificationRequired',
  'verified',
  'verifying',
  'waitAlert',
] as const;

interface AltchaElement extends HTMLElement {
  configure?: (config: Record<string, unknown>) => Promise<void>;
  reset?: () => void;
}

interface StateChange {
  readonly state?: string;
  readonly payload?: string | null;
}

@Component({
  selector: 'mu-altcha',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (ready()) {
      <altcha-widget
        #widget
        data-testid="altcha"
        auto="onfocus"
        name="altcha"
        [attr.challenge]="challengeUrl"
        [attr.language]="widgetLanguage()"
        (statechange)="onStateChange($event)"
      ></altcha-widget>
    }
  `,
  styles: `
    :host {
      display: block;
      --altcha-max-width: 100%;
      --altcha-checkbox-size: 48px;
      --altcha-border-radius: var(--mu-radius-md);
      --altcha-color-base: var(--mu-color-surface);
      --altcha-color-base-content: var(--mu-color-text);
      --altcha-color-neutral: var(--mu-color-border);
      --altcha-color-neutral-content: var(--mu-color-text-muted);
      --altcha-color-primary: var(--mu-color-secondary);
      --altcha-color-primary-content: var(--mu-color-on-secondary);
      --altcha-color-error: var(--mu-color-error-text);
      --altcha-checkbox-border-color: var(--mu-color-text-muted);
    }
  `,
})
export class Altcha {
  private readonly load = inject(ALTCHA_LOADER);
  private readonly transloco = inject(TranslocoService);
  private readonly language = inject(LanguageService).language;
  private readonly widget = viewChild<ElementRef<AltchaElement>>('widget');

  readonly verified = output<string | null>();

  protected readonly challengeUrl = apiUrl('auth/altcha');
  protected readonly ready = signal(false);
  protected readonly widgetLanguage = signal('de');

  constructor() {
    this.load()
      .then(() => this.ready.set(true))
      .catch(() => this.ready.set(false));

    effect(() => {
      const language = this.language();
      const element = this.widget()?.nativeElement;
      if (!this.ready() || !element) {
        return;
      }
      const code = language.slice(0, 2);
      this.registerStrings(code);
      this.widgetLanguage.set(code);
      void element.configure?.({ language: code, hideFooter: true, hideLogo: true });
    });
  }

  reset(): void {
    this.widget()?.nativeElement.reset?.();
    this.verified.emit(null);
  }

  protected onStateChange(event: Event): void {
    const detail = (event as CustomEvent<StateChange>).detail ?? {};
    this.verified.emit(detail.state === 'verified' && detail.payload ? detail.payload : null);
  }

  private registerStrings(code: string): void {
    const altcha = (globalThis as { $altcha?: { i18n?: { set(n: string, v: object): void } } })
      .$altcha;
    if (!altcha?.i18n) {
      return;
    }
    const strings = Object.fromEntries(
      STRING_KEYS.map((key) => [key, this.transloco.translate(`altcha.${key}`)]),
    );
    altcha.i18n.set(code, strings);
  }
}
