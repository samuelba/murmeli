type ChangeListener = (event: MediaQueryListEvent) => void;

export interface FakeMediaQuery {
  setMatches(matches: boolean): void;
  listenerCount(): number;
}

function view(): Window {
  const defaultView = document.defaultView;
  if (!defaultView) {
    throw new Error('No window available in the test environment');
  }
  return defaultView;
}

export function stubMatchMedia(initial: boolean): FakeMediaQuery {
  const listeners = new Set<ChangeListener>();
  let matches = initial;
  const query = {
    get matches() {
      return matches;
    },
    addEventListener: (_type: string, listener: ChangeListener) => listeners.add(listener),
    removeEventListener: (_type: string, listener: ChangeListener) => listeners.delete(listener),
  };
  Object.defineProperty(view(), 'matchMedia', { configurable: true, value: () => query });
  return {
    setMatches(next: boolean) {
      matches = next;
      listeners.forEach((listener) => listener({ matches: next } as MediaQueryListEvent));
    },
    listenerCount: () => listeners.size,
  };
}

export function stubNavigatorLanguages(languages: readonly string[]): void {
  const navigator = view().navigator;
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  vi.spyOn(navigator, 'language', 'get').mockReturnValue(languages[0] ?? '');
}

export function resetDocumentState(): void {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('lang');
  Reflect.deleteProperty(view(), 'matchMedia');
  vi.restoreAllMocks();
}
