import { TestBed } from '@angular/core/testing';
import { byTestId, renderComponent } from '../../../testing/app-testing';
import { provideTranslocoTesting } from '../../../testing/i18n';
import { PinPad } from './pin-pad';

describe('PinPad', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  async function render(inputs: Record<string, unknown> = {}) {
    const result = await renderComponent(PinPad, inputs);
    const completed: number[][] = [];
    result.fixture.componentInstance.completed.subscribe((pin) => completed.push(pin));
    const tap = async (index: number) => {
      byTestId(result.element, `pin-picture-${index}`).click();
      await result.fixture.whenStable();
    };
    const filled = () => result.element.querySelectorAll('.dot.filled').length;
    return { ...result, completed, tap, filled };
  }

  it('shows nine labelled pictures and four empty dots', async () => {
    const { element } = await render();
    const pictures = element.querySelectorAll<HTMLButtonElement>('.picture');

    expect(pictures.length).toBe(9);
    expect(pictures[0].getAttribute('aria-label')).toBe('Kuh, Bild 1 von 9');
    const names = [...pictures].map((picture) => picture.getAttribute('aria-label')?.split(',')[0]);
    expect(new Set(names).size).toBe(9);
    expect(element.querySelector('[role="group"]')?.getAttribute('aria-describedby')).toMatch(
      /^pin-pad-hint-/,
    );
    expect(pictures[0].querySelector('img')?.getAttribute('alt')).toBe('');
    expect(element.querySelectorAll('.dot').length).toBe(4);
  });

  it('emits the four chosen indexes in order', async () => {
    const { tap, completed, filled, element } = await render();
    await tap(3);
    await tap(0);
    expect(filled()).toBe(2);
    expect(byTestId(element, 'pin-progress').textContent).toContain('2 von 4');
    await tap(8);
    await tap(3);

    expect(completed).toEqual([[3, 0, 8, 3]]);
    await tap(5);
    expect(completed.length).toBe(1);
  });

  it('removes the last picture with the undo button and Backspace', async () => {
    const { tap, filled, element, fixture } = await render();
    await tap(1);
    await tap(2);
    byTestId(element, 'pin-undo').click();
    await fixture.whenStable();
    expect(filled()).toBe(1);

    element
      .querySelector('.pin-pad')
      ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace' }));
    await fixture.whenStable();
    expect(filled()).toBe(0);
  });

  it('accepts the digit keys 1–9 from the keyboard', async () => {
    const { element, completed, fixture } = await render();
    const pad = element.querySelector('.pin-pad') as HTMLElement;
    for (const key of ['1', '5', '9', '2', 'a']) {
      pad.dispatchEvent(new KeyboardEvent('keydown', { key }));
    }
    await fixture.whenStable();
    expect(completed).toEqual([[0, 4, 8, 1]]);
  });

  it('shakes and clears on reject, and ignores taps while disabled', async () => {
    const { tap, filled, element, fixture, completed } = await render();
    await tap(1);
    fixture.componentInstance.reject();
    await fixture.whenStable();
    expect(filled()).toBe(0);
    expect(element.querySelector('.pin-pad')?.classList).toContain('shake');
    await new Promise((resolve) => setTimeout(resolve, 700));
    await fixture.whenStable();
    expect(element.querySelector('.pin-pad')?.classList).not.toContain('shake');
    expect(byTestId(element, 'pin-dots').classList).toContain('error');
    expect(document.activeElement).toBe(byTestId(element, 'pin-picture-0'));
    expect(byTestId(element, 'pin-progress').textContent).toContain('0 von 4');

    fixture.componentRef.setInput('disabled', true);
    await fixture.whenStable();
    const first = byTestId<HTMLButtonElement>(element, 'pin-picture-0');
    expect(first.disabled).toBe(false);
    expect(first.getAttribute('aria-disabled')).toBe('true');
    first.click();
    fixture.componentInstance.undo();
    expect(completed).toEqual([]);
    expect(filled()).toBe(0);

    fixture.componentRef.setInput('disabled', false);
    await tap(3);
    expect(byTestId(element, 'pin-dots').classList).not.toContain('error');
  });
});
