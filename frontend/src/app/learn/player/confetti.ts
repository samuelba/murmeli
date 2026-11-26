import { ChangeDetectionStrategy, Component } from '@angular/core';

const COLORS = ['#F7C600', '#4FA84A', '#5BB8E8', '#FF8A73', '#D3C6FF', '#FFC9E6'];

/** Gentle confetti, pure CSS. With reduced motion it is a few still sparkles. */
@Component({
  selector: 'mu-confetti',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    @for (piece of pieces; track $index) {
      <span
        class="piece"
        [style.left.%]="piece.left"
        [style.background]="piece.color"
        [style.animation-delay.ms]="piece.delay"
        [style.--drift.px]="piece.drift"
        [style.--spin.deg]="piece.spin"
      ></span>
    }
  `,
  styles: `
    :host {
      position: absolute;
      inset: 0;
      overflow: hidden;
      pointer-events: none;
    }

    .piece {
      position: absolute;
      top: -16px;
      width: 10px;
      height: 14px;
      border-radius: 3px;
      opacity: 0;
      animation: mu-confetti-fall 1.8s ease-in forwards;
    }

    @keyframes mu-confetti-fall {
      0% {
        opacity: 1;
        transform: translate(0, 0) rotate(0);
      }
      100% {
        opacity: 0;
        transform: translate(var(--drift), 320px) rotate(var(--spin));
      }
    }

    @media (prefers-reduced-motion: reduce) {
      .piece {
        top: 12%;
        opacity: 0.9;
        border-radius: 50%;
        animation: none;
      }

      .piece:nth-child(n + 7) {
        display: none;
      }
    }
  `,
})
export class Confetti {
  protected readonly pieces = Array.from({ length: 28 }, (_, index) => ({
    left: (index * 37) % 100,
    color: COLORS[index % COLORS.length],
    delay: (index % 7) * 90,
    drift: ((index * 53) % 120) - 60,
    spin: ((index * 97) % 540) - 270,
  }));
}
