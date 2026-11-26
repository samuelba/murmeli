import { TestBed } from '@angular/core/testing';
import { renderComponent, settle } from '../../../testing/app-testing';
import { provideTranslocoTesting } from '../../../testing/i18n';
import { Altcha } from './altcha';
import { ALTCHA_LOADER } from './altcha-loader';

describe('Altcha', () => {
  let i18n: Record<string, Record<string, string>>;

  beforeEach(() => {
    i18n = {};
    (globalThis as Record<string, unknown>)['$altcha'] = {
      i18n: { set: (name: string, value: Record<string, string>) => (i18n[name] = value) },
    };
  });

  afterEach(() => {
    delete (globalThis as Record<string, unknown>)['$altcha'];
  });

  function setup(loader: () => Promise<void>) {
    TestBed.configureTestingModule({
      providers: [provideTranslocoTesting(), { provide: ALTCHA_LOADER, useValue: loader }],
    });
  }

  it('renders the widget with the challenge url and translated strings', async () => {
    setup(() => Promise.resolve());
    const { element, fixture } = await renderComponent(Altcha);
    await settle(fixture);
    const widget = element.querySelector('altcha-widget') as HTMLElement & {
      configure?: unknown;
    };

    expect(widget.getAttribute('challenge')).toBe('/api/auth/altcha');
    expect(widget.getAttribute('language')).toBe('de');
    expect(i18n['de']['label']).toBe('Ich bin ein Mensch');
  });

  it('emits the payload when verified and null otherwise', async () => {
    setup(() => Promise.resolve());
    const { element, fixture } = await renderComponent(Altcha);
    await settle(fixture);
    const emitted: (string | null)[] = [];
    fixture.componentInstance.verified.subscribe((value) => emitted.push(value));
    const widget = element.querySelector('altcha-widget') as HTMLElement;

    widget.dispatchEvent(
      new CustomEvent('statechange', { detail: { state: 'verified', payload: 'abc' } }),
    );
    widget.dispatchEvent(new CustomEvent('statechange', { detail: { state: 'expired' } }));
    fixture.componentInstance.reset();

    expect(emitted).toEqual(['abc', null, null]);
  });

  it('renders nothing when the widget fails to load', async () => {
    setup(() => Promise.reject(new Error('offline')));
    const { element, fixture } = await renderComponent(Altcha);
    await settle(fixture);
    expect(element.querySelector('altcha-widget')).toBeNull();
  });
});
