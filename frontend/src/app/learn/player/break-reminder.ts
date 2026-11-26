import { ChangeDetectionStrategy, Component, inject, output } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AudioService } from '../../core/audio/audio.service';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';

/** Between two items after a long stretch of play: a gentle, skippable break suggestion. */
@Component({
  selector: 'mu-break-reminder',
  imports: [TranslocoPipe, Mascot, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="break" aria-labelledby="break-title" data-testid="break-reminder">
      <mu-mascot class="mascot" pose="cheering" />
      <div class="title-row">
        <h1 id="break-title" class="title" tabindex="-1">
          {{ 'kid.navigation.breakTime' | transloco }}
        </h1>
        <mu-speak [text]="'kid.navigation.breakTime' | transloco" />
      </div>
      <div class="mu-learn-actions">
        <button
          type="button"
          class="mu-button mu-button--sun mu-button--big"
          data-testid="break-continue"
          (click)="keepPlaying.emit()"
        >
          {{ 'learn.player.breakContinue' | transloco }}
        </button>
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="break-pause"
          (click)="breakTaken.emit()"
        >
          {{ 'learn.player.breakPause' | transloco }}
        </button>
      </div>
    </section>
  `,
  styles: `
    .break {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      min-height: 60dvh;
      justify-content: center;
      padding: var(--mu-space-6) var(--mu-space-4);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);
      text-align: center;
    }

    .mascot {
      width: 160px;
      height: 160px;
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
  `,
})
export class BreakReminder {
  readonly keepPlaying = output<void>();
  readonly breakTaken = output<void>();

  constructor() {
    const text = inject(TranslocoService).translate('kid.navigation.breakTime');
    void inject(AudioService).narrate(text);
  }
}
