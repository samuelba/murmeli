import fc from 'fast-check';
import { nextBox, nextMastery, reviewAt } from './mastery';

const NOW = new Date('2026-05-01T08:00:00Z');
const days = (n: number) => new Date(NOW.getTime() + n * 86_400_000);

describe('nextMastery', () => {
  it('seeds a new skill with the run score in box 1, or box 2 when strong', () => {
    expect(nextMastery(undefined, 0.6, NOW)).toEqual({
      mastery: 0.6,
      box: 1,
      nextReviewAt: days(1),
    });
    expect(nextMastery(undefined, 1, NOW)).toEqual({
      mastery: 1,
      box: 2,
      nextReviewAt: days(2),
    });
  });

  it('blends 0.7 of the previous mastery with 0.3 of the run', () => {
    const result = nextMastery({ mastery: 0.5, box: 2 }, 1, NOW);
    expect(result.mastery).toBeCloseTo(0.65);
    expect(result.box).toBe(3);
    expect(result.nextReviewAt).toEqual(days(4));
  });

  it('keeps the box between 0.5 and 0.8 and resets it below 0.5', () => {
    expect(nextMastery({ mastery: 0.8, box: 4 }, 0.7, NOW).box).toBe(4);
    expect(nextMastery({ mastery: 0.8, box: 4 }, 0.49, NOW)).toMatchObject({
      box: 1,
      nextReviewAt: days(1),
    });
  });

  it('stops at box 5 (16 days)', () => {
    expect(nextMastery({ mastery: 1, box: 5 }, 1, NOW)).toMatchObject({
      box: 5,
      nextReviewAt: days(16),
    });
  });

  it('repairs out-of-range input', () => {
    expect(nextMastery({ mastery: 3, box: 9 }, Number.NaN, NOW)).toEqual({
      mastery: 0.7,
      box: 1,
      nextReviewAt: days(1),
    });
  });

  it('keeps mastery in [0, 1] and the box in 1..5', () => {
    fc.assert(
      fc.property(
        fc.option(
          fc.record({
            mastery: fc.double({ min: -1, max: 2, noNaN: true }),
            box: fc.integer({ min: -3, max: 9 }),
          }),
          { nil: undefined },
        ),
        fc.double({ min: -1, max: 2 }),
        (previous, score) => {
          const result = nextMastery(previous, score, NOW);
          expect(result.mastery).toBeGreaterThanOrEqual(0);
          expect(result.mastery).toBeLessThanOrEqual(1);
          expect(result.box).toBeGreaterThanOrEqual(1);
          expect(result.box).toBeLessThanOrEqual(5);
          expect(result.nextReviewAt.getTime()).toBeGreaterThan(NOW.getTime());
        },
      ),
    );
  });

  it('never lowers mastery after a perfect run and never raises it after a failed one', () => {
    fc.assert(
      fc.property(
        fc.double({ min: 0, max: 1, noNaN: true }),
        fc.integer({ min: 1, max: 5 }),
        (mastery, box) => {
          expect(
            nextMastery({ mastery, box }, 1, NOW).mastery,
          ).toBeGreaterThanOrEqual(mastery - 1e-9);
          expect(
            nextMastery({ mastery, box }, 0, NOW).mastery,
          ).toBeLessThanOrEqual(mastery + 1e-9);
        },
      ),
    );
  });
});

describe('Leitner helpers', () => {
  it('nextBox moves up, stays or resets', () => {
    expect(nextBox(1, 0.8)).toBe(2);
    expect(nextBox(3, 0.5)).toBe(3);
    expect(nextBox(3, 0.2)).toBe(1);
  });

  it('reviewAt uses 1, 2, 4, 8 and 16 days', () => {
    expect([1, 2, 3, 4, 5].map((box) => reviewAt(box, NOW))).toEqual([
      days(1),
      days(2),
      days(4),
      days(8),
      days(16),
    ]);
  });
});
