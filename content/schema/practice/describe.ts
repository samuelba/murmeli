import type { Picture } from '../pictures.ts';
import type { Locale } from '../locale.ts';
import type { GeneratedExercise } from '../runtime/exercise.ts';

const RELATION_SIGNS = { lt: '<', gt: '>', eq: '=' } as const;

/** The spoken prompt as one sentence: "Hör gut zu: Hund. Wie viele Silben hörst du?" */
export function spokenQuestion(speak: readonly string[]): string {
  return speak
    .map((segment) => segment.trim())
    .filter(Boolean)
    .reduce((text, segment) => {
      if (text === '') {
        return segment;
      }
      const ended = /[.:?!]$/.test(text);
      const startsSentence = /^\p{Lu}/u.test(segment) && segment.includes(' ');
      return `${text}${!ended && startsSentence ? '.' : ''} ${segment}`;
    }, '');
}

interface ChoiceLike {
  readonly id?: unknown;
  readonly label?: unknown;
  readonly value?: unknown;
  readonly pictureId?: unknown;
}

function choiceText(
  payload: unknown,
  choiceId: unknown,
  pictures: Readonly<Record<string, Picture>>,
  locale: Locale,
): string | null {
  const choices = (payload as { choices?: readonly ChoiceLike[] }).choices;
  const choice = choices?.find((c) => c.id === choiceId);
  if (choice === undefined) {
    return null;
  }
  if (typeof choice.label === 'string') {
    return choice.label;
  }
  if (typeof choice.value === 'number') {
    return String(choice.value);
  }
  return typeof choice.pictureId === 'string'
    ? (pictures[choice.pictureId]?.words[locale] ?? null)
    : null;
}

/** The right answer as text for parents, or null when it is a drawing or coins. */
export function answerText(
  exercise: Pick<GeneratedExercise, 'payload' | 'solution'>,
  pictures: Readonly<Record<string, Picture>>,
  locale: Locale,
): string | null {
  const answer = exercise.solution.answer as Record<string, unknown>;
  if (typeof answer.value === 'number') {
    return String(answer.value);
  }
  if (typeof answer.count === 'number') {
    return String(answer.count);
  }
  if (Array.isArray(answer.values)) {
    return answer.values.join(', ');
  }
  if (Array.isArray(answer.letters)) {
    return answer.letters.join('');
  }
  if (typeof answer.relation === 'string') {
    return RELATION_SIGNS[answer.relation as keyof typeof RELATION_SIGNS];
  }
  if (answer.values !== null && typeof answer.values === 'object') {
    return Object.values(answer.values as Record<string, number>).join(', ');
  }
  if (answer.choiceId !== undefined) {
    return choiceText(exercise.payload, answer.choiceId, pictures, locale);
  }
  return null;
}
