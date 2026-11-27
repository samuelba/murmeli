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

const OBJECT_URL_METHODS = ['createObjectURL', 'revokeObjectURL'] as const;
let originalObjectUrlMethods: Map<string, PropertyDescriptor | undefined> | null = null;

/** Replaces the runtime's blob URLs, which reject jsdom Blobs on some Node versions. */
export function stubObjectUrls(url = 'blob:test') {
  restoreObjectUrls();
  originalObjectUrlMethods = new Map(
    OBJECT_URL_METHODS.map((name) => [name, Object.getOwnPropertyDescriptor(URL, name)]),
  );
  const create = vi.fn<typeof URL.createObjectURL>(() => url);
  const revoke = vi.fn<typeof URL.revokeObjectURL>();
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: create,
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: revoke,
  });
  return { create, revoke };
}

export function restoreObjectUrls(): void {
  originalObjectUrlMethods?.forEach((descriptor, name) => {
    if (descriptor) {
      Object.defineProperty(URL, name, descriptor);
    } else {
      Reflect.deleteProperty(URL, name);
    }
  });
  originalObjectUrlMethods = null;
}

export function resetDocumentState(): void {
  localStorage.clear();
  document.documentElement.removeAttribute('data-theme');
  document.documentElement.removeAttribute('lang');
  Reflect.deleteProperty(view(), 'matchMedia');
  vi.restoreAllMocks();
}
