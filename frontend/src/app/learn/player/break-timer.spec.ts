import { TestBed } from '@angular/core/testing';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { provideAppTesting } from '../../../testing/app-testing';
import { BREAK_AFTER_MS, BREAK_CLOCK, BreakTimer, IDLE_RESET_MS, isPlayerUrl } from './break-timer';

const MINUTE = 60_000;

describe('BreakTimer', () => {
  let now: number;
  let events: Subject<unknown>;
  let timer: BreakTimer;

  function go(url: string) {
    events.next(new NavigationEnd(1, url, url));
  }

  /** Plays for `minutes`, tapping once a minute. */
  function play(minutes: number) {
    for (let i = 0; i < minutes; i += 1) {
      now += MINUTE;
      document.dispatchEvent(new Event('pointerdown'));
    }
  }

  beforeEach(() => {
    now = 1_000_000;
    events = new Subject();
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: BREAK_CLOCK, useValue: () => now }],
    });
    const router = TestBed.inject(Router);
    Object.defineProperty(router, 'events', { value: events });
    timer = TestBed.inject(BreakTimer);
  });

  it('recognizes player pages', () => {
    expect(isPlayerUrl('/learn/level/math-01')).toBe(true);
    expect(isPlayerUrl('/learn/practice')).toBe(true);
    expect(isPlayerUrl('/learn/level/x?y=1')).toBe(true);
    expect(isPlayerUrl('/learn')).toBe(false);
    expect(isPlayerUrl('/learn/levels')).toBe(false);
  });

  it('counts only time on player pages, across levels', () => {
    go('/learn/level/a');
    play(12);
    go('/learn');
    play(3);
    expect(timer.elapsed()).toBe(12 * MINUTE);
    go('/learn/practice');
    play(7);
    expect(timer.due()).toBe(false);
    play(1);
    expect(timer.elapsed()).toBe(BREAK_AFTER_MS);
    expect(timer.due()).toBe(true);
  });

  it('waits another 20 minutes after a reminder', () => {
    go('/learn/level/a');
    play(20);
    expect(timer.due()).toBe(true);
    timer.reminded();
    expect(timer.due()).toBe(false);
    play(19);
    expect(timer.due()).toBe(false);
    play(1);
    expect(timer.due()).toBe(true);
  });

  it('starts over after 5 idle minutes or at the profile picker', () => {
    go('/learn/level/a');
    play(15);
    now += IDLE_RESET_MS;
    expect(timer.elapsed()).toBe(0);
    play(10);
    expect(timer.elapsed()).toBe(10 * MINUTE);
    go('/');
    expect(timer.elapsed()).toBe(0);
    go('/learn/level/b');
    play(2);
    timer.reset();
    expect(timer.elapsed()).toBe(0);
    go('/learn');
    timer.reset();
    expect(timer.elapsed()).toBe(0);
  });
});
