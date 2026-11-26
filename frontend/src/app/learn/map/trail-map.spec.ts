import { Dialog } from '@angular/cdk/dialog';
import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AudioService } from '../../core/audio/audio.service';
import { AuthService } from '../../core/auth/auth.service';
import {
  KID,
  USER,
  byTestId,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import { BadgeShelf } from '../badges/badge-shelf';
import type { MapResponse, MapWorld } from '../learn.models';
import { SceneView } from './scene';
import { TRACK_STORAGE_KEY, TrailMap } from './trail-map';
import {
  ROW_HEIGHT,
  TRAIL_PADDING,
  currentLevelId,
  placeLevels,
  trailHeight,
  trailPath,
} from './trail-layout';

const meadow: MapWorld = {
  id: 'w1',
  title: 'Zahlenwiese',
  scene: 'meadow',
  grade: 'KG1',
  state: 'passed',
  stars: 5,
  maxStars: 6,
  levels: [
    { id: 'l1', title: 'Zählen bis 3', state: 'passed', stars: 3 },
    { id: 'l2', title: 'Zählen bis 5', state: 'skipped', stars: 2 },
  ],
};

const MAP: MapResponse = {
  tracks: [
    {
      id: 'math',
      title: 'Mathematik',
      icon: 'math',
      worlds: [
        meadow,
        {
          ...meadow,
          id: 'w2',
          title: 'Formenwald',
          scene: 'forest',
          state: 'unlocked',
          stars: 0,
          levels: [
            { id: 'l3', title: 'Kreise', state: 'unlocked', stars: 0 },
            { id: 'l4', title: 'Ecken', state: 'locked', stars: 0 },
          ],
        },
        { ...meadow, id: 'w3', title: 'Gipfel', scene: 'unknown', state: 'locked', levels: [] },
      ],
    },
    {
      id: 'reading-de',
      title: 'Lesen',
      icon: 'reading',
      worlds: [{ ...meadow, id: 'w9', scene: 'brook' }],
    },
  ],
};

describe('trail layout', () => {
  it('climbs from the bottom and winds left and right', () => {
    const placed = placeLevels(meadow.levels, 0);
    expect(placed[0]!.y).toBe(ROW_HEIGHT + TRAIL_PADDING);
    expect(placed[1]!.y).toBe(TRAIL_PADDING);
    expect(placed.map((item) => item.number)).toEqual([1, 2]);
    expect(placed[0]!.x).toBeGreaterThanOrEqual(24);
    expect(placed[0]!.x).toBeLessThanOrEqual(76);
    expect(trailHeight(0)).toBe(ROW_HEIGHT + 2 * TRAIL_PADDING);
    expect(trailPath([], 100)).toBe('');
    expect(trailPath(placed, trailHeight(2))).toMatch(/^M [\d.]+ 328 C/);
  });

  it('finds the level to play next', () => {
    expect(currentLevelId(MAP.tracks[0]!)).toBe('l3');
    expect(currentLevelId(null)).toBeNull();
  });
});

describe('TrailMap', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    auth.setUser(USER);
    auth.setActiveKid(KID);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    Element.prototype.scrollIntoView = vi.fn();
  });

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  async function open(map: MapResponse = MAP) {
    const result = await renderComponent(TrailMap);
    expect(byTestId(result.element, 'map-loading')).toBeTruthy();
    http.expectOne('/api/learn/map').flush(map);
    await settle(result.fixture);
    return result;
  }

  it('greets the kid and draws worlds, signposts, the summit and Murmeli', async () => {
    const { element } = await open();
    expect(byTestId(element, 'page-title').textContent).toContain('Hallo Mia!');
    expect(byTestId(element, 'track-math').getAttribute('aria-selected')).toBe('true');
    expect(byTestId(element, 'level-l1').getAttribute('aria-label')).toBe(
      'Stufe 1: Zählen bis 3, 3 von 3 Sternen',
    );
    expect(byTestId(element, 'level-l2').getAttribute('aria-label')).toContain('übersprungen');
    expect(byTestId(element, 'level-l4').getAttribute('aria-disabled')).toBe('true');
    expect(byTestId(element, 'summit-w1')).toBeTruthy();
    expect(element.querySelector('[data-testid="summit-w2"]')).toBeNull();
    expect(byTestId(element, 'world-stars-w1').textContent).toContain('5 von 6 Sternen');
    expect(byTestId(element, 'world-w3').textContent).toContain('Noch gesperrt');
    expect(element.querySelectorAll('[data-testid="map-mascot"]').length).toBe(1);
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('opens the badge shelf with the badges the map proves', async () => {
    const dialog = vi.spyOn(TestBed.inject(Dialog), 'open').mockReturnValue({} as never);
    const { element } = await open();
    const button = byTestId(element, 'badges');
    expect(button.getAttribute('aria-label')).toBe('Abzeichen: 2');
    expect(button.getAttribute('aria-haspopup')).toBe('dialog');
    expect(byTestId(element, 'badge-count').textContent?.trim()).toBe('2');
    button.click();
    expect(dialog).toHaveBeenCalledWith(
      BadgeShelf,
      expect.objectContaining({
        data: { earned: ['first-level', 'first-world'] },
        ariaLabelledBy: 'badge-shelf-title',
      }),
    );
  });

  it('opens unlocked levels and practice, never locked levels', async () => {
    const { element } = await open();
    const speak = vi
      .spyOn(TestBed.inject(AudioService), 'speak')
      .mockImplementation(() => undefined);
    byTestId(element, 'level-l4').click();
    expect(navigate).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Diese Stufe ist noch zu. Spiel zuerst die anderen.');
    byTestId(element, 'level-l4').click();
    byTestId(element, 'level-l3').click();
    expect(navigate).toHaveBeenCalledWith(['/learn/level', 'l3']);
    byTestId(element, 'practice').click();
    expect(navigateByUrl).toHaveBeenCalledWith('/learn/practice');
  });

  it('switches tracks by tap and arrow keys and remembers the choice', async () => {
    const { element, fixture } = await open();
    byTestId(element, 'track-reading-de').click();
    await fixture.whenStable();
    expect(byTestId(element, 'world-w9')).toBeTruthy();
    expect(localStorage.getItem(`${TRACK_STORAGE_KEY}:${KID.id}`)).toBe('reading-de');
    byTestId(element, 'track-reading-de').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }),
    );
    byTestId(element, 'track-reading-de').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }),
    );
    await fixture.whenStable();
    expect(byTestId(element, 'track-math').getAttribute('aria-selected')).toBe('true');
    byTestId(element, 'track-math').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    await fixture.whenStable();
    expect(byTestId(element, 'track-reading-de').getAttribute('aria-selected')).toBe('true');
  });

  it('shows an error with a retry, and an empty state', async () => {
    const { element, fixture } = await renderComponent(TrailMap);
    http.expectOne('/api/learn/map').flush(null, { status: 500, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'map-error')).toBeTruthy();
    byTestId(element, 'map-error').querySelector('button')!.click();
    http.expectOne('/api/learn/map').flush({ tracks: [] });
    await settle(fixture);
    expect(byTestId(element, 'map-empty')).toBeTruthy();
  });

  it('labels a single track trail and switches profile', async () => {
    const { element, fixture } = await open({ tracks: [MAP.tracks[1]!] });
    expect(element.querySelector('[role="tablist"]')).toBeNull();
    expect(byTestId(element, 'trail').getAttribute('aria-label')).toBe('Bergpfad Lesen');
    byTestId(element, 'switch-profile').click();
    http.expectOne('/api/kids/deactivate').flush(null);
    await settle(fixture);
    expect(navigateByUrl).toHaveBeenCalledWith('/');

    TestBed.inject(AuthService).setActiveKid(KID);
    await fixture.whenStable();
    byTestId(element, 'switch-profile').click();
    http.expectOne('/api/kids/deactivate').flush(null, { status: 500, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'form-error').textContent).not.toBe('');
  });

  it('falls back to the meadow for unknown scenes', async () => {
    const { element, fixture } = await renderComponent(SceneView, { scene: 'bridge' });
    expect(element.getAttribute('data-scene')).toBe('bridge');
    expect(element.querySelector('.bridge')).not.toBeNull();
    for (const scene of [
      'forest',
      'park',
      'bay',
      'hut',
      'house',
      'workshop',
      'mountain',
      'peak',
      'x',
    ]) {
      fixture.componentRef.setInput('scene', scene);
      await fixture.whenStable();
    }
    expect(element.getAttribute('data-scene')).toBe('meadow');
  });
});
