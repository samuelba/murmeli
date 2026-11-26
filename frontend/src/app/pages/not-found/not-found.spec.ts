import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { provideTranslocoTesting } from '../../../testing/i18n';
import { NotFound } from './not-found';

describe('NotFound', () => {
  async function render() {
    TestBed.configureTestingModule({
      imports: [NotFound],
      providers: [provideRouter([]), provideTranslocoTesting()],
    });
    const fixture = TestBed.createComponent(NotFound);
    await fixture.whenStable();
    return fixture;
  }

  it('shows a friendly message and a way back home', async () => {
    const fixture = await render();
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('h1')?.textContent).toContain('Hoppla');
    expect(element.textContent).toContain('Murmeltier');
    expect(element.querySelector('[data-testid="back-home"]')?.getAttribute('href')).toBe('/');
  });

  it('follows the active language', async () => {
    const fixture = await render();

    TestBed.inject(TranslocoService).setActiveLang('en-US');
    await fixture.whenStable();

    expect((fixture.nativeElement as HTMLElement).querySelector('h1')?.textContent).toContain(
      'Oops',
    );
  });
});
