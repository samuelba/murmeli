import { Type } from '@angular/core';
import { byTestId, renderComponent } from './app-testing';

interface Answering {
  answered: { subscribe(listener: (value: unknown) => void): unknown };
}

/** Renders an exercise component and collects what it answers. */
export async function renderExercise<T>(component: Type<T>, inputs: Record<string, unknown>) {
  const result = await renderComponent(component, inputs);
  const answers: unknown[] = [];
  (result.fixture.componentInstance as unknown as Answering).answered.subscribe((answer) =>
    answers.push(answer),
  );
  const update = async (next: Record<string, unknown>) => {
    Object.entries(next).forEach(([key, value]) =>
      result.fixture.componentRef.setInput(key, value),
    );
    await result.fixture.whenStable();
  };
  const click = async (id: string) => {
    byTestId(result.element, id).click();
    await result.fixture.whenStable();
  };
  const type = async (text: string) => {
    for (const key of text) {
      await click(`key-${key}`);
    }
  };
  return { ...result, answers, update, click, type };
}

export function keydown(
  target: EventTarget,
  key: string,
  init: KeyboardEventInit = {},
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

export function pointer(
  target: EventTarget,
  type: string,
  x: number,
  y: number,
  init: PointerEventInit = {},
): PointerEvent {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientX: x,
    clientY: y,
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

/** A fake narrator for `SPEAK_PROVIDER`: records what is spoken, knows some clips. */
export function fakeSpeaker(known: readonly string[] = []) {
  const spoken: unknown[] = [];
  return {
    spoken,
    provider: {
      speak: (input: unknown) => spoken.push(input),
      canSpeak: (input: string | readonly string[]) =>
        (typeof input === 'string' ? [input] : input).some((text) => known.includes(text)),
    },
  };
}
