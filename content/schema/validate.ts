import { initialSoundPictures } from './exercises/common.ts';
import { demoSeed, generateExercise } from './runtime/exercise.ts';
import { createRng } from './runtime/rng.ts';
import { frameSlots, resolveSlot } from './exercises/frames.ts';
import type { PromptContent } from './exercises/frames.ts';
import { exerciseTypeDef, parseExerciseParams } from './exercises/registry.ts';
import type { ExerciseSpec } from './exercises/registry.ts';
import type { PictureRequirement, Requirement } from './exercises/types.ts';
import { formatPath } from './issues.ts';
import { practiceDemoLevel, practiceLadders } from './practice/ladder.ts';
import { narrowSpec, topicsOfSpec } from './practice/topics.ts';
import type { ContentIssue, PathSegment } from './issues.ts';
import { carrierFor } from './lexicon.ts';
import type { Lexicon } from './lexicon.ts';
import { missingLocales } from './locale.ts';
import type { Locale, LocalizedText } from './locale.ts';
import type { Picture, PictureField } from './pictures.ts';
import { gradeRank } from './world.ts';
import type {
  Demo,
  Generator,
  Level,
  RawWorld,
  Track,
  TrackData,
  World,
} from './world.ts';

export interface SourceWorld {
  readonly file: string;
  readonly data: RawWorld;
}

export interface SourceTrack {
  readonly file: string;
  readonly dir: string;
  readonly data: TrackData;
  readonly worlds: readonly SourceWorld[];
}

export interface CrossInput {
  readonly tracks: readonly SourceTrack[];
  readonly pictures?: Readonly<Record<string, Picture>>;
  readonly lexicons: Readonly<Partial<Record<Locale, Lexicon>>>;
}

type Report = (path: readonly PathSegment[], message: string) => void;

const WORLD_FILE = /^(\d{2})-[a-z0-9]+(?:-[a-z0-9]+)*\.yaml$/;

function reporter(issues: ContentIssue[], file: string): Report {
  return (path, message) =>
    issues.push({ file, path: formatPath(path), message });
}

function checkLocales(
  text: LocalizedText,
  locales: readonly Locale[],
  path: readonly PathSegment[],
  report: Report,
): void {
  for (const locale of missingLocales(text, locales)) {
    report(path, `missing ${locale} text`);
  }
}

function pictureFieldPresent(
  picture: Picture,
  field: PictureField,
  locale: Locale,
): boolean {
  switch (field) {
    case 'word':
      return picture.words[locale] !== undefined;
    case 'plural':
      return picture.plural[locale] !== undefined;
    case 'syllables':
      return picture.syllables[locale] !== undefined;
    case 'firstSound':
      return picture.firstSound[locale] !== undefined;
    case 'article':
      return locale !== 'de-CH' || picture.article !== undefined;
  }
}

function pictureProblems(
  req: PictureRequirement,
  picture: Picture,
  locale: Locale,
): string[] {
  const problems = req.fields
    .filter((field) => !pictureFieldPresent(picture, field, locale))
    .map((field) => `picture "${req.id}" has no ${field} for ${locale}`);
  if (req.tag !== undefined && !picture.tags.includes(req.tag)) {
    problems.push(`picture "${req.id}" is not tagged "${req.tag}"`);
  }
  const syllables = picture.syllables[locale];
  if (
    req.maxSyllables !== undefined &&
    syllables &&
    syllables.length > req.maxSyllables
  ) {
    problems.push(
      `picture "${req.id}" has ${syllables.length} syllables in ${locale} (max ${req.maxSyllables})`,
    );
  }
  const word = picture.words[locale];
  if (
    req.maxLength !== undefined &&
    word !== undefined &&
    [...word].length > req.maxLength
  ) {
    problems.push(`word "${word}" is longer than ${req.maxLength} letters`);
  }
  const sound = picture.firstSound[locale];
  if (req.initialIn !== undefined && sound !== undefined) {
    if (!sound.regular) {
      problems.push(
        `picture "${req.id}" has an irregular first sound in ${locale}`,
      );
    } else if (!req.initialIn.includes(sound.grapheme)) {
      problems.push(
        `picture "${req.id}" starts with "${sound.grapheme}", not a target letter`,
      );
    }
  }
  if (req.regularFirstSound === true && sound !== undefined && !sound.regular) {
    problems.push(`picture "${req.id}" is not regular enough in ${locale}`);
  }
  return problems;
}

function requirementProblems(
  req: Requirement,
  locale: Locale,
  pictures: Readonly<Record<string, Picture>>,
  lexicon: Lexicon | undefined,
): string[] {
  switch (req.kind) {
    case 'picture': {
      const picture = pictures[req.id];
      return picture === undefined
        ? [`unknown picture "${req.id}"`]
        : pictureProblems(req, picture, locale);
    }
    case 'carrier':
      return lexicon !== undefined &&
        carrierFor(lexicon, req.grapheme) === undefined
        ? [`the ${locale} lexicon has no carrier phrase for "${req.grapheme}"`]
        : [];
    case 'letter':
      return lexicon !== undefined && lexicon.letters[req.letter] === undefined
        ? [`the ${locale} lexicon has no letter "${req.letter}"`]
        : [];
    case 'initial-sound':
      return initialSoundPictures(pictures, locale, req.grapheme, req.pool)
        .length === 0
        ? [`no regular ${locale} picture starts with "${req.grapheme}"`]
        : [];
  }
}

function checkSpec(
  spec: ExerciseSpec,
  path: readonly PathSegment[],
  locales: readonly Locale[],
  input: CrossInput,
  report: Report,
): void {
  if (input.pictures === undefined) {
    return;
  }
  const pictures = input.pictures;
  const def = exerciseTypeDef(spec.type);
  let failed = false;
  for (const locale of locales) {
    for (const req of def.requirements(spec.params)) {
      for (const problem of requirementProblems(
        req,
        locale,
        pictures,
        input.lexicons[locale],
      )) {
        failed = true;
        report([...path, 'params', ...req.path], problem);
      }
    }
  }
  if (failed) {
    return;
  }
  const promptContent: PromptContent = { pictures, lexicons: input.lexicons };
  for (const locale of locales) {
    if (input.lexicons[locale] === undefined) {
      continue;
    }
    for (const use of def.frameUses(spec.params, { locale, pictures })) {
      for (const [slot, values] of Object.entries(use.slots)) {
        const kind = frameSlots(spec.type, use.frame)[slot];
        if (kind === undefined) {
          report(
            [...path, 'params'],
            `prompt frame "${use.frame}" has no slot "${slot}"`,
          );
          continue;
        }
        for (const value of values) {
          if (resolveSlot(promptContent, kind, value, locale) === undefined) {
            report(
              [...path, 'params'],
              `prompt slot "${slot}" cannot say ${JSON.stringify(value)} in ${locale}`,
            );
          }
        }
      }
    }
  }
}

function parseSpec(
  raw: { type: string; params: unknown },
  path: readonly PathSegment[],
  locales: readonly Locale[],
  input: CrossInput,
  report: Report,
  minDistinct?: number,
): ExerciseSpec | undefined {
  const result = parseExerciseParams(
    raw.type,
    raw.params,
    minDistinct ? { minDistinct } : {},
  );
  if (!result.success) {
    for (const issue of result.issues) {
      report([...path, ...issue.path], issue.message);
    }
    return undefined;
  }
  checkSpec(result.spec, path, locales, input, report);
  return result.spec;
}

function smokeGenerate(
  levelId: string,
  demo: ExerciseSpec,
  target: string | number | undefined,
  generators: readonly Generator[],
  locales: readonly Locale[],
  input: CrossInput,
  report: Report,
): void {
  if (input.pictures === undefined) {
    return;
  }
  const content: PromptContent = {
    pictures: input.pictures,
    lexicons: input.lexicons,
  };
  for (const locale of locales.filter((l) => input.lexicons[l] !== undefined)) {
    const ctx = { locale, content };
    try {
      const shown = generateExercise(demo, createRng(demoSeed(levelId)), {
        ...ctx,
        demo: target !== undefined ? { target } : {},
      });
      if (target !== undefined && shown.focus !== target) {
        report(
          ['demo', 'target'],
          `the ${locale} demo shows ${JSON.stringify(shown.focus)}, not the target ${JSON.stringify(target)}`,
        );
      }
      generators.forEach((generator, index) => {
        try {
          generateExercise(generator, createRng(index + 1), ctx);
          for (const topic of topicsOfSpec(generator)) {
            const narrowed = narrowSpec(generator, topic);
            if (narrowed !== null && narrowed !== generator) {
              generateExercise(narrowed, createRng(index + 1), ctx);
            }
          }
        } catch (error) {
          report(
            ['generators', index],
            `cannot generate in ${locale}: ${String(error)}`,
          );
        }
      });
    } catch (error) {
      report(
        ['demo', 'exercise'],
        `cannot generate the ${locale} demo: ${String(error)}`,
      );
    }
  }
}

function buildLevel(
  raw: RawWorld['levels'][number],
  index: number,
  world: RawWorld,
  locales: readonly Locale[],
  input: CrossInput,
  outerReport: Report,
): Level | undefined {
  let failed = false;
  const report: Report = (p, m) => {
    failed = true;
    outerReport(p, m);
  };
  const path = ['levels', index];
  checkLocales(raw.title, locales, [...path, 'title'], report);
  raw.demo.steps.forEach((step, stepIndex) =>
    checkLocales(
      step.say,
      locales,
      [...path, 'demo', 'steps', stepIndex, 'say'],
      report,
    ),
  );
  if (!raw.id.startsWith(`${world.id}-`)) {
    report([...path, 'id'], `level id must start with "${world.id}-"`);
  }
  if (!world.skills.some((skill) => skill.id === raw.skill)) {
    report(
      [...path, 'skill'],
      `skill "${raw.skill}" is not defined in this world`,
    );
  }
  const exercise = parseSpec(
    raw.demo.exercise,
    [...path, 'demo', 'exercise'],
    locales,
    input,
    report,
    1,
  );
  const target = raw.demo.target;
  const generators = raw.generators.map((generator, genIndex) => {
    const spec = parseSpec(
      generator,
      [...path, 'generators', genIndex],
      locales,
      input,
      report,
    );
    return spec && { ...spec, weight: generator.weight };
  });
  if (exercise === undefined || generators.some((g) => g === undefined)) {
    return undefined;
  }
  if (!failed) {
    smokeGenerate(
      raw.id,
      exercise,
      target,
      generators as Generator[],
      locales,
      input,
      (p, m) => report([...path, ...p], m),
    );
  }
  const demo: Demo = {
    exercise,
    steps: raw.demo.steps,
    ...(target !== undefined ? { target } : {}),
  };
  return { ...raw, demo, generators: generators as Generator[] };
}

function buildWorld(
  source: SourceWorld,
  track: SourceTrack,
  input: CrossInput,
  issues: ContentIssue[],
): World | undefined {
  const report = reporter(issues, source.file);
  const world = source.data;
  const locales = track.data.locales;
  const fileName = source.file.split('/').pop() ?? '';
  const fileMatch = WORLD_FILE.exec(fileName);
  if (fileMatch === null) {
    report([], 'world file name must look like "NN-slug.yaml"');
  } else if (Number(fileMatch[1]) !== world.order) {
    report(
      ['order'],
      `order ${world.order} does not match the file prefix ${fileMatch[1]}`,
    );
  }
  checkLocales(world.title, locales, ['title'], report);
  world.skills.forEach((skill, index) => {
    checkLocales(skill.title, locales, ['skills', index, 'title'], report);
    if (!world.levels.some((level) => level.skill === skill.id)) {
      report(['skills', index], `skill "${skill.id}" is not used by any level`);
    }
  });
  const levels = world.levels.map((level, index) =>
    buildLevel(level, index, world, locales, input, report),
  );
  if (levels.some((level) => level === undefined)) {
    return undefined;
  }
  return {
    ...world,
    trackId: track.data.id,
    file: source.file,
    levels: levels as Level[],
  };
}

function checkUniqueIds(input: CrossInput, issues: ContentIssue[]): void {
  const seen = new Map<string, string>();
  const claim = (
    id: string,
    file: string,
    path: readonly PathSegment[],
    what: string,
  ) => {
    const previous = seen.get(id);
    if (previous === undefined) {
      seen.set(id, `${what} in ${file}`);
    } else {
      issues.push({
        file,
        path: formatPath(path),
        message: `${what} id "${id}" is already used by ${previous}`,
      });
    }
  };
  for (const track of input.tracks) {
    claim(track.data.id, track.file, ['id'], 'track');
    for (const { file, data } of track.worlds) {
      claim(data.id, file, ['id'], 'world');
      data.skills.forEach((skill, index) =>
        claim(skill.id, file, ['skills', index, 'id'], 'skill'),
      );
      data.levels.forEach((level, index) =>
        claim(level.id, file, ['levels', index, 'id'], 'level'),
      );
    }
  }
}

function checkRequires(input: CrossInput, issues: ContentIssue[]): void {
  const worlds = new Map(
    input.tracks.flatMap((track) =>
      track.worlds.map(
        (source) =>
          [source.data.id, { ...source, track: track.data.id }] as const,
      ),
    ),
  );
  for (const source of worlds.values()) {
    const report = reporter(issues, source.file);
    source.data.requires.forEach((id, index) => {
      const required = worlds.get(id);
      if (required === undefined) {
        report(['requires', index], `unknown world "${id}"`);
      } else if (id === source.data.id) {
        report(['requires', index], 'a world cannot require itself');
      } else if (
        required.track === source.track &&
        required.data.order >= source.data.order
      ) {
        report(
          ['requires', index],
          `"${id}" must come before this world in its track`,
        );
      }
    });
  }
  const state = new Map<string, 'visiting' | 'done'>();
  const visit = (id: string, trail: string[]): void => {
    const current = state.get(id);
    if (current === 'done' || !worlds.has(id)) {
      return;
    }
    if (current === 'visiting') {
      const source = worlds.get(id);
      const cycle = [...trail.slice(trail.indexOf(id)), id].join(' -> ');
      issues.push({
        file: source?.file ?? '',
        path: 'requires',
        message: `requires cycle: ${cycle}`,
      });
      return;
    }
    state.set(id, 'visiting');
    for (const next of worlds.get(id)?.data.requires ?? []) {
      if (next !== id) {
        visit(next, [...trail, id]);
      }
    }
    state.set(id, 'done');
  };
  for (const id of worlds.keys()) {
    visit(id, []);
  }
}

function checkTrack(track: SourceTrack, issues: ContentIssue[]): void {
  const report = reporter(issues, track.file);
  if (track.dir !== track.data.id) {
    report(
      ['id'],
      `track id "${track.data.id}" must match its folder "${track.dir}"`,
    );
  }
  checkLocales(track.data.title, track.data.locales, ['title'], report);
  const sorted = [...track.worlds].sort((a, b) => a.data.order - b.data.order);
  sorted.forEach((source, index) => {
    const previous = sorted[index - 1];
    if (previous === undefined) {
      return;
    }
    const report = reporter(issues, source.file);
    if (previous.data.order === source.data.order) {
      report(
        ['order'],
        `order ${source.data.order} is also used by ${previous.file}`,
      );
    }
    if (gradeRank(previous.data.grade) > gradeRank(source.data.grade)) {
      report(
        ['grade'],
        `grade ${source.data.grade} comes after grade ${previous.data.grade}`,
      );
    }
  });
}

export function crossValidate(input: CrossInput): {
  issues: ContentIssue[];
  tracks: Track[];
} {
  const issues: ContentIssue[] = [];
  checkUniqueIds(input, issues);
  checkRequires(input, issues);
  const orders = new Map<number, string>();
  const tracks = input.tracks.map((track): Track => {
    checkTrack(track, issues);
    const previous = orders.get(track.data.order);
    if (previous !== undefined) {
      issues.push({
        file: track.file,
        path: 'order',
        message: `order is also used by ${previous}`,
      });
    }
    orders.set(track.data.order, track.file);
    const worlds = track.worlds
      .map((source) => buildWorld(source, track, input, issues))
      .filter((world): world is World => world !== undefined)
      .sort((a, b) => a.order - b.order);
    return { ...track.data, worlds };
  });
  const sorted = tracks.sort((a, b) => a.order - b.order);
  checkPracticeDemos(sorted, issues);
  return { issues, tracks: sorted };
}

/** Every practice topic a track trains needs a level demo for "Zeig mir". */
function checkPracticeDemos(
  tracks: readonly Track[],
  issues: ContentIssue[],
): void {
  for (const track of tracks) {
    for (const ladder of practiceLadders([track])) {
      if (practiceDemoLevel(ladder, 0) === undefined) {
        const first = ladder.steps[0]!;
        issues.push({
          file: track.worlds.find((w) => w.id === first.worldId)!.file,
          path: `levels.${first.level.id}`,
          message: `practice topic "${ladder.topic}" has no level whose demo shows only this topic`,
        });
      }
    }
  }
}
