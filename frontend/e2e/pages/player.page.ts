import { type Page, expect } from '@playwright/test';
import type { AnyAnswer, GeneratedItem } from '@murmeli/content';
import { type LearnBackend } from '../helpers/learn-fixtures';

type Item = GeneratedItem;

/** Drives the exercise player like a kid would: taps, keypad, drum and tiles. */
export class PlayerPage {
  constructor(
    readonly page: Page,
    private readonly learn: LearnBackend,
  ) {}

  item(index: number): Item {
    return this.learn.current.items[index]!;
  }

  async waitForItem(index: number): Promise<void> {
    const prompt = this.page.getByTestId('prompt-text');
    await expect(async () => {
      expect((await prompt.textContent())?.trim()).toBe(this.item(index).prompt.text);
    }).toPass({ timeout: 10_000 });
    await expect(this.page.getByTestId(`exercise-${this.item(index).type}`)).toBeVisible();
  }

  async answerCorrectly(index: number): Promise<void> {
    await this.give(this.item(index), this.item(index).solution.answer as AnyAnswer);
  }

  async answerWrong(index: number): Promise<void> {
    const item = this.item(index);
    await this.give(item, wrongAnswer(item));
  }

  async next(): Promise<void> {
    await this.page.getByTestId('next').click();
  }

  /** Answers every item correctly, from the current one to the results screen. */
  async playThrough(): Promise<void> {
    const total = this.learn.current.items.length;
    for (let index = 0; index < total; index += 1) {
      await this.waitForItem(index);
      await this.answerCorrectly(index);
      await expect(this.page.getByTestId('feedback')).toHaveAttribute('data-kind', 'correct');
      await this.next();
    }
    await expect(this.page.getByTestId('results')).toBeVisible();
  }

  private async typeNumber(value: number): Promise<void> {
    for (const digit of String(value)) {
      await this.page.getByTestId(`key-${digit}`).click();
    }
  }

  private async clickChoiceWith(value: number | undefined, choiceId?: string): Promise<void> {
    const choice = choiceId
      ? this.page.getByTestId(`choice-${choiceId}`)
      : this.page.locator(`[data-testid^="choice-"][data-value="${value}"]`);
    await choice.click();
  }

  private async give(item: Item, answer: AnyAnswer): Promise<void> {
    const page = this.page;
    const payload = item.payload as unknown as Record<string, unknown>;
    if ('choiceId' in answer) {
      await this.clickChoiceWith(undefined, answer.choiceId);
    } else if ('relation' in answer) {
      await page.getByTestId(`relation-${answer.relation}`).click();
    } else if ('count' in answer) {
      for (let tap = 0; tap < answer.count; tap += 1) {
        await page.getByTestId('drum').click();
      }
      await page.getByTestId('check').click();
    } else if ('letters' in answer) {
      for (const letter of answer.letters) {
        await page.locator(`[data-letter="${letter}"]:not([aria-disabled="true"])`).first().click();
      }
      await page.getByTestId('check').click();
    } else if ('values' in answer && Array.isArray(answer.values)) {
      for (const [blank, value] of answer.values.entries()) {
        await page.getByTestId(`blank-${blank}`).click();
        await this.typeNumber(value);
      }
      await page.getByTestId('check').click();
    } else if ('values' in answer) {
      for (const [cell, value] of Object.entries(answer.values as Record<string, number>)) {
        await page.getByTestId(`brick-${cell}`).click();
        await this.typeNumber(value);
      }
      await page.getByTestId('check').click();
    } else if (item.type === 'number-line' && payload['mode'] === 'place') {
      const { start, step } = payload as { start: number; step: number };
      const line = page.getByTestId('number-line');
      await line.focus();
      await page.keyboard.press('Home');
      for (let tick = 0; tick < Math.round((answer.value - start) / step); tick += 1) {
        await page.keyboard.press('ArrowRight');
      }
      await page.getByTestId('check').click();
    } else if (payload['answerMode'] === 'keypad') {
      await this.typeNumber(answer.value);
      await page.getByTestId('key-ok').click();
    } else {
      await this.clickChoiceWith(answer.value);
    }
  }
}

/** A plausible wrong answer of the right shape for an item. */
export function wrongAnswer(item: Item): AnyAnswer {
  const answer = item.solution.answer as AnyAnswer;
  const payload = item.payload as unknown as {
    choices?: { id: string; value?: number }[];
    maxCount?: number;
    tiles?: { letter: string }[];
    start?: number;
    end?: number;
    step?: number;
  };
  if ('choiceId' in answer) {
    return { choiceId: payload.choices!.find((choice) => choice.id !== answer.choiceId)!.id };
  }
  if ('relation' in answer) {
    return { relation: answer.relation === 'lt' ? 'gt' : 'lt' };
  }
  if ('count' in answer) {
    return { count: answer.count === 1 ? 2 : 1 };
  }
  if ('letters' in answer) {
    const letters = [...answer.letters];
    const other = payload.tiles!.map((tile) => tile.letter).find((l) => l !== letters[0]);
    letters[0] = other ?? letters[0]!;
    if (other === undefined || letters.join() === answer.letters.join()) {
      letters.reverse();
    }
    return { letters };
  }
  if ('values' in answer && Array.isArray(answer.values)) {
    return { values: answer.values.map((value) => value + 1) };
  }
  if ('values' in answer) {
    const values = answer.values as Record<string, number>;
    return { values: Object.fromEntries(Object.entries(values).map(([k, v]) => [k, v + 1])) };
  }
  if (payload.choices) {
    return { value: payload.choices.find((choice) => choice.value !== answer.value)!.value! };
  }
  if (payload.step !== undefined && payload.start !== undefined) {
    const next = answer.value + payload.step;
    return { value: next <= payload.end! ? next : payload.start };
  }
  return { value: answer.value + 1 };
}
