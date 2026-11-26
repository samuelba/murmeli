import { DOCUMENT, InjectionToken, inject } from '@angular/core';

/** Reloads the page (a fake in tests). */
export const PAGE_RELOAD = new InjectionToken<() => void>('PAGE_RELOAD', {
  providedIn: 'root',
  factory: () => {
    const location = inject(DOCUMENT).location;
    return () => location.reload();
  },
});
