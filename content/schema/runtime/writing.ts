import { renderPrompt } from '../exercises/frames.ts';
import type { ExerciseParams, ExerciseTypeId } from '../exercises/registry.ts';
import { sentenceScenes } from '../exercises/writing.ts';
import { GLYPH_GUIDES, GLYPHS } from '../glyphs.ts';
import { sceneKey, sceneSentence } from '../sentences.ts';
import type { Scene } from '../sentences.ts';
import {
  ChoiceAnswerSchema,
  LettersAnswerSchema,
  StrokesAnswerSchema,
} from './answers.ts';
import type { ChoiceAnswer, LettersAnswer, StrokesAnswer } from './answers.ts';
import { pickFocus, withIds } from './helpers.ts';
import { wordTiles } from './literacy.ts';
import type { Rng } from './rng.ts';
import type { Choice, ExerciseRuntime } from './types.ts';

type Params<K extends ExerciseTypeId> = ExerciseParams<K>;

export interface TraceLetterPayload {
  readonly char: string;
  readonly strokes: readonly (readonly (readonly [number, number])[])[];
  readonly guides: typeof GLYPH_GUIDES;
  readonly showModel: boolean;
}

export const traceLetterRuntime: ExerciseRuntime<
  Params<'trace-letter'>,
  TraceLetterPayload,
  StrokesAnswer
> = {
  answerSchema: StrokesAnswerSchema,
  generate(rng, p, ctx) {
    const char = pickFocus(rng, p.letters, ctx);
    const strokes = GLYPHS[char]!.strokes.map((stroke) => stroke.points);
    const digit = /^\d$/.test(char);
    return {
      prompt: digit
        ? renderPrompt(ctx.content, 'trace-letter', 'digit', ctx.locale, {
            target: Number(char),
          })
        : renderPrompt(ctx.content, 'trace-letter', 'letter', ctx.locale, {
            target: char.toLocaleUpperCase('de-CH'),
          }),
      payload: { char, strokes, guides: GLYPH_GUIDES, showModel: p.showModel },
      solution: {
        answer: {
          strokes: strokes.map((points) =>
            points.map(([x, y]) => [x, y] as [number, number]),
          ),
        },
        hint: 'trace-slowly',
        rule: {
          kind: 'trace',
          glyph: char,
          tolerance: p.tolerance,
          strictOrder: p.strictOrder,
          strictDirection: p.strictDirection,
        },
      },
      focus: char,
    };
  },
};

export interface ListenWritePayload {
  readonly length: number;
  readonly tiles: readonly { readonly id: string; readonly letter: string }[];
}

export const listenWriteRuntime: ExerciseRuntime<
  Params<'listen-write'>,
  ListenWritePayload,
  LettersAnswer
> = {
  answerSchema: LettersAnswerSchema,
  generate(rng, p, ctx) {
    const pictureId = pickFocus(rng, p.words, ctx);
    const { letters, tiles } = wordTiles(
      rng,
      ctx,
      pictureId,
      p.extraTiles,
      p.case,
    );
    return {
      prompt: renderPrompt(ctx.content, 'listen-write', 'main', ctx.locale, {
        picture: pictureId,
      }),
      payload: { length: letters.length, tiles },
      solution: { answer: { letters }, hint: 'say-the-word-slowly' },
      focus: pictureId,
    };
  },
};

export interface SceneChoice extends Choice {
  readonly scene: Scene;
}

export interface SentencePicturePayload {
  readonly sentence: string;
  readonly choices: readonly SceneChoice[];
}

function distractors(
  rng: Rng,
  target: Scene,
  scenes: readonly Scene[],
  count: number,
): Scene[] {
  const others = scenes.filter((scene) => sceneKey(scene) !== sceneKey(target));
  const close = others.filter((scene) =>
    target.kind === 'count'
      ? scene.kind === 'count' &&
        (scene.pictureId === target.pictureId || scene.count === target.count)
      : scene.kind === 'position' &&
        ((scene.subject === target.subject && scene.object === target.object) ||
          (scene.subject === target.object && scene.object === target.subject)),
  );
  const rest = others.filter((scene) => !close.includes(scene));
  return [...rng.shuffle(close), ...rng.shuffle(rest)].slice(0, count);
}

export const sentencePictureRuntime: ExerciseRuntime<
  Params<'sentence-picture'>,
  SentencePicturePayload,
  ChoiceAnswer
> = {
  answerSchema: ChoiceAnswerSchema,
  generate(rng, p, ctx) {
    const scenes = sentenceScenes(p).filter(
      (scene) =>
        sceneSentence(scene, ctx.content.pictures, ctx.locale) !== undefined,
    );
    const wanted = ctx.demo?.target;
    const preferred = scenes.filter((scene) =>
      scene.kind === 'count'
        ? scene.pictureId === wanted || scene.count === wanted
        : scene.subject === wanted,
    );
    const target = pickFocus(
      rng,
      (preferred.length > 0 ? preferred : scenes).map(sceneKey),
      ctx,
    );
    const scene = scenes.find((candidate) => sceneKey(candidate) === target)!;
    const options = rng.shuffle([
      scene,
      ...distractors(rng, scene, scenes, p.choices - 1),
    ]);
    const choices = withIds(
      rng,
      options.map((option) => ({ scene: option })),
    );
    return {
      prompt: renderPrompt(
        ctx.content,
        'sentence-picture',
        'main',
        ctx.locale,
        {},
      ),
      payload: {
        sentence: sceneSentence(scene, ctx.content.pictures, ctx.locale)!,
        choices,
      },
      solution: {
        answer: { choiceId: choices[options.indexOf(scene)]!.id },
        hint: 'read-each-word',
      },
      focus: scene.kind === 'count' ? scene.pictureId : scene.subject,
    };
  },
};
