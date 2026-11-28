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
import type { MapResponse, MapTrack, MapWorld } from '../learn.models';
import { SCENES, SceneView } from './scene';
import { TRACK_STORAGE_KEY, TrailMap } from './trail-map';
import {
  COLUMN_WIDTH,
  JITTER_X,
  MIN_ROWS,
  JITTER_Y,
  POST_HEIGHT,
  ROW_HEIGHT,
  TOP_PADDING,
  columnsFor,
  currentLevelId,
  currentWorldIndex,
  layoutWorld,
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

const levels = (count: number) =>
  Array.from({ length: count }, (_, index) => ({
    id: `x${index}`,
    title: `Stufe ${index}`,
    state: 'locked' as const,
    stars: 0 as const,
  }));

describe('trail layout', () => {
  it('fits as many columns as the width allows over at least three rows', () => {
    expect(columnsFor(930, 11)).toBe(4);
    expect(columnsFor(930, 7)).toBe(3);
    expect(columnsFor(720, 6)).toBe(2);
    expect(columnsFor(330, 8)).toBe(2);
    expect(columnsFor(100, 8)).toBe(1);
    expect(columnsFor(930, 2)).toBe(1);
    expect(columnsFor(930, 0)).toBe(1);
    for (let count = 1; count <= 12; count += 1) {
      for (const width of [100, 330, 720, 930, 1400]) {
        const columns = columnsFor(width, count);
        expect(Math.ceil(count / columns)).toBeGreaterThanOrEqual(Math.min(count, MIN_ROWS));
        expect(columns * COLUMN_WIDTH <= Math.max(width, COLUMN_WIDTH)).toBe(true);
      }
    }
  });

  it('climbs in switchbacks from the bottom and points the way to the next level', () => {
    const placed = placeLevels(levels(6), 2, 'w1');
    const columns = placed.map((item) => (item.x < 50 ? 'L' : 'R')).join('');
    expect(['LRRLLR', 'RLLRRL']).toContain(columns);
    expect(placed.map((item) => item.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const mirrored = columns[0] === 'R';
    expect(placed.map((item) => item.pointsLeft)).toEqual([
      mirrored,
      !mirrored,
      !mirrored,
      mirrored,
      mirrored,
      mirrored,
    ]);
    expect(placed[0]!.y).toBeGreaterThan(placed[2]!.y);
    expect(placed[2]!.y).toBeGreaterThan(placed[4]!.y);
    expect(placed[1]!.openLeft).toBe(!mirrored);
  });

  it('gives every world its own trail without signposts running into each other', () => {
    const many = levels(12);
    expect(placeLevels(many, 4, 'w1')).toEqual(placeLevels(many, 4, 'w1'));
    expect(placeLevels(many, 4, 'w1')).not.toEqual(placeLevels(many, 4, 'w2'));
    for (const seed of ['a', 'b', 'math-zahlenwiese', 'reading-en-sound-garden']) {
      const placed = placeLevels(many, 4, seed);
      for (let column = 0; column < 4; column += 1) {
        const stack = placed
          .filter((item) => Math.floor(item.x / 25) === column)
          .sort((a, b) => a.y - b.y);
        expect(stack).toHaveLength(3);
        for (const item of stack) {
          expect(Math.abs(item.x - (column * 25 + 12.5))).toBeLessThanOrEqual(25 * JITTER_X + 0.1);
        }
        for (let row = 1; row < stack.length; row += 1) {
          expect(stack[row]!.y - stack[row - 1]!.y).toBeGreaterThanOrEqual(
            ROW_HEIGHT - 2 * JITTER_Y,
          );
        }
      }
    }
    expect(ROW_HEIGHT - 2 * JITTER_Y).toBeGreaterThan(POST_HEIGHT);
  });

  it('draws one trail from the bottom edge through every signpost up to the summit', () => {
    const placed = placeLevels(levels(5), 2, 'w1');
    const height = trailHeight(5, 2);
    expect(height).toBe(2 * ROW_HEIGHT + TOP_PADDING + 2 * JITTER_Y + POST_HEIGHT + 40);
    expect(trailPath([], height)).toBe('');
    const path = trailPath(placed, height);
    expect(path.startsWith(`M ${placed[0]!.x} ${height} C`)).toBe(true);
    expect(path.endsWith(` ${placed.at(-1)!.x} ${TOP_PADDING / 2}`)).toBe(true);
    expect(path.match(/C/g)).toHaveLength(10);
    const xs = [...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map((match) => Number(match[1]));
    const posts = placed.map((item) => item.x);
    expect(Math.max(...xs)).toBeGreaterThan(Math.max(...posts));
    expect(Math.min(...xs)).toBeLessThan(Math.min(...posts));
    expect(Math.max(...xs)).toBeLessThanOrEqual(100);
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
  });

  it('lays out a world for its width', () => {
    const layout = layoutWorld({ ...meadow, levels: levels(11) }, 930);
    expect(new Set(layout.levels.map((item) => Math.floor(item.x / 25))).size).toBe(4);
    expect(layout.height).toBe(trailHeight(11, 4));
    expect(layout.summitX).toBe(layout.levels.at(-1)!.x);
    expect(layoutWorld({ ...meadow, levels: [] }, 930)).toMatchObject({ path: '', summitX: 50 });
  });

  it('finds the level and the world to play next', () => {
    const math = MAP.tracks[0]!;
    expect(currentLevelId(math)).toBe('l3');
    expect(currentLevelId(null)).toBeNull();
    expect(currentWorldIndex(math)).toBe(1);
    expect(currentWorldIndex(null)).toBe(0);
    const done: MapTrack = { ...math, worlds: [meadow, meadow, { ...meadow, state: 'locked' }] };
    expect(currentWorldIndex(done)).toBe(1);
    const fresh: MapTrack = {
      ...math,
      worlds: [meadow, { ...meadow, state: 'unlocked', levels: [] }],
    };
    expect(currentWorldIndex(fresh)).toBe(1);
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
    vi.unstubAllGlobals();
  });

  async function open(map: MapResponse = MAP) {
    const result = await renderComponent(TrailMap);
    expect(byTestId(result.element, 'map-loading')).toBeTruthy();
    http.expectOne('/api/learn/map').flush(map);
    await settle(result.fixture);
    return result;
  }

  function pointer(type: string, x: number, y = 0, pointerType = 'touch'): Event {
    const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
    return Object.assign(event, { pointerId: 1, isPrimary: true, pointerType });
  }

  it('opens on the world with the next level, with Murmeli at that level', async () => {
    const { element } = await open();
    expect(byTestId(element, 'page-title').textContent).toContain('Hallo Mia!');
    expect(byTestId(element, 'track-math').getAttribute('aria-selected')).toBe('true');
    expect(byTestId(element, 'world-w2')).toBeTruthy();
    expect(element.querySelector('[data-testid="world-w1"]')).toBeNull();
    expect(byTestId(element, 'level-l3').getAttribute('aria-label')).toBe(
      'Stufe 1: Kreise, bereit zum Spielen',
    );
    expect(byTestId(element, 'level-l4').getAttribute('aria-disabled')).toBe('true');
    expect(byTestId(element, 'world-stars-w2').textContent).toContain('0 von 6 Sternen');
    expect(element.querySelectorAll('[data-testid="map-mascot"]').length).toBe(1);
    expect(element.querySelector('[data-testid="summit-w2"]')).toBeNull();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('lists every world in the strip with its state', async () => {
    const { element } = await open();
    const tabs = byTestId(element, 'world-strip').querySelectorAll('[role="tab"]');
    expect(tabs.length).toBe(3);
    expect(byTestId(element, 'world-tab-w1').getAttribute('aria-label')).toBe(
      'Zahlenwiese, geschafft',
    );
    expect(byTestId(element, 'world-tab-w2').getAttribute('aria-label')).toBe(
      'Formenwald, offen, Hier bist du',
    );
    expect(byTestId(element, 'world-tab-w2').getAttribute('aria-selected')).toBe('true');
    expect(byTestId(element, 'world-tab-w2').getAttribute('tabindex')).toBe('0');
    expect(byTestId(element, 'world-tab-w3').getAttribute('aria-label')).toBe(
      'Gipfel, noch gesperrt',
    );
    expect(byTestId(element, 'world-done-w1')).toBeTruthy();
    expect(element.querySelector('[data-testid="world-done-w2"]')).toBeNull();
    expect(byTestId(element, 'world-w2').getAttribute('aria-labelledby')).toBe('world-tab-w2');
  });

  it('moves between worlds with the strip and the arrows, and keeps the world in the URL', async () => {
    const { element, fixture } = await open();
    expect(byTestId(element, 'world-status').textContent?.trim()).toBe('');
    byTestId(element, 'world-tab-w1').click();
    await fixture.whenStable();
    expect(byTestId(element, 'world-status').textContent?.trim()).toBe('Zahlenwiese, geschafft');
    expect(byTestId(element, 'level-l1').getAttribute('aria-label')).toBe(
      'Stufe 1: Zählen bis 3, 3 von 3 Sternen',
    );
    expect(byTestId(element, 'level-l2').getAttribute('aria-label')).toContain('übersprungen');
    expect(byTestId(element, 'summit-w1')).toBeTruthy();
    expect(byTestId(element, 'world-stars-w1').textContent).toContain('5 von 6 Sternen');
    expect(element.querySelector('[data-testid="map-mascot"]')).toBeNull();
    expect(element.querySelector('.slide')!.getAttribute('data-from')).toBe('previous');
    expect(byTestId(element, 'world-previous').getAttribute('aria-disabled')).toBe('true');
    expect(byTestId(element, 'world-next').getAttribute('aria-disabled')).toBeNull();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { world: 'w1' }, replaceUrl: true }),
    );

    byTestId(element, 'world-tab-w1').click();
    byTestId(element, 'world-previous').click();
    byTestId(element, 'track-math').click();
    await fixture.whenStable();
    expect(byTestId(element, 'world-w1')).toBeTruthy();
    expect(navigate).toHaveBeenCalledTimes(1);

    byTestId(element, 'world-next').click();
    await fixture.whenStable();
    byTestId(element, 'world-next').click();
    await fixture.whenStable();
    expect(byTestId(element, 'world-w3').textContent).toContain('Noch gesperrt');
    expect(element.querySelector('.slide')!.getAttribute('data-from')).toBe('next');
    expect(byTestId(element, 'world-next').getAttribute('aria-disabled')).toBe('true');
    byTestId(element, 'world-next').click();
    expect(byTestId(element, 'world-w3')).toBeTruthy();
  });

  it('moves between worlds with the arrow keys in the strip', async () => {
    const { element, fixture } = await open();
    const key = (id: string, name: string) =>
      byTestId(element, id).dispatchEvent(
        new KeyboardEvent('keydown', { key: name, bubbles: true }),
      );

    key('world-tab-w2', 'ArrowLeft');
    await fixture.whenStable();
    expect(byTestId(element, 'world-tab-w1').getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(byTestId(element, 'world-tab-w1'));
    key('world-tab-w1', 'ArrowLeft');
    key('world-tab-w1', 'Enter');
    byTestId(element, 'world-tab-w1').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }),
    );
    byTestId(element, 'track-math').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', altKey: true, bubbles: true }),
    );
    await fixture.whenStable();
    expect(byTestId(element, 'world-tab-w1').getAttribute('aria-selected')).toBe('true');
    key('world-tab-w1', 'End');
    await fixture.whenStable();
    expect(byTestId(element, 'world-tab-w3').getAttribute('aria-selected')).toBe('true');
    key('world-tab-w3', 'Home');
    await fixture.whenStable();
    expect(byTestId(element, 'world-w1')).toBeTruthy();
  });

  it('swipes between worlds without opening the signpost under the finger', async () => {
    const { element, fixture } = await open();
    const stage = byTestId(element, 'world-stage');
    stage.dispatchEvent(pointer('pointerdown', 100));
    stage.dispatchEvent(pointer('pointerup', 300));
    await fixture.whenStable();
    expect(byTestId(element, 'world-w1')).toBeTruthy();
    byTestId(element, 'level-l1').click();
    expect(navigate).not.toHaveBeenCalledWith(['/learn/level', 'l1']);

    stage.dispatchEvent(pointer('pointerdown', 300));
    stage.dispatchEvent(pointer('pointerup', 200, 200));
    stage.dispatchEvent(pointer('pointerdown', 300));
    stage.dispatchEvent(pointer('pointercancel', 0));
    stage.dispatchEvent(pointer('pointerup', 0));
    stage.dispatchEvent(pointer('pointerup', 0));
    stage.dispatchEvent(pointer('pointerdown', 300));
    stage.dispatchEvent(pointer('pointerup', 230));
    stage.dispatchEvent(pointer('pointerdown', 300, 0, 'mouse'));
    stage.dispatchEvent(pointer('pointerup', 0, 0, 'mouse'));
    await fixture.whenStable();
    expect(byTestId(element, 'world-w1')).toBeTruthy();

    stage.dispatchEvent(pointer('pointerdown', 300));
    stage.dispatchEvent(pointer('pointerup', 100));
    await fixture.whenStable();
    expect(byTestId(element, 'world-w2')).toBeTruthy();
  });

  it('opens the world from the URL, on its own track', async () => {
    navigateByUrl.mockRestore();
    await TestBed.inject(Router).navigateByUrl('/?world=w9');
    const { element } = await open();
    expect(byTestId(element, 'track-reading-de').getAttribute('aria-selected')).toBe('true');
    expect(byTestId(element, 'world-w9')).toBeTruthy();

    byTestId(element, 'track-math').click();
    expect(navigate).toHaveBeenCalledWith(
      [],
      expect.objectContaining({ queryParams: { world: null } }),
    );
  });

  it('lays the trail out for the measured width', async () => {
    let resize: ResizeObserverCallback = () => undefined;
    vi.stubGlobal(
      'ResizeObserver',
      class {
        readonly observe = vi.fn();
        readonly disconnect = vi.fn();
        constructor(callback: ResizeObserverCallback) {
          resize = callback;
        }
      },
    );
    const world: MapWorld = { ...meadow, levels: levels(6) };
    const { element, fixture } = await open({ tracks: [{ ...MAP.tracks[0]!, worlds: [world] }] });
    const post = () => byTestId(element, 'level-x5').closest('mu-signpost') as HTMLElement;
    const left = (width: number) => `${layoutWorld(world, width).levels[5]!.x}%`;
    expect(left(720)).not.toBe(left(100));
    expect(post().style.left).toBe(left(720));
    resize([{ contentRect: { width: 100 } } as ResizeObserverEntry], {} as ResizeObserver);
    await fixture.whenStable();
    expect(post().style.left).toBe(left(100));
    resize([{ contentRect: { width: 0 } } as ResizeObserverEntry], {} as ResizeObserver);
    await fixture.whenStable();
    expect(post().style.left).toBe(left(100));
    fixture.destroy();
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
    expect(navigate).not.toHaveBeenCalled();
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

  it('shows the empty state for a track without worlds', async () => {
    const { element } = await open({ tracks: [{ ...MAP.tracks[0]!, worlds: [] }] });
    expect(byTestId(element, 'trail').querySelector('[data-testid="map-empty"]')).toBeTruthy();
  });

  it('labels a single track trail and switches profile', async () => {
    const { element, fixture } = await open({ tracks: [MAP.tracks[1]!] });
    expect(element.querySelector('.tracks')).toBeNull();
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
});

describe('SceneView', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppTesting() }));

  it('draws a landmark for every scene and falls back to the meadow', async () => {
    const { element, fixture } = await renderComponent(SceneView, { scene: 'tower' });
    expect(element.getAttribute('data-scene')).toBe('tower');
    expect(element.querySelector('.clock')).not.toBeNull();
    const landmarks: Partial<Record<string, string>> = {
      alp: '.cow',
      market: '.awning',
      bridge: '.bridge',
      brook: '.stream',
      bay: '.hull',
      peak: '.cross',
      forest: '.fir',
      park: '.leaf',
      garden: '.wood',
      hut: '.smoke',
      workshop: '.gear',
      orchard: '.branches',
    };
    for (const scene of SCENES) {
      fixture.componentRef.setInput('scene', scene);
      await fixture.whenStable();
      expect(element.getAttribute('data-scene')).toBe(scene);
      const landmark = landmarks[scene];
      if (landmark) {
        expect(element.querySelector(landmark)).not.toBeNull();
      }
    }
    fixture.componentRef.setInput('scene', 'x');
    await fixture.whenStable();
    expect(element.getAttribute('data-scene')).toBe('meadow');
  });
});
