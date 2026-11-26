import { TestBed } from '@angular/core/testing';
import { AvatarView } from './avatar';

describe('AvatarView', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(AvatarView);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('layers background, animal and accessory', async () => {
    const host = await render({
      avatar: { animal: 'fox', accessory: 'crown', background: '#FFD8A8' },
      size: 96,
    });
    const images = [...host.querySelectorAll('img')].map((img) => img.getAttribute('src'));

    expect(images).toEqual(['/brand/avatars/fox.svg', '/brand/avatars/accessories/crown.svg']);
    expect(host.style.backgroundColor).toBe('rgb(255, 216, 168)');
    expect(host.style.width).toBe('96px');
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('skips a missing accessory and can carry a label', async () => {
    const host = await render({
      avatar: { animal: 'owl', accessory: null, background: '#C3F0C8' },
      label: 'Eule',
    });

    expect(host.querySelectorAll('img').length).toBe(1);
    expect(host.getAttribute('role')).toBe('img');
    expect(host.getAttribute('aria-label')).toBe('Eule');
    expect(host.getAttribute('aria-hidden')).toBeNull();
  });
});
