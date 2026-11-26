import { TestBed } from '@angular/core/testing';
import { Mascot } from './mascot';

describe('Mascot', () => {
  async function render(inputs: Record<string, unknown>) {
    const fixture = TestBed.createComponent(Mascot);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the pose as a decorative image', async () => {
    const host = await render({ pose: 'encouraging' });
    const img = host.querySelector('img');

    expect(img?.getAttribute('src')).toBe('/brand/mascot/encouraging.svg');
    expect(img?.getAttribute('alt')).toBe('');
    expect(host.dataset['pose']).toBe('encouraging');
  });

  it('inlines the animated thinking pose with a unique gradient id', async () => {
    const host = await render({ pose: 'thinking', animated: true });
    const other = await render({ pose: 'thinking', animated: true });
    const id = host.querySelector('linearGradient')?.id;

    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('svg.mu-mascot--animated')).not.toBeNull();
    expect(id).toMatch(/^mu-mascot-fur-\d+$/);
    expect(other.querySelector('linearGradient')?.id).not.toBe(id);
  });

  it('uses the static image for other animated poses', async () => {
    const host = await render({ pose: 'cheering', animated: true });

    expect(host.querySelector('img')?.getAttribute('src')).toBe('/brand/mascot/cheering.svg');
  });
});
