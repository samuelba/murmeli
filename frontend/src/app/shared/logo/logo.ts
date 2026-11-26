import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';

@Component({
  selector: 'mu-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mu-logo',
    '[class.mu-logo--animated]': 'animated()',
    'aria-hidden': 'true',
  },
  template: `
    <svg viewBox="0 0 64 64" width="100%" height="100%" focusable="false">
      <path d="M2 56 Q32 30 62 56 Z" fill="var(--mu-color-meadow)" />
      <ellipse cx="32" cy="50" rx="13" ry="5" fill="var(--mu-color-marmot-soft)" />
      <g class="mu-logo__marmot">
        <ellipse cx="32" cy="36" rx="11" ry="13" fill="var(--mu-color-marmot)" />
        <circle cx="27.5" cy="32" r="2" fill="var(--mu-color-night)" />
        <circle cx="36.5" cy="32" r="2" fill="var(--mu-color-night)" />
        <ellipse cx="32" cy="38" rx="3" ry="2" fill="var(--mu-color-night)" />
      </g>
    </svg>
  `,
  styles: `
    :host {
      display: inline-block;
      width: 40px;
      height: 40px;
      flex: none;
    }

    svg {
      display: block;
    }

    :host(.mu-logo--animated) .mu-logo__marmot {
      animation: mu-logo-peek 5s ease-in-out infinite;
    }

    @keyframes mu-logo-peek {
      0%,
      100% {
        transform: translateY(0);
      }
      50% {
        transform: translateY(-3px);
      }
    }

    @media (prefers-reduced-motion: reduce) {
      :host(.mu-logo--animated) .mu-logo__marmot {
        animation: none;
      }
    }
  `,
})
export class Logo {
  readonly animated = input(false, { transform: booleanAttribute });
}
