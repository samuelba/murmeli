import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  inject,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { NetworkStatus } from '../../core/pwa/network-status';
import { Mascot } from '../mascot/mascot';
import { Speak } from '../speak/speak';

/** Shown to kids instead of the page while the device is offline: Murmeli naps and waits. */
@Component({
  selector: 'mu-offline-screen',
  imports: [TranslocoPipe, Mascot, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-kid-mode' },
  template: `
    <section class="offline" aria-labelledby="offline-title" data-testid="offline-screen">
      <mu-mascot class="mascot" pose="sleeping" />
      <div class="title-row">
        <h1 id="offline-title" class="title" tabindex="-1" data-testid="offline-title">
          {{ 'kid.navigation.offline' | transloco }}
        </h1>
        <mu-speak [text]="'kid.navigation.offline' | transloco" />
      </div>
      <button
        type="button"
        class="mu-button mu-button--sun mu-button--big"
        data-testid="offline-retry"
        (click)="network.recheck()"
      >
        {{ 'offline.retry' | transloco }}
      </button>
    </section>
  `,
  styles: `
    :host {
      display: block;
    }

    .offline {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-4);
      max-width: 560px;
      margin-inline: auto;
      padding: var(--mu-space-6) var(--mu-space-4);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);
      text-align: center;
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
      line-height: 1.25;

      &:focus {
        outline: none;
      }
    }
  `,
})
export class OfflineScreen {
  protected readonly network = inject(NetworkStatus);

  constructor() {
    const host = inject<ElementRef<HTMLElement>>(ElementRef);
    afterNextRender(() => host.nativeElement.querySelector<HTMLElement>('h1')?.focus());
  }
}
