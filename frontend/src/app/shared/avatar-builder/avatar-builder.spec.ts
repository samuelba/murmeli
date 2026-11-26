import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Avatar } from '../../core/avatars/avatar-catalog';
import { byTestId, renderComponent } from '../../../testing/app-testing';
import { provideTranslocoTesting } from '../../../testing/i18n';
import { AvatarBuilder } from './avatar-builder';

@Component({
  imports: [AvatarBuilder],
  template: `<mu-avatar-builder [(avatar)]="avatar" />`,
})
class Host {
  readonly avatar = signal<Avatar>({ animal: 'fox', accessory: null, background: '#FFD8A8' });
}

describe('AvatarBuilder', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideTranslocoTesting()] });
  });

  async function pick(element: HTMLElement, id: string) {
    const input = byTestId<HTMLInputElement>(element, id);
    input.click();
  }

  it('offers every animal, accessory (plus none) and background as labelled radios', async () => {
    const { element } = await renderComponent(Host);

    expect(element.querySelectorAll('input[name$="-animal"]').length).toBe(30);
    expect(element.querySelectorAll('input[name$="-accessory"]').length).toBe(9);
    expect(element.querySelectorAll('input[name$="-background"]').length).toBe(10);
    expect(byTestId(element, 'avatar-animal-fox').getAttribute('aria-label')).toBe('Fuchs');
    expect(byTestId<HTMLInputElement>(element, 'avatar-animal-fox').checked).toBe(true);
    expect(byTestId<HTMLInputElement>(element, 'avatar-accessory-none').checked).toBe(true);
    expect(element.querySelectorAll('legend').length).toBe(3);
  });

  it('updates the two-way bound avatar and the live preview', async () => {
    const { element, fixture } = await renderComponent(Host);
    await pick(element, 'avatar-animal-owl');
    await pick(element, 'avatar-accessory-crown');
    await pick(element, 'avatar-background-4');
    await fixture.whenStable();

    expect(fixture.componentInstance.avatar()).toEqual({
      animal: 'owl',
      accessory: 'crown',
      background: '#B9D3FF',
    });
    const preview = byTestId(element, 'avatar-preview');
    const sources = [...preview.querySelectorAll('img')].map((img) => img.getAttribute('src'));
    expect(sources).toEqual(['/brand/avatars/owl.svg', '/brand/avatars/accessories/crown.svg']);
    expect(preview.querySelector('mu-avatar')?.getAttribute('aria-label')).toBe('Eule');
    expect(element.querySelectorAll('.option.selected').length).toBe(3);
    expect(byTestId(element, 'avatar-status').textContent).toContain(
      'Vorschau: Eule mit Krone, Hintergrund Himmelblau',
    );
    expect(byTestId(element, 'avatar-background-4').getAttribute('aria-label')).toBe('Himmelblau');

    await pick(element, 'avatar-accessory-none');
    await fixture.whenStable();
    expect(fixture.componentInstance.avatar().accessory).toBeNull();
    expect(byTestId(element, 'avatar-status').textContent).toContain('Eule ohne Extra');
  });
});
