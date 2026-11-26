import type { Content } from './content.ts';
import { GRADES } from './world.ts';
import type { Grade } from './world.ts';

export interface WorldStats {
  readonly id: string;
  readonly grade: Grade;
  readonly levels: number;
  readonly skills: number;
  readonly exerciseTypes: readonly string[];
}

export interface TrackStats {
  readonly id: string;
  readonly locales: readonly string[];
  readonly worlds: readonly WorldStats[];
  readonly levels: number;
  readonly skills: number;
  readonly byGrade: Readonly<
    Record<Grade, { readonly worlds: number; readonly levels: number }>
  >;
}

export interface ContentStats {
  readonly tracks: readonly TrackStats[];
  readonly totals: {
    readonly tracks: number;
    readonly worlds: number;
    readonly levels: number;
    readonly skills: number;
    readonly pictures: number;
    readonly exerciseTypes: number;
  };
}

export function contentStats(content: Content): ContentStats {
  const types = new Set<string>();
  const tracks = content.tracks.map((track): TrackStats => {
    const worlds = track.worlds.map((world): WorldStats => {
      const used = new Set(
        world.levels.flatMap((level) =>
          level.generators.map((generator) => generator.type),
        ),
      );
      used.forEach((type) => types.add(type));
      return {
        id: world.id,
        grade: world.grade,
        levels: world.levels.length,
        skills: world.skills.length,
        exerciseTypes: [...used].sort(),
      };
    });
    const byGrade = Object.fromEntries(
      GRADES.map((grade) => {
        const inGrade = worlds.filter((world) => world.grade === grade);
        return [
          grade,
          {
            worlds: inGrade.length,
            levels: inGrade.reduce((sum, w) => sum + w.levels, 0),
          },
        ];
      }),
    ) as TrackStats['byGrade'];
    return {
      id: track.id,
      locales: track.locales,
      worlds,
      levels: worlds.reduce((sum, w) => sum + w.levels, 0),
      skills: worlds.reduce((sum, w) => sum + w.skills, 0),
      byGrade,
    };
  });
  return {
    tracks,
    totals: {
      tracks: tracks.length,
      worlds: tracks.reduce((sum, t) => sum + t.worlds.length, 0),
      levels: tracks.reduce((sum, t) => sum + t.levels, 0),
      skills: tracks.reduce((sum, t) => sum + t.skills, 0),
      pictures: Object.keys(content.pictures).length,
      exerciseTypes: types.size,
    },
  };
}

export function formatStats(stats: ContentStats): string {
  const lines: string[] = [];
  for (const track of stats.tracks) {
    lines.push(
      `${track.id} [${track.locales.join(', ')}]: ${track.worlds.length} worlds, ${track.levels} levels, ${track.skills} skills`,
    );
    const grades = GRADES.filter(
      (grade) => track.byGrade[grade].worlds > 0,
    ).map(
      (grade) =>
        `${grade}: ${track.byGrade[grade].worlds} worlds / ${track.byGrade[grade].levels} levels`,
    );
    lines.push(`  by grade: ${grades.join(' | ')}`);
    for (const world of track.worlds) {
      lines.push(
        `  ${world.grade.padEnd(3)} ${world.id.padEnd(32)} ${String(world.levels).padStart(2)} levels  ${world.skills} skills  ${world.exerciseTypes.join(', ')}`,
      );
    }
  }
  const t = stats.totals;
  lines.push(
    `total: ${t.tracks} tracks, ${t.worlds} worlds, ${t.levels} levels, ${t.skills} skills, ${t.pictures} pictures, ${t.exerciseTypes} exercise types in use`,
  );
  return lines.join('\n');
}
