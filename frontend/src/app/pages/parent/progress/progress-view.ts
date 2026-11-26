import type {
  ParentActivityDay,
  ParentProgressResponse,
  ParentProgressTrack,
  ParentSkillMastery,
} from './parent-progress.types';

export type ActivityMetric = 'minutes' | 'runs';

export interface ActivityBar {
  readonly day: string;
  readonly value: number;
  /** Left edge in chart units (0–100). */
  readonly x: number;
  readonly width: number;
  /** Bar height as a share of the plot height (0–1). */
  readonly share: number;
  readonly weekday: string;
  readonly date: string;
  /** For the table, where phones have little room: "Mo., 23. Nov." */
  readonly shortDate: string;
  readonly peak: boolean;
}

export interface ActivityChart {
  readonly metric: ActivityMetric;
  readonly max: number;
  readonly ticks: readonly number[];
  readonly bars: readonly ActivityBar[];
  readonly total: number;
  readonly activeDays: number;
}

export type MasteryLevel = 'practice' | 'growing' | 'solid';

export interface SkillRow {
  readonly skill: ParentSkillMastery;
  readonly percent: number;
  readonly level: MasteryLevel;
  readonly weak: boolean;
  readonly due: boolean;
  readonly nextReview: string;
}

export interface ProgressSummary {
  readonly stars: number;
  readonly maxStars: number;
  readonly passedLevels: number;
  readonly levels: number;
  readonly minutes: number;
  readonly runs: number;
}

const BAR_GAP = 0.25;

/** The smallest of 1, 2, 5, 10, 20, 50 … that is at least `value` (and at least `floor`). */
export function niceMax(value: number, floor = 1): number {
  const target = Math.max(value, floor);
  const magnitude = 10 ** Math.floor(Math.log10(target));
  return [1, 2, 5, 10].map((step) => step * magnitude).find((nice) => nice >= target) ?? target;
}

export function axisTicks(max: number): number[] {
  const half = max / 2;
  return Number.isInteger(half) ? [0, half, max] : [0, max];
}

/** "YYYY-MM-DD" is a calendar day, so it is formatted in UTC to never shift by a day. */
function dayFormat(locale: string, options: Intl.DateTimeFormatOptions): (day: string) => string {
  const format = new Intl.DateTimeFormat(locale, { ...options, timeZone: 'UTC' });
  return (day) => format.format(new Date(`${day}T00:00:00Z`));
}

export function activityChart(
  days: readonly ParentActivityDay[],
  metric: ActivityMetric,
  locale: string,
): ActivityChart {
  const values = days.map((day) => Math.max(0, day[metric]));
  const peak = Math.max(0, ...values);
  const max = niceMax(peak, metric === 'minutes' ? 10 : 2);
  const slot = days.length > 0 ? 100 / days.length : 100;
  const width = slot * (1 - BAR_GAP);
  const weekday = dayFormat(locale, { weekday: 'short' });
  const date = dayFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' });
  const shortDate = dayFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  return {
    metric,
    max,
    ticks: axisTicks(max),
    total: values.reduce((sum, value) => sum + value, 0),
    activeDays: days.filter((day) => day.runs > 0 || day.minutes > 0).length,
    bars: days.map((day, index) => ({
      day: day.day,
      value: values[index]!,
      x: index * slot + (slot - width) / 2,
      width,
      share: values[index]! / max,
      weekday: weekday(day.day),
      date: date(day.day),
      shortDate: shortDate(day.day),
      peak: peak > 0 && values[index] === peak && values.indexOf(peak) === index,
    })),
  };
}

/** "12 Min.", "1 Runde", "5 Runden": the i18n key for a value of a metric. */
export function valueKey(metric: ActivityMetric, count: number): string {
  return `parent.progress.activity.${metric}Value${count === 1 ? 'One' : ''}`;
}

export function masteryPercent(mastery: number): number {
  return Math.round(Math.min(1, Math.max(0, mastery)) * 100);
}

export function masteryLevel(mastery: number): MasteryLevel {
  if (mastery < 0.6) {
    return 'practice';
  }
  return mastery < 0.85 ? 'growing' : 'solid';
}

export function skillRows(
  progress: Pick<ParentProgressResponse, 'skills' | 'weakSkills'>,
  locale: string,
  now: Date = new Date(),
): SkillRow[] {
  const weak = new Set(progress.weakSkills.map((skill) => skill.id));
  const format = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' });
  return [...progress.skills]
    .sort((a, b) => a.mastery - b.mastery || a.title.localeCompare(b.title, locale))
    .map((skill) => {
      const next = new Date(skill.nextReviewAt);
      const valid = !Number.isNaN(next.getTime());
      return {
        skill,
        percent: masteryPercent(skill.mastery),
        level: masteryLevel(skill.mastery),
        weak: weak.has(skill.id),
        due: valid && next.getTime() <= now.getTime(),
        nextReview: valid ? format.format(next) : '',
      };
    });
}

export function summarize(
  tracks: readonly ParentProgressTrack[],
  activity: readonly ParentActivityDay[],
): ProgressSummary {
  const worlds = tracks.flatMap((track) => track.worlds);
  const levels = worlds.flatMap((world) => world.levels);
  return {
    stars: worlds.reduce((sum, world) => sum + world.stars, 0),
    maxStars: worlds.reduce((sum, world) => sum + world.maxStars, 0),
    passedLevels: levels.filter((level) => level.state === 'passed').length,
    levels: levels.length,
    minutes: activity.reduce((sum, day) => sum + day.minutes, 0),
    runs: activity.reduce((sum, day) => sum + day.runs, 0),
  };
}
