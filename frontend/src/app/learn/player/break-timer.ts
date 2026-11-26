import { DOCUMENT, DestroyRef, Injectable, InjectionToken, inject } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { filter } from 'rxjs';

export const BREAK_AFTER_MS = 20 * 60_000;
export const IDLE_RESET_MS = 5 * 60_000;

/** The clock (a fake in tests). */
export const BREAK_CLOCK = new InjectionToken<() => number>('BREAK_CLOCK', {
  providedIn: 'root',
  factory: () => () => Date.now(),
});

export function isPlayerUrl(url: string): boolean {
  return /^\/learn\/(?:level\/[^/?#]+|practice)(?:[?#]|$)/.test(url);
}

/**
 * Time spent on player pages in this session. Five minutes without a tap or key press, or a
 * visit to the profile picker, start it over. After a reminder, the next one is 20 minutes
 * of play away.
 */
@Injectable({ providedIn: 'root' })
export class BreakTimer {
  private readonly now = inject(BREAK_CLOCK);
  private played = 0;
  private segmentStart: number | null = null;
  private lastInput: number;

  constructor() {
    this.lastInput = this.now();
    const document = inject(DOCUMENT);
    const input = () => this.input();
    document.addEventListener('pointerdown', input, { capture: true, passive: true });
    document.addEventListener('keydown', input, { capture: true, passive: true });
    const router = inject(Router);
    const subscription = router.events
      .pipe(filter((event) => event instanceof NavigationEnd))
      .subscribe((event) => this.navigated(event.urlAfterRedirects));
    this.navigated(router.url);
    inject(DestroyRef).onDestroy(() => {
      subscription.unsubscribe();
      document.removeEventListener('pointerdown', input, { capture: true });
      document.removeEventListener('keydown', input, { capture: true });
    });
  }

  /** Play time so far, in ms. */
  elapsed(): number {
    this.expireIdle();
    const now = this.now();
    return this.played + (this.segmentStart === null ? 0 : now - this.segmentStart);
  }

  due(): boolean {
    return this.elapsed() >= BREAK_AFTER_MS;
  }

  /** The reminder was shown: count the next 20 minutes from here. */
  reminded(): void {
    this.reset();
  }

  reset(): void {
    this.played = 0;
    this.segmentStart = this.segmentStart === null ? null : this.now();
  }

  private input(): void {
    this.expireIdle();
    this.lastInput = this.now();
  }

  private expireIdle(): void {
    const now = this.now();
    if (now - this.lastInput >= IDLE_RESET_MS) {
      this.played = 0;
      this.segmentStart = this.segmentStart === null ? null : now;
      this.lastInput = now;
    }
  }

  private navigated(url: string): void {
    this.expireIdle();
    const now = this.now();
    if (url === '/' || url.startsWith('/?')) {
      this.played = 0;
      this.segmentStart = null;
      return;
    }
    if (isPlayerUrl(url)) {
      this.segmentStart ??= now;
    } else if (this.segmentStart !== null) {
      this.played += now - this.segmentStart;
      this.segmentStart = null;
    }
  }
}
