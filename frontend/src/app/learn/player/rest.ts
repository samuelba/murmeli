import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { AudioService } from '../../core/audio/audio.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { KidsService } from '../../core/kids/kids.service';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';

/** The daily time limit is reached: Murmeli sleeps, and the way leads back to the profiles. */
@Component({
  selector: 'mu-rest',
  imports: [TranslocoPipe, FormError, Icon, Mascot, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rest" aria-labelledby="rest-title" data-testid="daily-limit">
      <div class="moon" aria-hidden="true"></div>
      <mu-mascot class="mascot" pose="sleeping" />
      <div class="title-row">
        <h1 id="rest-title" class="title" tabindex="-1" data-testid="page-title">
          {{ 'kid.navigation.rest' | transloco }}
        </h1>
        <mu-speak [text]="'kid.navigation.rest' | transloco" [segments]="lines()" />
      </div>
      <p class="more">{{ 'kid.navigation.restMore' | transloco }}</p>
      <mu-form-error [error]="error()" />
      <button
        type="button"
        class="mu-button mu-button--sun"
        data-testid="rest-back"
        [disabled]="busy()"
        (click)="back()"
      >
        <mu-icon name="family" />
        <span>{{ 'learn.rest.back' | transloco }}</span>
      </button>
    </section>
  `,
  styles: `
    .rest {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      padding: var(--mu-space-7) var(--mu-space-4) var(--mu-space-6);
      overflow: hidden;
      border-radius: var(--mu-radius-chunky);
      background: linear-gradient(180deg, #1b2b55 0%, #2d3f73 70%, #3d5590 100%);
      color: #f3f6fb;
      text-align: center;
    }

    .moon {
      position: absolute;
      top: 24px;
      right: 32px;
      width: 56px;
      height: 56px;
      border-radius: 50%;
      box-shadow: -12px 8px 0 0 #fff1a0;
    }

    .mascot {
      width: 180px;
      height: 180px;
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

    .more {
      max-width: 32ch;
      margin: 0;
      font-size: var(--mu-font-size-lg);
      font-weight: 700;
    }
  `,
})
export class Rest {
  private readonly kids = inject(KidsService);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);
  protected readonly lines = signal<readonly string[]>([
    this.transloco.translate('kid.navigation.rest'),
    this.transloco.translate('kid.navigation.restMore'),
  ]);

  constructor() {
    const audio = inject(AudioService);
    queueMicrotask(() => void audio.narrate(this.lines()));
  }

  protected async back(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.kids.deactivate();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
