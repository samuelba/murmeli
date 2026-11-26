import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import {
  KID,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../../../testing/app-testing';
import { resetDocumentState } from '../../../../testing/browser';
import { ActivityChartView, columnPath } from './activity-chart';
import { ParentProgress } from './parent-progress';
import type {
  ParentActivityDay,
  ParentProgressResponse,
  ParentSkillMastery,
} from './parent-progress.types';
import {
  activityChart,
  axisTicks,
  masteryLevel,
  masteryPercent,
  niceMax,
  skillRows,
  summarize,
} from './progress-view';

function days(minutes: readonly number[]): ParentActivityDay[] {
  return minutes.map((value, index) => ({
    day: `2026-11-${String(13 + index).padStart(2, '0')}`,
    minutes: value,
    runs: value === 0 ? 0 : Math.ceil(value / 10),
  }));
}

const MINUTES = [0, 12, 18, 0, 0, 25, 9, 0, 14, 0, 31, 7, 0, 16];

function skill(id: string, mastery: number, nextReviewAt = '2026-12-01T08:00:00.000Z') {
  return {
    id,
    title: id,
    trackId: 'math',
    worldId: null,
    mastery,
    box: 2,
    nextReviewAt,
    lastPracticedAt: '2026-11-25T08:00:00.000Z',
  } satisfies ParentSkillMastery;
}

const PROGRESS: ParentProgressResponse = {
  kidId: KID.id,
  locale: 'de-CH',
  activity: days(MINUTES),
  badges: [{ id: 'first-level', title: 'Erster Wegweiser', earnedAt: '2026-11-14T15:00:00.000Z' }],
  tracks: [
    {
      id: 'math',
      title: 'Mathematik',
      worlds: [
        {
          id: 'w1',
          title: 'Zahlenwiese',
          grade: 'KG1',
          state: 'passed',
          stars: 5,
          maxStars: 6,
          levels: [
            {
              id: 'l1',
              title: 'Bis 3',
              state: 'passed',
              stars: 3,
              bestScore: 1,
              runs: 2,
              firstPassedAt: '2026-11-14T15:00:00.000Z',
            },
            {
              id: 'l2',
              title: 'Bis 5',
              state: 'passed',
              stars: 2,
              bestScore: 0.8,
              runs: 0,
              firstPassedAt: null,
            },
          ],
        },
        {
          id: 'w2',
          title: 'Rechenberg',
          grade: 'KG2',
          state: 'unlocked',
          stars: 0,
          maxStars: 3,
          levels: [
            {
              id: 'l3',
              title: 'Plus',
              state: 'unlocked',
              stars: 0,
              bestScore: 0,
              runs: 1,
              firstPassedAt: null,
            },
          ],
        },
      ],
    },
  ],
  skills: [skill('solid', 0.9), skill('weak', 0.4, '2020-01-01T00:00:00.000Z'), skill('mid', 0.7)],
  weakSkills: [skill('weak', 0.4)],
};

describe('progress view', () => {
  it('rounds the axis up to 1, 2 or 5 times a power of ten', () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(3)).toBe(5);
    expect(niceMax(31)).toBe(50);
    expect(niceMax(100)).toBe(100);
    expect(niceMax(4, 10)).toBe(10);
    expect(axisTicks(50)).toEqual([0, 25, 50]);
    expect(axisTicks(5)).toEqual([0, 5]);
  });

  it('maps 14 days to bars with the peak, totals and dates', () => {
    const chart = activityChart(days(MINUTES), 'minutes', 'de-CH');
    expect(chart.bars).toHaveLength(14);
    expect(chart.max).toBe(50);
    expect(chart.ticks).toEqual([0, 25, 50]);
    expect(chart.total).toBe(132);
    expect(chart.activeDays).toBe(8);
    const peak = chart.bars.filter((bar) => bar.peak);
    expect(peak).toHaveLength(1);
    expect(peak[0]).toMatchObject({ day: '2026-11-23', value: 31, share: 0.62 });
    expect(peak[0]!.date).toBe('Montag, 23. November');
    expect(chart.bars[0]!.weekday).toMatch(/^Fr\.?$/);
    expect(chart.bars[1]!.x).toBeGreaterThan(chart.bars[0]!.x);

    const runs = activityChart(days(MINUTES), 'runs', 'en-US');
    expect(runs.max).toBe(5);
    expect(runs.bars[10]!.date).toBe('Monday, November 23');
  });

  it('handles days without activity and negative noise', () => {
    const chart = activityChart(days([0, -3, 0]), 'runs', 'de-CH');
    expect(chart.max).toBe(2);
    expect(chart.bars.every((bar) => bar.value === 0 && !bar.peak)).toBe(true);
    expect(activityChart([], 'minutes', 'de-CH').bars).toEqual([]);
  });

  it('labels mastery by thresholds and clamps percentages', () => {
    expect(masteryPercent(0.734)).toBe(73);
    expect(masteryPercent(1.4)).toBe(100);
    expect(masteryPercent(-1)).toBe(0);
    expect(masteryLevel(0.59)).toBe('practice');
    expect(masteryLevel(0.6)).toBe('growing');
    expect(masteryLevel(0.85)).toBe('solid');
  });

  it('sorts skills weakest first, flags weak and due ones', () => {
    const rows = skillRows(
      { ...PROGRESS, skills: [...PROGRESS.skills, skill('broken', 0.7, 'nope')] },
      'de-CH',
      new Date('2026-11-26T12:00:00Z'),
    );
    expect(rows.map((row) => row.skill.id)).toEqual(['weak', 'broken', 'mid', 'solid']);
    expect(rows[0]).toMatchObject({ weak: true, due: true, percent: 40, level: 'practice' });
    expect(rows[2]).toMatchObject({ weak: false, due: false, nextReview: '1. Dezember' });
    expect(rows[1]).toMatchObject({ due: false, nextReview: '' });
  });

  it('sums stars, levels and time', () => {
    expect(summarize(PROGRESS.tracks, PROGRESS.activity)).toEqual({
      stars: 5,
      maxStars: 9,
      passedLevels: 2,
      levels: 3,
      minutes: 132,
      runs: 17,
    });
  });

  it('draws columns with rounded data ends and a square baseline', () => {
    expect(columnPath(10, 20, 12, 40)).toBe(
      'M10,60 L10,24 Q10,20 14,20 L18,20 Q22,20 22,24 L22,60 Z',
    );
    expect(columnPath(0, 0, 4, 1)).toContain('Q0,0 1,0');
  });
});

describe('ActivityChartView', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppTesting() }));
  afterEach(() => resetDocumentState());

  it('is one labeled image with a tooltip per day and the peak printed', async () => {
    const { element } = await renderComponent(ActivityChartView, {
      chart: activityChart(days(MINUTES), 'minutes', 'de-CH'),
      title: 'Lernzeit pro Tag',
    });
    const svg = element.querySelector('svg')!;
    expect(svg.getAttribute('role')).toBe('img');
    const labelled = svg
      .getAttribute('aria-labelledby')!
      .split(' ')
      .map((id) => element.querySelector(`#${id}`)?.textContent?.trim());
    expect(labelled[0]).toBe('Lernzeit pro Tag');
    expect(labelled[1]).toContain('Insgesamt 132 Min., an 8 von 14 Tagen.');
    const runs = await renderComponent(ActivityChartView, {
      chart: activityChart(days([0, 7, 0]), 'runs', 'de-CH'),
      title: 'Runden',
    });
    expect(runs.element.querySelector('.summary')?.textContent?.replace(/\s+/g, ' ')).toContain(
      'Insgesamt 1 Runde, an 1 von 3 Tagen. Am meisten: 1 Runde am',
    );
    expect(labelled[1]).toContain('Am meisten: 31 Min. am Montag, 23. November.');
    expect(element.querySelectorAll('.mark')).toHaveLength(8);
    expect(element.querySelector('[data-testid="bar-2026-11-23"] title')?.textContent?.trim()).toBe(
      'Montag, 23. November: 31 Min.',
    );
    expect(element.querySelector('.peak')?.textContent?.trim()).toBe('31');
    expect([...element.querySelectorAll('.tick')].map((tick) => tick.textContent?.trim())).toEqual([
      '0',
      '25',
      '50',
    ]);
  });

  it('fits the measured width and hides weekdays when slots get narrow', async () => {
    const width = vi
      .spyOn(HTMLElement.prototype, 'getBoundingClientRect')
      .mockReturnValue({ width: 200 } as DOMRect);
    const { element, fixture } = await renderComponent(ActivityChartView, {
      chart: activityChart(days(MINUTES), 'runs', 'de-CH'),
      title: 'Runden',
    });
    await fixture.whenStable();
    expect(element.querySelector('svg')!.getAttribute('viewBox')).toBe('0 0 200 168');
    expect(element.querySelectorAll('.weekday')).toHaveLength(0);
    width.mockRestore();
  });
});

describe('ParentProgress', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { paramMap: convertToParamMap({ id: KID.id }) } },
        },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  async function open(progress: ParentProgressResponse = PROGRESS) {
    const result = await renderComponent(ParentProgress);
    expect(byTestId(result.element, 'progress-loading').getAttribute('role')).toBe('status');
    http.expectOne('/api/kids').flush([KID]);
    http.expectOne(`/api/parent/kids/${KID.id}/progress`).flush(progress);
    await settle(result.fixture);
    return result;
  }

  it('shows the kid, the totals and the badges', async () => {
    const { element } = await open();
    expect(byTestId(element, 'page-title').textContent?.trim()).toBe('Fortschritt von Mia');
    expect(byTestId(element, 'progress-class').textContent?.trim()).toBe('Kindergarten 2');
    expect(byTestId(element, 'stat-stars').textContent?.trim()).toBe('5 von 9');
    expect(byTestId(element, 'stat-levels').textContent?.trim()).toBe('2 von 3');
    expect(byTestId(element, 'stat-minutes').textContent?.trim()).toBe('132 Min.');
    expect(byTestId(element, 'stat-runs').textContent?.trim()).toBe('17');
    expect(byTestId(element, 'progress-badge-first-level').textContent).toContain(
      'seit 14. November 2026',
    );
    expect(byTestId(element, 'progress-explain').querySelectorAll('li')).toHaveLength(4);
    expect(element.querySelector('[data-testid="activity-empty"]')).toBeNull();
  });

  it('backs the charts with an accessible table of the same values', async () => {
    const { element } = await open();
    expect(element.querySelectorAll('mu-activity-chart')).toHaveLength(2);
    const table = byTestId<HTMLTableElement>(element, 'activity-table');
    expect(table.caption?.textContent?.trim()).toBe('Die letzten 14 Tage');
    expect(
      [...table.querySelectorAll('thead th')].map((th) => [
        th.getAttribute('scope'),
        th.textContent?.trim(),
      ]),
    ).toEqual([
      ['col', 'Tag'],
      ['col', 'Minuten'],
      ['col', 'Runden'],
    ]);
    const rows = table.querySelectorAll('tbody tr');
    expect(rows).toHaveLength(14);
    const peak = rows[10]!;
    expect(peak.querySelector('th')?.getAttribute('scope')).toBe('row');
    expect(peak.querySelector('th .mu-visually-hidden')?.textContent?.trim()).toBe(
      'Montag, 23. November',
    );
    expect(peak.querySelector('th [aria-hidden="true"]')?.textContent?.trim()).toMatch(
      /^Mo\.?, 23\. Nov\.?$/,
    );
    expect([...peak.querySelectorAll('td')].map((td) => td.textContent?.trim())).toEqual([
      '31',
      '4',
    ]);
    expect(table.closest('details')).not.toBeNull();
  });

  it('lists skills with a text label for mastery and flags weak ones', async () => {
    const { element } = await open();
    expect(byTestId(element, 'weak-skills').textContent).toContain('Braucht gerade Übung');
    const weak = byTestId(element, 'skill-weak');
    expect(weak.querySelector('[data-testid="skill-weak"]')?.textContent?.trim()).toBe(
      'Braucht Übung',
    );
    expect(weak.querySelector('[data-testid="skill-mastery"]')?.textContent).toContain(
      'Sicherheit 40\u00a0%',
    );
    expect(weak.textContent).toContain('Jetzt zum Wiederholen fällig');
    expect(weak.querySelector('.meter')?.getAttribute('aria-hidden')).toBe('true');
    expect(byTestId(element, 'skill-solid').textContent).toContain('sitzt gut');
    expect(byTestId(element, 'skill-mid').textContent).toContain('Nächste Wiederholung: 1.');
  });

  it('shows tracks with collapsible worlds, stars as text and level states', async () => {
    const { element } = await open();
    const done = byTestId<HTMLDetailsElement>(element, 'progress-world-w1');
    const open_ = byTestId<HTMLDetailsElement>(element, 'progress-world-w2');
    expect(done.open).toBe(false);
    expect(open_.open).toBe(true);
    expect(done.querySelector('summary')?.textContent).toContain('2 von 2 Stufen');
    expect(done.querySelector('summary')?.textContent).toContain('5 von 6 Sternen');
    const level = byTestId(element, 'progress-level-l1');
    expect(level.querySelector('[role="img"]')?.getAttribute('aria-label')).toBe('3 von 3 Sternen');
    expect(level.textContent).toContain('Geschafft');
    expect(level.textContent).toContain('Runden: 2');
    expect(byTestId(element, 'progress-level-l2').textContent).not.toContain('Runden');
  });

  it('explains empty profiles', async () => {
    const { element } = await open({
      ...PROGRESS,
      activity: days(MINUTES.map(() => 0)),
      badges: [],
      tracks: [],
      skills: [],
      weakSkills: [],
    });
    expect(byTestId(element, 'activity-empty')).toBeTruthy();
    expect(byTestId(element, 'skills-empty')).toBeTruthy();
    expect(byTestId(element, 'progress-no-badges')).toBeTruthy();
    expect(element.querySelector('[data-testid="weak-skills"]')).toBeNull();
  });

  it('shows errors with a retry and a missing kid', async () => {
    const { element, fixture } = await renderComponent(ParentProgress);
    http.expectOne('/api/kids').flush([KID]);
    http
      .expectOne(`/api/parent/kids/${KID.id}/progress`)
      .flush(errorBody('INTERNAL', 500), { status: 500, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'progress-error')).toBeTruthy();
    expect(byTestId(element, 'page-title').textContent?.trim()).toBe('Fortschritt');

    byTestId(element, 'progress-error').querySelector('button')!.click();
    http.expectOne('/api/kids').flush([]);
    http.expectOne(`/api/parent/kids/${KID.id}/progress`).flush(PROGRESS);
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).toContain('gibt es nicht mehr');
  });
});
