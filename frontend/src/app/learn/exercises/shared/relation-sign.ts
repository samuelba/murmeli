import { ChangeDetectionStrategy, Component, input } from '@angular/core';

export type Relation = 'lt' | 'eq' | 'gt';

/** <, = or >. The two inequality signs are the hungry crocodile: its mouth opens toward the greater side. */
@Component({
  selector: 'mu-relation-sign',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-relation-sign', 'aria-hidden': 'true', '[attr.data-relation]': 'relation()' },
  template: `
    <svg viewBox="0 0 48 48" focusable="false">
      @if (relation() === 'eq') {
        <path class="equals" d="M8 17h32M8 31h32" />
      } @else {
        <g class="croc" [attr.transform]="relation() === 'lt' ? 'matrix(-1 0 0 1 48 0)' : null">
          <path
            class="teeth"
            d="M8.7 11 8.6 18.9 14.8 14.1ZM16 14.7 15.9 22.6 22.1 17.7ZM8.7 37 8.6 29.1 14.8 33.9ZM16 33.3 15.9 25.4 22.1 30.3Z"
          />
          <path class="jaws" d="M8 8 40 24 8 40" />
          <circle class="eye" cx="34.4" cy="11.2" r="4.6" />
          <circle class="pupil" cx="33.6" cy="11.6" r="2.1" />
        </g>
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      width: 1.3em;
      height: 1.3em;
      flex: none;
    }

    svg {
      width: 100%;
      height: 100%;
      overflow: visible;
      fill: none;
      stroke: currentColor;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .equals,
    .jaws {
      stroke-width: 6;
    }

    .teeth {
      fill: currentColor;
      stroke-width: 1.5;
    }

    .eye {
      stroke-width: 2.6;
    }

    .pupil {
      fill: currentColor;
      stroke: none;
    }
  `,
})
export class RelationSign {
  readonly relation = input.required<Relation>();
}
