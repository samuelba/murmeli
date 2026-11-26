import { TestBed } from '@angular/core/testing';
import { BRAND_NAME } from '../../core/brand';
import { Logo } from './logo';

describe('Logo', () => {
  async function render(inputs: Record<string, unknown> = {}) {
    const fixture = TestBed.createComponent(Logo);
    Object.entries(inputs).forEach(([key, value]) => fixture.componentRef.setInput(key, value));
    await fixture.whenStable();
    return (fixture.nativeElement as HTMLElement).querySelector('svg') as SVGSVGElement;
  }

  it('is decorative and static by default', async () => {
    const svg = await render();

    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.getAttribute('role')).toBeNull();
    expect(svg.classList).not.toContain('mu-logo--animated');
  });

  it('animates on request', async () => {
    const svg = await render({ animated: true });

    expect(svg.classList).toContain('mu-logo--animated');
  });

  it('can be a labelled image', async () => {
    const svg = await render({ decorative: false });

    expect(svg.getAttribute('role')).toBe('img');
    expect(svg.getAttribute('aria-label')).toBe(BRAND_NAME);
  });

  it('gives every instance its own gradient and clip ids', async () => {
    const first = await render();
    const second = await render();
    const firstId = first.querySelector('linearGradient')?.id;

    expect(firstId).toMatch(/^mu-logo-sky-\d+$/);
    expect(second.querySelector('linearGradient')?.id).not.toBe(firstId);
    expect(first.querySelector('rect[fill^="url"]')?.getAttribute('fill')).toBe(`url(#${firstId})`);
  });
});
