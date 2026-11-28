import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { PracticeTopicId } from '@murmeli/content';

export const TOPIC_GLYPHS = [
  'count',
  'numbers',
  'ten-frame',
  'compare',
  'number-line',
  'sequence',
  'bonds',
  'plus',
  'minus',
  'wall',
  'times',
  'division',
  'shapes',
  'patterns',
  'clock',
  'calendar',
  'money',
  'letters',
  'initial-sound',
  'syllables',
  'read-words',
  'build-words',
  'writing',
  'dictation',
  'sentences',
] as const satisfies readonly PracticeTopicId[];

type GlyphName = (typeof TOPIC_GLYPHS)[number];

const FALLBACK: GlyphName = 'sentences';

/** The illustration of a practice topic. Decorative: the tile names the topic in text. */
@Component({
  selector: 'mu-topic-glyph',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.data-topic]': 'topic()' },
  templateUrl: './topic-glyph.html',
  styleUrl: './topic-glyph.scss',
})
export class TopicGlyph {
  readonly topic = input.required<string>();

  protected readonly picture = computed<GlyphName>(() =>
    (TOPIC_GLYPHS as readonly string[]).includes(this.topic())
      ? (this.topic() as GlyphName)
      : FALLBACK,
  );

  protected readonly marbles = [
    { x: 13, n: 1, fill: 'c-red' },
    { x: 32, n: 2, fill: 'c-blue' },
    { x: 51, n: 3, fill: 'c-yellow' },
  ];
  protected readonly tenFrame = [0, 1, 2, 3, 4, 5, 6];
  protected readonly calendarDays = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => ({
    x: 15 + (i % 3) * 12,
    y: 30 + Math.floor(i / 3) * 8,
    fill: i === 4 ? 'c-yellow' : i % 3 === 2 ? 'c-blue' : 'c-cream',
  }));
  protected readonly stairs = [
    { x: 4, y: 40, n: 2, fill: 'c-orange' },
    { x: 24, y: 30, n: 4, fill: 'c-red' },
    { x: 44, y: 20, n: 6, fill: 'c-purple' },
  ];
  protected readonly apples = [13, 51];
  protected readonly bricks = [
    { x: 22, y: 12, n: 8, fill: 'c-yellow' },
    { x: 12, y: 26, n: 3, fill: 'c-orange' },
    { x: 32, y: 26, n: 5, fill: 'c-orange' },
    { x: 2, y: 40, n: 1, fill: 'c-red' },
    { x: 22, y: 40, n: 2, fill: 'c-red' },
    { x: 42, y: 40, n: 3, fill: 'c-red' },
  ];
  protected readonly eggs = [
    { x: 16, y: 26 },
    { x: 32, y: 26 },
    { x: 48, y: 26 },
    { x: 16, y: 42 },
    { x: 32, y: 42 },
    { x: 48, y: 42 },
  ];
  protected readonly chocolate = [6, 23, 40];
  protected readonly cubes = [
    { x: 5, y: 36, letter: 'A', fill: 'c-red' },
    { x: 31, y: 36, letter: 'B', fill: 'c-navy' },
    { x: 18, y: 14, letter: 'C', fill: 'c-green' },
  ];
  protected readonly sunRays = [0, 45, 90, 135, 180, 225, 270, 315];
  protected readonly syllableArcs = [
    { x: 5, stroke: 'arc-red' },
    { x: 24.5, stroke: 'arc-blue' },
    { x: 44, stroke: 'arc-green' },
  ];
  protected readonly words = [
    { x: 11, y: 17, w: 14, fill: 'c-red' },
    { x: 28, y: 17, w: 10, fill: 'c-blue' },
    { x: 41, y: 17, w: 12, fill: 'c-green' },
    { x: 11, y: 28, w: 9, fill: 'c-orange' },
    { x: 23, y: 28, w: 18, fill: 'c-purple' },
    { x: 44, y: 28, w: 9, fill: 'c-blue' },
    { x: 11, y: 39, w: 16, fill: 'c-green' },
    { x: 30, y: 39, w: 10, fill: 'c-red' },
  ];
}
