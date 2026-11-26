import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import type { z } from 'zod';
import type {
  Content,
  ContentIndex,
  LevelRef,
  SkillRef,
  WorldRef,
} from './content.ts';
import { deepFreeze } from './freeze.ts';
import {
  ContentValidationError,
  formatIssue,
  formatPath,
  zodIssues,
} from './issues.ts';
import type { ContentIssue, PathSegment } from './issues.ts';
import { LexiconSchema, lexiconIssues } from './lexicon.ts';
import type { Lexicon } from './lexicon.ts';
import { containsEszett, LOCALES, NO_ESZETT_MESSAGE } from './locale.ts';
import type { Locale } from './locale.ts';
import { PictureCatalogSchema } from './pictures.ts';
import type { Picture } from './pictures.ts';
import { checkSvg } from './svg.ts';
import { crossValidate } from './validate.ts';
import type { SourceTrack, SourceWorld } from './validate.ts';
import { RawWorldSchema, TrackSchema } from './world.ts';
import type { Track } from './world.ts';

export const CONTENT_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

export interface ValidationResult {
  readonly issues: readonly ContentIssue[];
  readonly content?: Content;
}

class Reader {
  readonly issues: ContentIssue[] = [];
  readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  report(
    file: string,
    path: readonly PathSegment[] | string,
    message: string,
  ): void {
    this.issues.push({
      file,
      path: typeof path === 'string' ? path : formatPath(path),
      message,
    });
  }

  list(dir: string, kind: 'file' | 'dir'): string[] {
    const full = path.join(this.root, dir);
    if (!fs.existsSync(full)) {
      return [];
    }
    return fs
      .readdirSync(full, { withFileTypes: true })
      .filter((entry) =>
        kind === 'dir' ? entry.isDirectory() : entry.isFile(),
      )
      .map((entry) => entry.name)
      .sort();
  }

  text(file: string): string | undefined {
    try {
      return fs.readFileSync(path.join(this.root, file), 'utf8');
    } catch {
      this.report(file, '', 'file is missing or unreadable');
      return undefined;
    }
  }

  yaml(file: string): unknown {
    const text = this.text(file);
    if (text === undefined) {
      return undefined;
    }
    text.split('\n').forEach((line, index) => {
      if (containsEszett(line)) {
        this.report(file, `line ${index + 1}`, NO_ESZETT_MESSAGE);
      }
    });
    try {
      return YAML.parse(text, {
        uniqueKeys: true,
        prettyErrors: true,
      }) as unknown;
    } catch (error) {
      const message =
        error instanceof Error ? error.message.split('\n')[0] : String(error);
      this.report(file, '', `invalid YAML: ${message}`);
      return undefined;
    }
  }

  parse<S extends z.ZodType>(schema: S, file: string): z.output<S> | undefined {
    const data = this.yaml(file);
    if (data === undefined) {
      return undefined;
    }
    const result = schema.safeParse(data);
    if (!result.success) {
      this.issues.push(...zodIssues(file, result.error));
      return undefined;
    }
    return result.data;
  }
}

function startsWithInsensitive(word: string, prefix: string): boolean {
  return word
    .toLocaleLowerCase('de-CH')
    .startsWith(prefix.toLocaleLowerCase('de-CH'));
}

function pictureIssues(
  id: string,
  picture: Picture,
): { path: PathSegment[]; message: string }[] {
  const issues: { path: PathSegment[]; message: string }[] = [];
  const add = (path: PathSegment[], message: string) =>
    issues.push({ path, message });
  if (picture.file !== `${id}.svg`) {
    add(['file'], `must be "${id}.svg"`);
  }
  if (Object.keys(picture.words).length === 0) {
    add(['words'], 'needs a word in at least one locale');
  }
  const de = picture.words['de-CH'];
  if (de !== undefined) {
    if (picture.article === undefined) {
      add(['article'], 'German nouns need an article (der, die, das)');
    }
    if (de[0] !== de[0]?.toLocaleUpperCase('de-CH')) {
      add(['words', 'de-CH'], 'German nouns start with a capital letter');
    }
  }
  const en = picture.words['en-US'];
  if (en !== undefined && en[0] !== en[0]?.toLocaleLowerCase('en-US')) {
    add(['words', 'en-US'], 'English words are lowercase');
  }
  for (const locale of LOCALES) {
    const word = picture.words[locale];
    const fields = ['plural', 'syllables', 'firstSound'] as const;
    for (const field of fields) {
      if (word === undefined && picture[field][locale] !== undefined) {
        add([field, locale], `has no ${locale} word`);
      }
    }
    const syllables = picture.syllables[locale];
    const strip = (text: string) =>
      text.replace(/[\s-]/g, '').toLocaleLowerCase(locale);
    if (
      word !== undefined &&
      syllables !== undefined &&
      strip(syllables.join('')) !== strip(word)
    ) {
      add(['syllables', locale], `syllables do not spell "${word}"`);
    }
    const sound = picture.firstSound[locale];
    if (
      word !== undefined &&
      sound !== undefined &&
      !startsWithInsensitive(word, sound.grapheme)
    ) {
      add(
        ['firstSound', locale, 'grapheme'],
        `"${word}" does not start with "${sound.grapheme}"`,
      );
    }
  }
  return issues;
}

function loadPictures(reader: Reader): Record<string, Picture> | undefined {
  const file = 'pictures.yaml';
  const catalog = reader.parse(PictureCatalogSchema, file);
  if (catalog === undefined) {
    return undefined;
  }
  const svgs = new Set(
    reader.list('pictures', 'file').filter((name) => name.endsWith('.svg')),
  );
  for (const [id, picture] of Object.entries(catalog.pictures)) {
    for (const issue of pictureIssues(id, picture)) {
      reader.report(file, ['pictures', id, ...issue.path], issue.message);
    }
    const svgFile = `pictures/${picture.file}`;
    if (!svgs.has(picture.file)) {
      reader.report(
        file,
        ['pictures', id, 'file'],
        `${svgFile} does not exist`,
      );
      continue;
    }
    svgs.delete(picture.file);
    const text = reader.text(svgFile);
    for (const problem of text === undefined ? [] : checkSvg(text)) {
      reader.report(svgFile, '', `unsafe SVG: ${problem}`);
    }
  }
  for (const orphan of svgs) {
    reader.report(
      `pictures/${orphan}`,
      '',
      'SVG is not listed in pictures.yaml',
    );
  }
  return catalog.pictures;
}

function loadLexicons(reader: Reader): Partial<Record<Locale, Lexicon>> {
  const lexicons: Partial<Record<Locale, Lexicon>> = {};
  for (const locale of LOCALES) {
    const file = `lexicon/${locale}.yaml`;
    const lexicon = reader.parse(LexiconSchema, file);
    if (lexicon !== undefined) {
      for (const issue of lexiconIssues(lexicon)) {
        reader.report(file, issue.path, issue.message);
      }
      lexicons[locale] = lexicon;
    }
  }
  return lexicons;
}

function loadTracks(reader: Reader): SourceTrack[] {
  const dirs = reader.list('tracks', 'dir');
  if (dirs.length === 0) {
    reader.report('tracks', '', 'no tracks found');
  }
  return dirs.flatMap((dir) => {
    const file = `tracks/${dir}/track.yaml`;
    const data = reader.parse(TrackSchema, file);
    const worldsDir = `tracks/${dir}/worlds`;
    const worlds = reader
      .list(worldsDir, 'file')
      .flatMap((name): SourceWorld[] => {
        const worldFile = `${worldsDir}/${name}`;
        if (!name.endsWith('.yaml')) {
          reader.report(worldFile, '', 'world files must end in .yaml');
          return [];
        }
        const world = reader.parse(RawWorldSchema, worldFile);
        return world === undefined ? [] : [{ file: worldFile, data: world }];
      });
    return data === undefined ? [] : [{ file, dir, data, worlds }];
  });
}

function buildIndex(tracks: readonly Track[]): ContentIndex {
  const worlds: Record<string, WorldRef> = {};
  const levels: Record<string, LevelRef> = {};
  const skills: Record<string, SkillRef> = {};
  for (const track of tracks) {
    for (const world of track.worlds) {
      worlds[world.id] = { trackId: track.id, world };
      for (const level of world.levels) {
        levels[level.id] = { trackId: track.id, worldId: world.id, level };
      }
      for (const skill of world.skills) {
        skills[skill.id] = { trackId: track.id, worldId: world.id, skill };
      }
    }
  }
  return { worlds, levels, skills };
}

export function validateContent(
  rootDir: string = CONTENT_ROOT,
): ValidationResult {
  const root = path.resolve(rootDir);
  const reader = new Reader(root);
  const pictures = loadPictures(reader);
  const lexicons = loadLexicons(reader);
  const sources = loadTracks(reader);
  const cross = crossValidate({
    tracks: sources,
    lexicons,
    ...(pictures ? { pictures } : {}),
  });
  const seen = new Set<string>();
  const issues = [...reader.issues, ...cross.issues].filter((issue) => {
    const key = formatIssue(issue);
    return seen.has(key) ? false : (seen.add(key), true);
  });
  const complete =
    pictures !== undefined && LOCALES.every((locale) => lexicons[locale]);
  if (issues.length > 0 || !complete) {
    return { issues };
  }
  const content: Content = {
    rootDir: root,
    tracks: cross.tracks,
    pictures,
    lexicons: lexicons as Record<Locale, Lexicon>,
    index: buildIndex(cross.tracks),
  };
  return { issues, content: deepFreeze(content) as Content };
}

export function loadContent(rootDir: string = CONTENT_ROOT): Content {
  const result = validateContent(rootDir);
  if (result.content === undefined) {
    throw new ContentValidationError(result.issues);
  }
  return result.content;
}
