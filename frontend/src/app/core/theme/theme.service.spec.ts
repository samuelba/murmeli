import { TestBed } from '@angular/core/testing';
import { resetDocumentState, stubMatchMedia } from '../../../testing/browser';
import { THEME_STORAGE_KEY, ThemeService } from './theme.service';

describe('ThemeService', () => {
  const root = document.documentElement;

  function create(): ThemeService {
    const service = TestBed.inject(ThemeService);
    TestBed.tick();
    return service;
  }

  afterEach(() => resetDocumentState());

  it('defaults to the system theme and leaves data-theme unset', () => {
    const service = create();

    expect(service.mode()).toBe('system');
    expect(service.resolved()).toBe('light');
    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('follows the system preference in system mode', () => {
    const media = stubMatchMedia(true);
    const service = create();

    expect(service.isDark()).toBe(true);
    media.setMatches(false);
    expect(service.isDark()).toBe(false);
  });

  it('restores a stored mode and applies it to <html>', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'dark');
    const service = create();

    expect(service.mode()).toBe('dark');
    expect(root.getAttribute('data-theme')).toBe('dark');
  });

  it('ignores invalid stored values', () => {
    localStorage.setItem(THEME_STORAGE_KEY, 'purple');

    expect(create().mode()).toBe('system');
  });

  it('toggles between light and dark and persists the choice', () => {
    stubMatchMedia(false);
    const service = create();

    service.toggle();
    TestBed.tick();
    expect(root.getAttribute('data-theme')).toBe('dark');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('dark');

    service.toggle();
    TestBed.tick();
    expect(root.getAttribute('data-theme')).toBe('light');
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light');
  });

  it('removes data-theme when switching back to system', () => {
    const service = create();
    service.setMode('dark');
    TestBed.tick();

    service.setMode('system');
    TestBed.tick();

    expect(root.hasAttribute('data-theme')).toBe(false);
  });

  it('stops listening to the system preference when destroyed', () => {
    const media = stubMatchMedia(false);
    create();
    expect(media.listenerCount()).toBe(1);

    TestBed.resetTestingModule();

    expect(media.listenerCount()).toBe(0);
  });
});
