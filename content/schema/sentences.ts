import type { Locale } from './locale.ts';
import type { Picture } from './pictures.ts';

export const RELATIONS = ['on', 'under', 'next-to'] as const;
export type Relation = (typeof RELATIONS)[number];

export type Scene =
  | {
      readonly kind: 'position';
      readonly subject: string;
      readonly relation: Relation;
      readonly object: string;
    }
  | {
      readonly kind: 'count';
      readonly pictureId: string;
      readonly count: number;
    };

const PREPOSITIONS: Readonly<
  Record<Locale, Readonly<Record<Relation, string>>>
> = {
  'de-CH': { on: 'auf', under: 'unter', 'next-to': 'neben' },
  'en-US': { on: 'on', under: 'under', 'next-to': 'next to' },
};

const DATIVE = { der: 'dem', die: 'der', das: 'dem' } as const;

const COUNT_WORDS: Readonly<Record<Locale, readonly string[]>> = {
  'de-CH': ['null', 'eins', 'zwei', 'drei', 'vier', 'fünf'],
  'en-US': ['zero', 'one', 'two', 'three', 'four', 'five'],
};

export const MAX_SENTENCE_COUNT = 5;

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

export function sceneSentence(
  scene: Scene,
  pictures: Readonly<Record<string, Picture>>,
  locale: Locale,
): string | undefined {
  if (scene.kind === 'count') {
    const plural = pictures[scene.pictureId]?.plural[locale];
    const count = COUNT_WORDS[locale][scene.count];
    if (plural === undefined || count === undefined) {
      return undefined;
    }
    return locale === 'de-CH'
      ? `Ich sehe ${count} ${plural}.`
      : `I see ${count} ${plural}.`;
  }
  const subject = pictures[scene.subject];
  const object = pictures[scene.object];
  const subjectWord = subject?.words[locale];
  const objectWord = object?.words[locale];
  if (subjectWord === undefined || objectWord === undefined) {
    return undefined;
  }
  const preposition = PREPOSITIONS[locale][scene.relation];
  if (locale === 'en-US') {
    return `The ${subjectWord} is ${preposition} the ${objectWord}.`;
  }
  if (subject?.article === undefined || object?.article === undefined) {
    return undefined;
  }
  return `${capitalize(subject.article)} ${subjectWord} ist ${preposition} ${DATIVE[object.article]} ${objectWord}.`;
}

export function sceneKey(scene: Scene): string {
  return scene.kind === 'count'
    ? `count:${scene.pictureId}:${scene.count}`
    : `position:${scene.subject}:${scene.relation}:${scene.object}`;
}
