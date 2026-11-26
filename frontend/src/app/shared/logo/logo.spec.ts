import { TestBed } from '@angular/core/testing';
import { Logo } from './logo';

describe('Logo', () => {
  it('is decorative and only animates on request', async () => {
    const fixture = TestBed.createComponent(Logo);
    const host = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();

    expect(host.getAttribute('aria-hidden')).toBe('true');
    expect(host.classList).not.toContain('mu-logo--animated');

    fixture.componentRef.setInput('animated', true);
    await fixture.whenStable();

    expect(host.classList).toContain('mu-logo--animated');
  });
});
