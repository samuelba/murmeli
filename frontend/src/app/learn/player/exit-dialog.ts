import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';

export interface ExitDialogData {
  /** The label of the "leave" answer, e.g. back to the map or to the practice ground. */
  readonly confirmKey?: string;
}

/** Kid-sized "do you want to stop?" with two big answers. Closes with true to leave. */
@Component({
  selector: 'mu-exit-dialog',
  imports: [TranslocoPipe, Mascot, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-kid-mode' },
  template: `
    <div class="box" data-testid="exit-dialog">
      <mu-mascot pose="thinking" />
      <div class="title-row">
        <h2 id="exit-title" class="title">{{ 'kid.navigation.exitQuestion' | transloco }}</h2>
        <mu-speak [text]="'kid.navigation.exitQuestion' | transloco" />
      </div>
      <div class="actions">
        <button
          type="button"
          class="mu-button mu-button--sun"
          data-testid="exit-cancel"
          cdkFocusInitial
          (click)="ref.close(false)"
        >
          {{ 'learn.player.exitCancel' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="exit-confirm"
          (click)="ref.close(true)"
        >
          {{ confirmKey | transloco }}
        </button>
      </div>
    </div>
  `,
  styles: `
    .box {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      max-width: min(420px, calc(100vw - 32px));
      padding: var(--mu-space-6) var(--mu-space-5);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      color: var(--mu-color-text);
      box-shadow: var(--mu-shadow-lg);
      text-align: center;
    }

    .title-row {
      display: flex;
      align-items: center;
      gap: var(--mu-space-3);
    }

    .title {
      margin: 0;
      font-size: var(--mu-font-size-xl);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-3);
    }
  `,
})
export class ExitDialog {
  protected readonly ref = inject<DialogRef<boolean>>(DialogRef);
  protected readonly confirmKey =
    inject<ExitDialogData | null>(DIALOG_DATA, { optional: true })?.confirmKey ??
    'learn.player.exitConfirm';
}
