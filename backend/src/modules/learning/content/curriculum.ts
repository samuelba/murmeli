import {
  type Content,
  type Level,
  type LevelRef,
  type Locale,
  type LocalizedText,
  type PracticeLadder,
  type PracticeTopicId,
  type SkillRef,
  type Track,
  type World,
  CONTENT_ROOT,
  loadContent,
  practiceLadders,
} from '@murmeli/content';

export const LEVEL_ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function localize(text: LocalizedText, locale: Locale): string {
  return text[locale] ?? Object.values(text).find(Boolean) ?? '';
}

/**
 * The validated curriculum, loaded once at startup, with the lookups the
 * learning engine needs.
 */
export class Curriculum {
  readonly worlds: readonly World[];
  private readonly ladderCache = new Map<Locale, readonly PracticeLadder[]>();

  constructor(readonly content: Content) {
    this.worlds = content.tracks.flatMap((track) => track.worlds);
  }

  /** The practice topics of the kid's tracks, each with its difficulty ladder */
  practiceLadders(locale: Locale): readonly PracticeLadder[] {
    let ladders = this.ladderCache.get(locale);
    if (!ladders) {
      ladders = practiceLadders(this.tracksFor(locale));
      this.ladderCache.set(locale, ladders);
    }
    return ladders;
  }

  ladder(topic: PracticeTopicId, locale: Locale): PracticeLadder | undefined {
    return this.practiceLadders(locale).find((l) => l.topic === topic);
  }

  /** The step of a level on a topic's ladder, if the level trains the topic */
  stepIndex(
    topic: PracticeTopicId,
    levelId: string,
    locale: Locale,
  ): number | undefined {
    return this.ladder(topic, locale)?.steps.find(
      (step) => step.level.id === levelId,
    )?.index;
  }

  tracksFor(locale: Locale): readonly Track[] {
    return this.content.tracks.filter((track) =>
      track.locales.includes(locale),
    );
  }

  worldsFor(locale: Locale): readonly World[] {
    return this.tracksFor(locale).flatMap((track) => track.worlds);
  }

  levelsFor(locale: Locale): readonly Level[] {
    return this.worldsFor(locale).flatMap((world) => world.levels);
  }

  /** The level, if it exists and is part of a track in the kid's language */
  levelFor(levelId: string, locale: Locale): LevelRef | undefined {
    const ref = this.content.index.levels[levelId];
    if (!ref) {
      return undefined;
    }
    const track = this.content.tracks.find((t) => t.id === ref.trackId);
    return track?.locales.includes(locale) ? ref : undefined;
  }

  skill(skillId: string): SkillRef | undefined {
    return this.content.index.skills[skillId];
  }

  skillTitle(skillId: string, locale: Locale): string {
    const ref = this.skill(skillId);
    return ref ? localize(ref.skill.title, locale) : skillId;
  }
}

/**
 * Loads and validates the curriculum; throws ContentValidationError with
 * every issue when it is invalid, so the backend fails fast at startup.
 */
export function loadCurriculum(dir: string | undefined): Curriculum {
  return new Curriculum(loadContent(dir ?? CONTENT_ROOT));
}
