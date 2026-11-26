import { DOCUMENT, DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { SafeStorage } from '../storage/safe-storage';

export type ThemeMode = 'light' | 'dark' | 'system';
export type ResolvedTheme = Exclude<ThemeMode, 'system'>;

export const THEME_STORAGE_KEY = 'mu-theme';
const DARK_QUERY = '(prefers-color-scheme: dark)';
const MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly storage = inject(SafeStorage);
  private readonly mediaQuery = this.document.defaultView?.matchMedia?.(DARK_QUERY) ?? null;
  private readonly systemPrefersDark = signal(this.mediaQuery?.matches ?? false);

  readonly mode = signal<ThemeMode>(this.readStoredMode());
  readonly resolved = computed<ResolvedTheme>(() => {
    const mode = this.mode();
    if (mode !== 'system') {
      return mode;
    }
    return this.systemPrefersDark() ? 'dark' : 'light';
  });
  readonly isDark = computed(() => this.resolved() === 'dark');

  constructor() {
    this.watchSystemPreference();
    effect(() => this.apply(this.mode()));
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
    this.storage.set(THEME_STORAGE_KEY, mode);
  }

  toggle(): void {
    this.setMode(this.isDark() ? 'light' : 'dark');
  }

  private apply(mode: ThemeMode): void {
    const root = this.document.documentElement;
    if (mode === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', mode);
    }
  }

  private readStoredMode(): ThemeMode {
    const stored = this.storage.get(THEME_STORAGE_KEY);
    return MODES.find((mode) => mode === stored) ?? 'system';
  }

  private watchSystemPreference(): void {
    const query = this.mediaQuery;
    if (!query) {
      return;
    }
    const listener = (event: MediaQueryListEvent) => this.systemPrefersDark.set(event.matches);
    query.addEventListener('change', listener);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', listener));
  }
}
