import { ChangeDetectionStrategy, Component, output, signal, viewChild } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { PinPad } from '../../../shared/pin-pad/pin-pad';

type Stage = 'first' | 'confirm' | 'done';

@Component({
  selector: 'mu-pin-setup',
  imports: [TranslocoPipe, Icon, PinPad],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="pin-setup" data-testid="pin-setup">
      <p id="pin-setup-label" class="prompt" aria-live="polite" data-testid="pin-setup-prompt">
        @if (stage() === 'done') {
          <mu-icon name="success" />
        }
        {{ 'pinSetup.' + stage() | transloco }}
      </p>
      @if (mismatch()) {
        <p class="field-error" role="alert">{{ 'pinSetup.mismatch' | transloco }}</p>
      }
      @if (stage() === 'done') {
        <button type="button" class="mu-button mu-button--ghost" (click)="restart()">
          {{ 'pinSetup.again' | transloco }}
        </button>
      } @else {
        <mu-pin-pad labelledBy="pin-setup-label" (completed)="onCompleted($event)" />
      }
    </div>
  `,
  styles: `
    .pin-setup {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-3);
      padding: var(--mu-space-4);
      border-radius: var(--mu-radius-lg);
      background: var(--mu-color-surface-alt);
    }

    .prompt {
      display: flex;
      align-items: center;
      gap: var(--mu-space-2);
      margin: 0;
      font-weight: 800;
      text-align: center;
    }

    mu-icon {
      color: var(--mu-color-meadow-strong);
    }
  `,
})
export class PinSetup {
  private readonly pad = viewChild(PinPad);
  private first: number[] = [];

  readonly pin = output<number[] | null>();

  protected readonly stage = signal<Stage>('first');
  protected readonly mismatch = signal(false);

  protected onCompleted(pin: number[]): void {
    if (this.stage() === 'first') {
      this.first = pin;
      this.mismatch.set(false);
      this.stage.set('confirm');
      this.pad()?.reset();
      return;
    }
    if (pin.join() === this.first.join()) {
      this.stage.set('done');
      this.pin.emit(pin);
      return;
    }
    this.mismatch.set(true);
    this.first = [];
    this.stage.set('first');
    this.pad()?.reject();
  }

  protected restart(): void {
    this.first = [];
    this.mismatch.set(false);
    this.stage.set('first');
    this.pin.emit(null);
  }
}
