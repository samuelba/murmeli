import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { FormBuilder } from '@angular/forms';
import { byTestId, renderComponent, type } from '../../testing/app-testing';
import { provideTranslocoTesting } from '../../testing/i18n';
import { FormError } from './form-error/form-error';
import { NewPasswordFields, newPasswordGroup } from './new-password/new-password';
import { PasswordStrengthMeter } from './password-strength/password-strength';
import { Speak } from './speak/speak';
import { SPEAK_PROVIDER } from './speak/speak-provider';

@Component({
  imports: [NewPasswordFields],
  template: `<mu-new-password [group]="group" />`,
})
class PasswordHost {
  readonly group = newPasswordGroup(new FormBuilder());
}

describe('shared components', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  it('Speak renders nothing until an audio provider exists', async () => {
    const { element } = await renderComponent(Speak, { text: 'Wer lernt heute?' });
    expect(element.querySelector('button')).toBeNull();
  });

  it('Speak hands the text to the audio provider', async () => {
    const speak = vi.fn();
    TestBed.overrideProvider(SPEAK_PROVIDER, { useValue: { speak } });
    const { element } = await renderComponent(Speak, { text: 'Wer lernt heute?' });
    const button = byTestId(element, 'speak');
    button.click();

    expect(button.getAttribute('aria-label')).toBe('Vorlesen: Wer lernt heute?');
    expect(speak).toHaveBeenCalledWith('Wer lernt heute?');
  });

  it('Speak stays hidden until the provider has a clip and then plays the segments', async () => {
    const speak = vi.fn();
    const available = signal(false);
    const prepare = vi.fn();
    TestBed.overrideProvider(SPEAK_PROVIDER, {
      useValue: {
        speak,
        available,
        prepare,
        canSpeak: (input: readonly string[]) => available() && input.includes('7'),
      },
    });
    const { element, fixture } = await renderComponent(Speak, {
      text: 'Wie viel ist 7?',
      segments: ['Wie viel ist', '7'],
    });
    expect(prepare).toHaveBeenCalled();
    expect(element.querySelector('button')).toBeNull();

    available.set(true);
    await fixture.whenStable();
    byTestId(element, 'speak').click();
    expect(speak).toHaveBeenCalledWith(['Wie viel ist', '7']);

    fixture.componentRef.setInput('segments', ['Wie viel ist']);
    await fixture.whenStable();
    expect(element.querySelector('button')).toBeNull();
  });

  it('FormError announces translated messages', async () => {
    const { element, fixture } = await renderComponent(FormError);
    expect(element.querySelector('[role="alert"]')?.textContent?.trim()).toBe('');

    fixture.componentRef.setInput('error', {
      key: 'errors.RATE_LIMITED_SECONDS',
      params: { count: 9 },
    });
    await fixture.whenStable();
    expect(byTestId(element, 'form-error').textContent).toContain('9 Sekunden');
  });

  it('PasswordStrengthMeter describes the strength in words', async () => {
    const { element, fixture } = await renderComponent(PasswordStrengthMeter, { password: 'abc' });
    const meter = element.querySelector('[role="meter"]') as HTMLElement;
    expect(meter.getAttribute('aria-valuenow')).toBe('1');
    expect(meter.getAttribute('aria-valuetext')).toBe('schwach');

    fixture.componentRef.setInput('password', 'Mixed case words 2026!');
    await fixture.whenStable();
    expect(meter.getAttribute('aria-valuetext')).toBe('stark');
    expect(element.querySelectorAll('.segment.on').length).toBe(4);
  });

  it('NewPasswordFields validates length and the repeated password', async () => {
    const { element, fixture } = await renderComponent(PasswordHost);
    const group = fixture.componentInstance.group;
    type(byTestId<HTMLInputElement>(element, 'new-password'), 'short');
    type(byTestId<HTMLInputElement>(element, 'new-password-confirm'), 'other');
    await fixture.whenStable();

    expect(group.controls.password.hasError('minlength')).toBe(true);
    expect(group.controls.confirm.hasError('mismatch')).toBe(true);
    expect(element.textContent).toContain('Mindestens 10 Zeichen');

    type(byTestId<HTMLInputElement>(element, 'new-password'), 'other');
    await fixture.whenStable();
    expect(group.controls.confirm.hasError('mismatch')).toBe(false);
    expect(byTestId(element, 'password-strength').dataset['score']).toBe('1');
  });
});
