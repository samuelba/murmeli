import { localDay, recentDays } from './local-day';

describe('localDay', () => {
  it('uses the Zurich day boundary in winter (UTC+1)', () => {
    expect(localDay(new Date('2026-01-14T22:59:59Z'), 'Europe/Zurich')).toBe(
      '2026-01-14',
    );
    expect(localDay(new Date('2026-01-14T23:00:00Z'), 'Europe/Zurich')).toBe(
      '2026-01-15',
    );
  });

  it('uses the Zurich day boundary in summer (UTC+2)', () => {
    expect(localDay(new Date('2026-07-14T21:59:59Z'), 'Europe/Zurich')).toBe(
      '2026-07-14',
    );
    expect(localDay(new Date('2026-07-14T22:00:00Z'), 'Europe/Zurich')).toBe(
      '2026-07-15',
    );
  });

  it('follows other time zones', () => {
    const at = new Date('2026-03-01T03:00:00Z');
    expect(localDay(at, 'UTC')).toBe('2026-03-01');
    expect(localDay(at, 'America/New_York')).toBe('2026-02-28');
  });
});

describe('recentDays', () => {
  it('lists the days up to today, oldest first, across month ends', () => {
    expect(
      recentDays(new Date('2026-03-01T23:30:00Z'), 'Europe/Zurich', 3),
    ).toEqual(['2026-02-28', '2026-03-01', '2026-03-02']);
  });

  it('handles the switch to summer time', () => {
    const days = recentDays(new Date('2026-03-30T10:00:00Z'), 'UTC', 14);
    expect(days).toHaveLength(14);
    expect(days[0]).toBe('2026-03-17');
    expect(days[13]).toBe('2026-03-30');
  });
});
