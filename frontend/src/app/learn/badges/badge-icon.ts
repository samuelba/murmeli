import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { BadgeId } from './badges';

/** A round medal with the badge's emblem; not-yet-earned badges are a dashed outline. */
@Component({
  selector: 'mu-badge-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mu-badge-icon',
    '[class.mu-badge-icon--earned]': 'earned()',
    '[attr.data-badge]': 'badge()',
  },
  template: `
    <svg viewBox="0 0 64 64" aria-hidden="true">
      @if (earned()) {
        <path class="ribbon ribbon--left" d="M20 44 L14 62 L22 58 L26 63 L30 48Z" />
        <path class="ribbon ribbon--right" d="M44 44 L50 62 L42 58 L38 63 L34 48Z" />
      }
      <circle class="medal" cx="32" cy="28" r="24" />
      <circle class="rim" cx="32" cy="28" r="19" />
      @switch (badge()) {
        @case ('first-level') {
          <rect class="post" x="30" y="16" width="4" height="26" rx="1.5" />
          <path class="sign" d="M18 18 H40 L46 23.5 L40 29 H18Z" />
        }
        @case ('first-world') {
          <path class="mountain" d="M12 42 L26 22 L32 30 L38 24 L52 42Z" />
          <rect class="post" x="36.5" y="9" width="2.5" height="17" rx="1" />
          <path class="flag" d="M39 10 H49 L46 14 L49 18 H39Z" />
        }
        @case ('star-collector') {
          <path
            class="star"
            d="M32 12 L36.7 22.3 L48 23.6 L39.6 31.3 L41.9 42.4 L32 36.8 L22.1 42.4 L24.4 31.3 L16 23.6 L27.3 22.3Z"
          />
        }
        @default {
          <path class="pencil" d="M20 40 L22 33 L39 16 L45 22 L28 39Z" />
          <path class="tip" d="M20 40 L22 33 L28 39Z" />
          <path class="eraser" d="M39 16 L42 13 L48 19 L45 22Z" />
        }
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      width: 72px;
      height: 72px;
      flex: none;
    }

    svg {
      display: block;
      width: 100%;
      height: 100%;
    }

    .medal {
      fill: var(--mu-color-surface-alt);
      stroke: var(--mu-color-border-strong);
      stroke-width: 2;
      stroke-dasharray: 4 3;
    }

    .rim {
      fill: none;
      stroke: var(--mu-color-border);
      stroke-width: 1.5;
    }

    .post,
    .sign,
    .mountain,
    .flag,
    .star,
    .pencil,
    .tip,
    .eraser {
      fill: var(--mu-color-border-strong);
      opacity: 0.45;
    }

    :host(.mu-badge-icon--earned) {
      .medal {
        fill: #f7c600;
        stroke: #8f6f00;
        stroke-dasharray: none;
      }

      .rim {
        stroke: #fff3b0;
      }

      .ribbon--left {
        fill: #1f6fb8;
      }

      .ribbon--right {
        fill: #2e7d4f;
      }

      .post,
      .sign,
      .mountain,
      .flag,
      .star,
      .pencil,
      .tip,
      .eraser {
        opacity: 1;
      }

      .post {
        fill: #6b4a2b;
      }

      .sign {
        fill: #fffdf8;
        stroke: #6b4a2b;
        stroke-width: 1.5;
      }

      .mountain {
        fill: #5c6f8f;
      }

      .flag {
        fill: #e5322d;
      }

      .star {
        fill: #fffdf8;
        stroke: #8f6f00;
        stroke-width: 1.5;
      }

      .pencil {
        fill: #e5322d;
      }

      .tip {
        fill: #efdcc4;
      }

      .eraser {
        fill: #f4a7b9;
      }
    }
  `,
})
export class BadgeIcon {
  readonly badge = input.required<BadgeId>();
  readonly earned = input(false, { transform: booleanAttribute });
}
