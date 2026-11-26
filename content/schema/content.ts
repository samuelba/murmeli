import type { Lexicon } from './lexicon.ts';
import type { Locale } from './locale.ts';
import type { Picture } from './pictures.ts';
import type { Level, Skill, Track, World } from './world.ts';

export interface WorldRef {
  readonly trackId: string;
  readonly world: World;
}

export interface LevelRef {
  readonly trackId: string;
  readonly worldId: string;
  readonly level: Level;
}

export interface SkillRef {
  readonly trackId: string;
  readonly worldId: string;
  readonly skill: Skill;
}

export interface ContentIndex {
  readonly worlds: Readonly<Record<string, WorldRef>>;
  readonly levels: Readonly<Record<string, LevelRef>>;
  readonly skills: Readonly<Record<string, SkillRef>>;
}

export interface Content {
  readonly rootDir: string;
  readonly tracks: readonly Track[];
  readonly pictures: Readonly<Record<string, Picture>>;
  readonly lexicons: Readonly<Record<Locale, Lexicon>>;
  readonly index: ContentIndex;
}
