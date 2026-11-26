import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  DestroyRef,
  booleanAttribute,
  inject,
  input,
  output,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { KeypadKey, keyFromEvent } from './number-entry';

const ROWS: readonly (readonly (KeypadKey | null)[])[] = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  [null, '0', 'back'],
];

/**
 * A big 0–9 pad with delete, laid out like a phone. Confirming is the exercise's one labeled
 * "Prüfen" button, so the pad has no OK key; with `captureKeys`, the digit keys, Backspace and
 * Enter (as OK) of a hardware keyboard work too (unless focus is in a text field).
 */
@Component({
  selector: 'mu-keypad',
  imports: [TranslocoPipe, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="keypad" role="group" [attr.aria-label]="'learn.ex.keypad.label' | transloco">
      @for (row of rows; track $index) {
        @for (key of row; track $index) {
          @switch (key) {
            @case ('back') {
              <button
                type="button"
                class="key key--back"
                data-testid="key-back"
                [attr.aria-label]="'learn.ex.keypad.delete' | transloco"
                [attr.aria-disabled]="locked() ? 'true' : null"
                (click)="press(key)"
              >
                <mu-icon name="backspace" />
              </button>
            }
            @case (null) {
              <span class="gap" aria-hidden="true"></span>
            }
            @default {
              <button
                type="button"
                class="key"
                [attr.data-testid]="'key-' + key"
                [attr.aria-disabled]="locked() ? 'true' : null"
                (click)="press(key)"
              >
                {{ key }}
              </button>
            }
          }
        }
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: min(100%, 320px);
    }

    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: var(--mu-space-2);
    }

    .key {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 64px;
      min-width: 64px;
      border: 3px solid var(--mu-color-border-strong);
      border-radius: var(--mu-radius-rounded);
      background: var(--mu-color-surface-raised);
      color: var(--mu-color-text);
      font: 800 2rem/1 var(--mu-font-learn);
      cursor: pointer;
      box-shadow: 0 5px 0 var(--mu-color-border-strong);
      touch-action: manipulation;

      mu-icon {
        width: 34px;
        height: 34px;
      }

      &:active:not([aria-disabled='true']) {
        transform: translateY(4px);
        box-shadow: 0 1px 0 var(--mu-color-border-strong);
      }

      &[aria-disabled='true'] {
        opacity: 0.55;
        cursor: default;
      }
    }

    .key--back {
      background: var(--mu-color-marmot-soft);
    }
  `,
})
export class Keypad {
  private readonly document = inject(DOCUMENT);

  readonly locked = input(false, { transform: booleanAttribute });
  readonly canSubmit = input(true);
  readonly captureKeys = input(true, { transform: booleanAttribute });
  readonly pressed = output<KeypadKey>();

  protected readonly rows = ROWS;

  constructor() {
    const listener = (event: KeyboardEvent) => this.onKey(event);
    this.document.addEventListener('keydown', listener);
    inject(DestroyRef).onDestroy(() => this.document.removeEventListener('keydown', listener));
  }

  protected press(key: KeypadKey): void {
    if (this.locked() || (key === 'ok' && !this.canSubmit())) {
      return;
    }
    this.pressed.emit(key);
  }

  private onKey(event: KeyboardEvent): void {
    if (
      !this.captureKeys() ||
      event.defaultPrevented ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    const target = event.target instanceof Element ? event.target : null;
    if (
      target?.closest('input, textarea, select, [contenteditable="true"], [role="dialog"]') ||
      this.document.querySelector('.cdk-overlay-container [role="dialog"]')
    ) {
      return;
    }
    const key = keyFromEvent(event);
    if (!key || (key === 'ok' && target?.closest('button'))) {
      return;
    }
    event.preventDefault();
    this.press(key);
  }
}
