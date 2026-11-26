import { ChangeDetectionStrategy, Component } from '@angular/core';

/** Murmeli's pointing hand for the demo: it taps the answer. */
@Component({
  selector: 'mu-pointer',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-pointer', 'aria-hidden': 'true', 'data-testid': 'demo-pointer' },
  template: `
    <svg viewBox="0 0 48 56" focusable="false">
      <path
        d="M18 4c2.8 0 5 2.2 5 5v15.5l1.6-.9c2.6-1.4 5.8-.5 7.2 2.1l.4.7 1.3-.5c2.6-1 5.5.2 6.6 2.7l.5 1.1c2.7-.6 5.4 1 6.1 3.6l1.1 4.3c1.7 6.6-1 13.5-6.7 17.2l-1.9 1.2c-2 1.3-4.3 2-6.7 2H24c-3.9 0-7.5-2-9.6-5.3L5 37.5c-1.4-2.3-.8-5.3 1.4-6.8 2.1-1.5 5-1.1 6.7.8L13 32V9c0-2.8 2.2-5 5-5z"
        fill="#fff"
        stroke="#3b2a20"
        stroke-width="3"
        stroke-linejoin="round"
      />
    </svg>
  `,
  styles: `
    :host {
      position: absolute;
      right: -14px;
      bottom: -22px;
      z-index: 3;
      width: 44px;
      height: 52px;
      pointer-events: none;
      filter: drop-shadow(0 3px 2px rgb(0 0 0 / 0.3));
      animation: mu-tap 1.2s var(--mu-ease-brand) infinite;
    }

    svg {
      width: 100%;
      height: 100%;
    }

    @keyframes mu-tap {
      0%,
      100% {
        transform: translate(10px, 12px) rotate(-12deg);
      }
      45% {
        transform: translate(0, 0) rotate(-12deg) scale(0.92);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host {
        animation: none;
        transform: rotate(-12deg);
      }
    }
  `,
})
export class Pointer {}
