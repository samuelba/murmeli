import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  booleanAttribute,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AVATAR_BACKGROUNDS,
  PIN_LENGTH,
  PIN_PICTURES,
  partName,
  pinPictureUrl,
} from '../../core/avatars/avatar-catalog';
import { LanguageService } from '../../core/i18n/language.service';
import { Icon } from '../icon/icon';

let nextId = 0;

/**
 * 3×3 picture PIN. While `disabled`, the buttons stay focusable (aria-disabled) so keyboard
 * and screen-reader focus is never lost; taps are ignored.
 */
@Component({
  selector: 'mu-pin-pad',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './pin-pad.html',
  styleUrl: './pin-pad.scss',
})
export class PinPad {
  private readonly language = inject(LanguageService).language;
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private shakeTimer: ReturnType<typeof setTimeout> | undefined;

  readonly disabled = input(false, { transform: booleanAttribute });
  readonly labelledBy = input<string | null>(null);
  readonly completed = output<number[]>();

  protected readonly hintId = `pin-pad-hint-${nextId++}`;
  protected readonly length = PIN_LENGTH;
  protected readonly entered = signal<number[]>([]);
  protected readonly shaking = signal(false);
  protected readonly rejected = signal(false);
  protected readonly dots = computed(() =>
    Array.from({ length: PIN_LENGTH }, (_, index) => index < this.entered().length),
  );
  protected readonly pictures = computed(() =>
    PIN_PICTURES.map((picture, index) => ({
      index,
      number: index + 1,
      src: pinPictureUrl(index),
      name: partName(picture, this.language()),
      background: AVATAR_BACKGROUNDS[index],
    })),
  );

  constructor() {
    inject(DestroyRef).onDestroy(() => clearTimeout(this.shakeTimer));
  }

  select(index: number): void {
    if (this.disabled() || this.entered().length >= PIN_LENGTH) {
      return;
    }
    this.rejected.set(false);
    const next = [...this.entered(), index];
    this.entered.set(next);
    if (next.length === PIN_LENGTH) {
      this.completed.emit(next);
    }
  }

  undo(): void {
    if (!this.disabled()) {
      this.entered.update((entered) => entered.slice(0, -1));
    }
  }

  reset(): void {
    this.entered.set([]);
    this.rejected.set(false);
  }

  reject(): void {
    clearTimeout(this.shakeTimer);
    this.entered.set([]);
    this.rejected.set(true);
    this.shaking.set(true);
    this.shakeTimer = setTimeout(() => this.shaking.set(false), 600);
    this.host.nativeElement.querySelector<HTMLButtonElement>('.picture')?.focus();
  }

  protected onKey(event: KeyboardEvent): void {
    const digit = Number(event.key);
    if (Number.isInteger(digit) && digit >= 1 && digit <= 9) {
      event.preventDefault();
      this.select(digit - 1);
    } else if (event.key === 'Backspace') {
      event.preventDefault();
      this.undo();
    }
  }
}
