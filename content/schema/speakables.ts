import type { Content } from './content.ts';
import { frameOf, resolveSlot, speakSegments } from './exercises/frames.ts';
import { exerciseTypeDef } from './exercises/registry.ts';
import type { ExerciseSpec } from './exercises/registry.ts';
import type { SlotKind, SlotValue } from './exercises/types.ts';
import { phraseSpeak, phraseText } from './lexicon.ts';
import type { Lexicon } from './lexicon.ts';
import { practiceLadders } from './practice/ladder.ts';
import { PRACTICE_TOPIC_TITLES } from './practice/topics.ts';
import { HINT_KEYS, HINTS } from './runtime/hints.ts';
import type { Locale, LocalizedText } from './locale.ts';

export interface Speakable {
  readonly text: string;
  readonly speak?: string;
  readonly sources: readonly string[];
}

class SpeakableSet {
  private readonly entries = new Map<
    string,
    { text: string; speak?: string; sources: Set<string> }
  >();

  add(text: string | undefined, source: string, speak?: string): void {
    if (text === undefined || text.trim() === '') {
      return;
    }
    const spoken = speak !== undefined && speak !== text ? speak : undefined;
    const key = `${text}\u0000${spoken ?? ''}`;
    const entry = this.entries.get(key) ?? {
      text,
      ...(spoken !== undefined ? { speak: spoken } : {}),
      sources: new Set<string>(),
    };
    entry.sources.add(source);
    this.entries.set(key, entry);
  }

  list(): Speakable[] {
    return [...this.entries.values()].map((entry) => ({
      ...entry,
      sources: [...entry.sources],
    }));
  }
}

function spokenForm(
  lexicon: Lexicon,
  kind: SlotKind,
  value: SlotValue,
): string | undefined {
  if (kind === 'number') {
    return lexicon.numbers[String(value)]?.speak;
  }
  if (kind === 'letter') {
    return lexicon.letters[String(value)]?.speak;
  }
  if (kind === 'carrier') {
    const entry =
      lexicon.carriers[String(value)] ?? lexicon.digraphs[String(value)];
    return entry === undefined ? undefined : phraseSpeak(entry);
  }
  return undefined;
}

function addExercise(
  set: SpeakableSet,
  content: Content,
  spec: ExerciseSpec,
  locale: Locale,
): void {
  const lexicon = content.lexicons[locale];
  const def = exerciseTypeDef(spec.type);
  for (const use of def.frameUses(spec.params, {
    locale,
    pictures: content.pictures,
  })) {
    for (const segment of speakSegments(
      frameOf(spec.type, use.frame).speak[locale],
    )) {
      if (typeof segment === 'string') {
        set.add(segment, `frame:${spec.type}.${use.frame}`);
        continue;
      }
      for (const value of use.slots[segment.slot] ?? []) {
        const text = resolveSlot(content, segment.kind, value, locale);
        set.add(
          text,
          `slot:${segment.kind}`,
          spokenForm(lexicon, segment.kind, value),
        );
      }
    }
  }
  for (const label of def.labels?.(spec.params, {
    locale,
    pictures: content.pictures,
  }) ?? []) {
    set.add(label, `label:${spec.type}`);
  }
}

function addLexicon(set: SpeakableSet, lexicon: Lexicon): void {
  for (const [key, entry] of Object.entries(lexicon.numbers)) {
    set.add(entry.text, `lexicon:numbers.${key}`, entry.speak);
  }
  for (const [key, entry] of Object.entries(lexicon.letters)) {
    set.add(entry.text, `lexicon:letters.${key}`, entry.speak);
  }
  const sections = [
    'operators',
    'comparison',
    'ordinals',
    'positions',
    'frames',
  ] as const;
  for (const section of sections) {
    for (const [key, text] of Object.entries(lexicon[section])) {
      set.add(text, `lexicon:${section}.${key}`);
    }
  }
  for (const section of ['carriers', 'digraphs'] as const) {
    for (const [key, entry] of Object.entries(lexicon[section])) {
      set.add(
        phraseText(entry),
        `lexicon:${section}.${key}`,
        phraseSpeak(entry),
      );
    }
  }
  for (const [kind, phrases] of Object.entries(lexicon.feedback)) {
    phrases.forEach((text, index) =>
      set.add(text, `lexicon:feedback.${kind}[${index}]`),
    );
  }
}

export function collectSpeakables(
  content: Content,
  locale: Locale,
): Speakable[] {
  const set = new SpeakableSet();
  const say = (text: LocalizedText, source: string) =>
    set.add(text[locale], source);
  for (const track of content.tracks.filter((t) =>
    t.locales.includes(locale),
  )) {
    say(track.title, `track:${track.id}.title`);
    for (const world of track.worlds) {
      say(world.title, `world:${world.id}.title`);
      for (const level of world.levels) {
        say(level.title, `level:${level.id}.title`);
        level.demo.steps.forEach((step, index) =>
          say(step.say, `level:${level.id}.demo.steps[${index}].say`),
        );
        addExercise(set, content, level.demo.exercise, locale);
        for (const generator of level.generators) {
          addExercise(set, content, generator, locale);
        }
      }
    }
  }
  for (const ladder of practiceLadders(
    content.tracks.filter((t) => t.locales.includes(locale)),
  )) {
    say(PRACTICE_TOPIC_TITLES[ladder.topic], `practice:${ladder.topic}.title`);
  }
  for (const key of HINT_KEYS) {
    set.add(HINTS[key][locale], `hint:${key}`);
  }
  addLexicon(set, content.lexicons[locale]);
  return set.list();
}
