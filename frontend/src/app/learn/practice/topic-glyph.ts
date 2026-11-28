import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/** Topics drawn with a short text; the others get a small picture below. */
const TEXT_GLYPHS: Readonly<Record<string, string>> = {
  count: '1 2 3',
  numbers: '7',
  compare: '3<5',
  sequence: '2 4 6',
  plus: '+',
  minus: '−',
  times: '3·4',
  division: '6:2',
  letters: 'Aa',
  'initial-sound': 'M…',
  syllables: 'Ba-na',
  'build-words': 'a b c',
};

const SVG_GLYPHS = [
  'ten-frame',
  'number-line',
  'bonds',
  'wall',
  'shapes',
  'patterns',
  'clock',
  'money',
  'read-words',
  'writing',
  'dictation',
  'sentences',
] as const;

/** The pictogram of a practice topic. Decorative: the tile names the topic in text. */
@Component({
  selector: 'mu-topic-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.data-topic]': 'topic()' },
  template: `
    @if (text(); as text) {
      <span class="text" [class.text--big]="text.length <= 2">{{ text }}</span>
    } @else {
      <svg viewBox="0 0 48 48" class="pic" [attr.data-glyph]="picture()">
        @switch (picture()) {
          @case ('ten-frame') {
            <rect x="3" y="12" width="42" height="18" rx="2" class="line" />
            @for (cell of tenFrame; track $index) {
              <circle [attr.cx]="7.2 + (cell % 5) * 8.4" [attr.cy]="cell < 5 ? 16.5 : 25.5" r="3" />
            }
          }
          @case ('number-line') {
            <path d="M3 30h42M8 25v10M18 25v10M28 25v10M38 25v10" class="line" />
            <circle cx="28" cy="17" r="4" />
          }
          @case ('bonds') {
            <path d="M8 20 24 8l16 12z" />
            <rect x="8" y="22" width="15" height="12" rx="2" class="line" />
            <rect x="25" y="22" width="15" height="12" rx="2" class="line" />
          }
          @case ('wall') {
            <rect x="15" y="8" width="18" height="10" rx="2" />
            <rect x="6" y="20" width="18" height="10" rx="2" class="line" />
            <rect x="24" y="20" width="18" height="10" rx="2" class="line" />
            <rect x="0" y="32" width="16" height="10" rx="2" class="line" />
            <rect x="16" y="32" width="16" height="10" rx="2" class="line" />
            <rect x="32" y="32" width="16" height="10" rx="2" class="line" />
          }
          @case ('shapes') {
            <circle cx="12" cy="30" r="8" />
            <path d="M26 38l8-16 8 16z" />
            <rect x="16" y="6" width="14" height="14" rx="1" class="line" />
          }
          @case ('patterns') {
            <circle cx="7" cy="24" r="5" />
            <rect x="15" y="19" width="10" height="10" rx="1" class="line" />
            <circle cx="33" cy="24" r="5" />
            <rect x="41" y="19" width="6" height="10" rx="1" class="line" />
          }
          @case ('clock') {
            <circle cx="24" cy="24" r="18" class="line" />
            <path d="M24 12v12l8 5" class="line" />
          }
          @case ('money') {
            <circle cx="20" cy="26" r="13" class="line" />
            <circle cx="30" cy="20" r="13" />
          }
          @case ('read-words') {
            <path
              d="M24 12c-6-4-13-4-19-2v26c6-2 13-2 19 2 6-4 13-4 19-2V10c-6-2-13-2-19 2z"
              class="line"
            />
            <path d="M24 12v26" class="line" />
          }
          @case ('writing') {
            <path d="M10 38l4-12 20-20 8 8-20 20z" />
            <path d="M6 44h36" class="line" />
          }
          @case ('dictation') {
            <path d="M6 18h8l10-8v28l-10-8H6z" />
            <path d="M30 16c4 4 4 12 0 16M36 11c7 7 7 19 0 26" class="line" />
          }
          @case ('sentences') {
            <path d="M6 14h36M6 24h36M6 34h22" class="line" />
          }
        }
      </svg>
    }
  `,
  styles: `
    :host {
      display: grid;
      place-items: center;
      width: 100%;
      height: 100%;
    }

    .text {
      font: 800 1.6rem/1 var(--mu-font-learn);
      letter-spacing: 0.02em;
      white-space: nowrap;

      &--big {
        font-size: 2.6rem;
      }
    }

    .pic {
      width: 78%;
      height: 78%;
      fill: currentColor;
    }

    .line {
      fill: none;
      stroke: currentColor;
      stroke-width: 3;
      stroke-linecap: round;
      stroke-linejoin: round;
    }
  `,
})
export class TopicGlyph {
  readonly topic = input.required<string>();

  protected readonly tenFrame = [0, 1, 2, 3, 4, 5, 6];
  protected readonly text = computed(() => TEXT_GLYPHS[this.topic()] ?? null);
  protected readonly picture = computed(() =>
    (SVG_GLYPHS as readonly string[]).includes(this.topic()) ? this.topic() : 'sentences',
  );
}
