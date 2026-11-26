import { DIALOG_DATA, DialogRef } from '@angular/cdk/dialog';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { byTestId, provideAppTesting, renderComponent } from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import type { MapResponse, MapWorld } from '../learn.models';
import { BadgeIcon } from './badge-icon';
import { BadgeShelf } from './badge-shelf';
import {
  BADGE_IDS,
  badgeHintKey,
  badgeNameKey,
  badgesFromMap,
  isBadgeId,
  knownBadges,
} from './badges';
import { BADGE_STORAGE_KEY, KidBadges } from './kid-badges.service';

function world(id: string, stars: readonly (0 | 1 | 2 | 3)[], state: MapWorld['state']): MapWorld {
  return {
    id,
    title: id,
    scene: 'meadow',
    grade: 'KG1',
    state,
    stars: stars.reduce<number>((sum, value) => sum + value, 0),
    maxStars: stars.length * 3,
    levels: stars.map((value, index) => ({
      id: `${id}-${index}`,
      title: `${index}`,
      state: value >= 2 ? 'passed' : index === 0 ? 'unlocked' : 'locked',
      stars: value,
    })),
  };
}

function map(...worlds: MapWorld[]): MapResponse {
  return { tracks: [{ id: 'math', title: 'Mathe', icon: 'math', worlds }] };
}

describe('badges', () => {
  it('knows the four badges, their spoken names and hints', () => {
    expect(BADGE_IDS).toEqual(['first-level', 'first-world', 'star-collector', 'first-practice']);
    expect(isBadgeId('first-world')).toBe(true);
    expect(isBadgeId('streak')).toBe(false);
    expect(badgeNameKey('star-collector')).toBe('kid.badges.starCollector');
    expect(badgeHintKey('first-practice')).toBe('kid.badges.firstPracticeHint');
    expect(knownBadges(['first-practice', 'nope', 'first-level', 'first-level'])).toEqual([
      'first-level',
      'first-practice',
    ]);
  });

  it('every badge has a spoken name and hint without placeholders in both languages', () => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    const transloco = TestBed.inject(TranslocoService);
    for (const lang of ['de-CH', 'en-US']) {
      for (const id of BADGE_IDS) {
        for (const key of [badgeNameKey(id), badgeHintKey(id)]) {
          const text = transloco.translate(key, {}, lang);
          expect(text).not.toBe(key);
          expect(text).not.toContain('{{');
        }
      }
    }
  });

  it('reads what the map proves', () => {
    expect(badgesFromMap(map(world('a', [0, 0], 'unlocked')))).toEqual([]);
    expect(badgesFromMap(map(world('a', [2, 0], 'unlocked')))).toEqual(['first-level']);
    expect(
      badgesFromMap(map(world('a', [3, 3, 3], 'passed'), world('b', [3, 3], 'unlocked'))),
    ).toEqual(['first-level', 'first-world', 'star-collector']);
    expect(badgesFromMap(map({ ...world('empty', [], 'passed') }))).toEqual([]);
    expect(badgesFromMap({ ...map(), badges: ['first-practice', 'future-badge'] })).toEqual([
      'first-practice',
    ]);
  });
});

describe('KidBadges', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppTesting() }));
  afterEach(() => resetDocumentState());

  it('remembers new badges per kid on this device', () => {
    const badges = TestBed.inject(KidBadges);
    const empty = map(world('a', [0], 'unlocked'));
    expect(badges.earned('k1', empty)).toEqual([]);
    badges.remember('k1', ['first-practice', 'nope']);
    badges.remember('k1', []);
    badges.remember('k1', ['first-level']);
    expect(badges.earned('k1', empty)).toEqual(['first-level', 'first-practice']);
    expect(badges.earned('k2', empty)).toEqual([]);
    expect(JSON.parse(localStorage.getItem(`${BADGE_STORAGE_KEY}:k1`)!)).toEqual([
      'first-level',
      'first-practice',
    ]);
  });

  it('ignores broken storage', () => {
    const badges = TestBed.inject(KidBadges);
    localStorage.setItem(`${BADGE_STORAGE_KEY}:k1`, '{nope');
    expect(badges.earned('k1', map())).toEqual([]);
    localStorage.setItem(`${BADGE_STORAGE_KEY}:k1`, '{"a":1}');
    expect(badges.earned('k1', map())).toEqual([]);
    localStorage.setItem(`${BADGE_STORAGE_KEY}:k1`, '["first-world", 3]');
    expect(badges.earned('k1', map())).toEqual(['first-world']);
  });
});

describe('badge views', () => {
  const close = vi.fn();

  beforeEach(() => {
    close.mockReset();
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: DialogRef, useValue: { close } },
        { provide: DIALOG_DATA, useValue: { earned: ['first-level', 'first-practice'] } },
      ],
    });
  });

  afterEach(() => resetDocumentState());

  it('draws a medal that shines only once earned', async () => {
    const { element, fixture } = await renderComponent(BadgeIcon, { badge: 'star-collector' });
    expect(element.classList).not.toContain('mu-badge-icon--earned');
    expect(element.getAttribute('data-badge')).toBe('star-collector');
    expect(element.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.ribbon')).toBeNull();
    fixture.componentRef.setInput('earned', true);
    fixture.componentRef.setInput('badge', 'first-world');
    await fixture.whenStable();
    expect(element.classList).toContain('mu-badge-icon--earned');
    expect(element.querySelector('.flag')).not.toBeNull();
    expect(element.querySelectorAll('.ribbon')).toHaveLength(2);
  });

  it('shelves every badge with its state in words and a speak button', async () => {
    const { element } = await renderComponent(BadgeShelf);
    expect(byTestId(element, 'badge-shelf').querySelector('h2')?.id).toBe('badge-shelf-title');
    const earned = byTestId(element, 'shelf-badge-first-level');
    expect(earned.getAttribute('data-earned')).toBe('true');
    expect(earned.textContent).toContain('Erster Wegweiser');
    expect(earned.textContent).toContain('Hast du schon!');
    expect(earned.querySelector('.badge__hint')).toBeNull();
    const waiting = byTestId(element, 'shelf-badge-star-collector');
    expect(waiting.getAttribute('data-earned')).toBe('false');
    expect(waiting.textContent).toContain('Kommt noch');
    expect(waiting.textContent).toContain('Hol fünfmal alle drei Sterne.');
    expect(element.querySelectorAll('li mu-speak')).toHaveLength(4);
    byTestId(element, 'badge-shelf-close').click();
    expect(close).toHaveBeenCalled();
  });
});
