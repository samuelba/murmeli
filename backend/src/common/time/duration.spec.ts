import { addSeconds, durationToSeconds } from './duration';

describe('durationToSeconds', () => {
  it.each([
    ['15m', 900],
    ['12h', 43_200],
    ['30d', 2_592_000],
    ['45s', 45],
    ['1500ms', 2],
    ['1ms', 1],
    [' 2m ', 120],
  ])('%s -> %d', (input, expected) => {
    expect(durationToSeconds(input)).toBe(expected);
  });

  it('rejects other formats', () => {
    expect(() => durationToSeconds('15 minutes')).toThrow('Invalid duration');
  });
});

describe('addSeconds', () => {
  it('returns a new date', () => {
    const start = new Date('2026-01-01T00:00:00Z');

    expect(addSeconds(start, 90).toISOString()).toBe(
      '2026-01-01T00:01:30.000Z',
    );
    expect(start.toISOString()).toBe('2026-01-01T00:00:00.000Z');
  });
});
