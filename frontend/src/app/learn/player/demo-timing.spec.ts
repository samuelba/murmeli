import { PAYLOADS } from '../../../testing/learn-testing';
import { modelDuration } from '../exercises/trace-letter/trace-geometry';
import {
  COIN_STEP_MS,
  DEMO_COUNT_MS,
  HOP_STEP_MS,
  SHARE_STEP_MS,
  cueDuration,
} from './demo-timing';

describe('cueDuration', () => {
  it('gives each animated demo step the time it needs', () => {
    expect(
      cueDuration('count-objects', { countAlong: true }, PAYLOADS['count-objects'], null),
    ).toBe(3 * DEMO_COUNT_MS);
    expect(cueDuration('ten-frame', { countAlong: true }, PAYLOADS['ten-frame'], null)).toBe(
      7 * DEMO_COUNT_MS,
    );
    expect(cueDuration('compare', { countAlong: true }, {}, null)).toBe(5 * DEMO_COUNT_MS);
    expect(
      cueDuration('division-share', { countAlong: true }, PAYLOADS['division-share'], null),
    ).toBe(6 * SHARE_STEP_MS);
    expect(
      cueDuration(
        'money-chf',
        { countAlong: true },
        { left: [1], right: [1, 2] },
        { relation: 'lt' },
      ),
    ).toBe(3 * DEMO_COUNT_MS);
    expect(cueDuration('money-chf', { countAlong: true }, {}, null)).toBe(5 * DEMO_COUNT_MS);
    expect(cueDuration('times-table', { hop: true }, PAYLOADS['times-table'], null)).toBe(
      3 * HOP_STEP_MS,
    );
    expect(cueDuration('times-table', { hop: true }, { items: [1, 2] }, null)).toBe(
      2 * HOP_STEP_MS,
    );
    expect(cueDuration('number-line', { hop: true }, {}, null)).toBe(0);
    expect(cueDuration('trace-letter', { trace: true }, PAYLOADS['trace-letter'], null)).toBe(
      modelDuration(PAYLOADS['trace-letter'].strokes),
    );
    expect(cueDuration('trace-letter', { trace: true }, null, null)).toBe(0);
    expect(
      cueDuration('money-chf', { placeCoins: true }, PAYLOADS['money-chf'], {
        coins: ['chf-2fr', 'chf-1fr'],
      }),
    ).toBe(2 * COIN_STEP_MS);
    expect(cueDuration('money-chf', { placeCoins: true }, {}, null)).toBe(3 * COIN_STEP_MS);
    expect(cueDuration('clock', { highlight: 'clock' }, PAYLOADS.clock, null)).toBe(0);
  });
});
