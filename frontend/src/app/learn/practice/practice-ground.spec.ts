import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { AudioService } from '../../core/audio/audio.service';
import { SoundEffects } from '../../core/audio/sound-effects';
import { AuthService } from '../../core/auth/auth.service';
import {
  KID,
  USER,
  byTestId,
  errorBody,
  provideAppTesting,
  renderComponent,
  settle,
} from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import type { PracticeCatalogResponse, PracticeTopicView } from '../learn.models';
import { PRACTICE_TRACK_STORAGE_KEY, PracticeGround } from './practice-ground';
import { TopicGlyph } from './topic-glyph';

function topic(overrides: Partial<PracticeTopicView> & Pick<PracticeTopicView, 'id'>) {
  return {
    title: overrides.id,
    state: 'open',
    level: 1,
    maxLevel: 3,
    levels: 5,
    dueReviews: 0,
    practiced: false,
    ...overrides,
  } satisfies PracticeTopicView;
}

const CATALOG: PracticeCatalogResponse = {
  mix: { available: true, dueReviews: 3 },
  tracks: [
    {
      id: 'math',
      title: 'Mathematik',
      icon: 'math',
      topics: [
        topic({ id: 'plus', title: 'Plus rechnen', level: 3, maxLevel: 4, dueReviews: 2 }),
        topic({ id: 'clock', title: 'Uhr lesen', level: 2, maxLevel: 10, levels: 10 }),
        topic({ id: 'compare', title: 'Vergleichen', state: 'ahead', level: 1, maxLevel: 2 }),
        topic({ id: 'times', title: 'Einmaleins', state: 'locked', level: 0, maxLevel: 0 }),
      ],
    },
    {
      id: 'reading-de',
      title: 'Lesen',
      icon: 'reading',
      topics: [topic({ id: 'syllables', title: 'Silben' })],
    },
    { id: 'empty', title: 'Leer', icon: 'math', topics: [] },
  ],
};

describe('PracticeGround', () => {
  let http: HttpTestingController;
  let navigate: ReturnType<typeof vi.spyOn>;
  let navigateByUrl: ReturnType<typeof vi.spyOn>;
  let speak: ReturnType<typeof vi.spyOn>;
  let effects: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideAppTesting() });
    http = TestBed.inject(HttpTestingController);
    const auth = TestBed.inject(AuthService);
    auth.setUser(USER);
    auth.setActiveKid(KID);
    navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    speak = vi.spyOn(TestBed.inject(AudioService), 'speak').mockImplementation(() => undefined);
    effects = vi.spyOn(TestBed.inject(SoundEffects), 'play').mockImplementation(() => undefined);
  });

  afterEach(() => {
    http.verify();
    resetDocumentState();
  });

  async function open(catalog: PracticeCatalogResponse = CATALOG) {
    const result = await renderComponent(PracticeGround);
    expect(byTestId(result.element, 'practice-loading').getAttribute('role')).toBe('status');
    http.expectOne({ method: 'GET', url: '/api/learn/practice' }).flush(catalog);
    await settle(result.fixture);
    return result;
  }

  it('asks what to practice and lists the topics of a track with their step', async () => {
    const { element } = await open();
    expect(byTestId(element, 'page-title').textContent?.trim()).toBe('Was möchtest du üben?');
    expect(document.activeElement).toBe(byTestId(element, 'page-title'));
    const plus = byTestId(element, 'topic-plus');
    expect(plus.textContent).toContain('Plus rechnen');
    expect(plus.hasAttribute('aria-describedby')).toBe(false);
    expect(byTestId(element, 'practice-mix').hasAttribute('aria-describedby')).toBe(false);
    expect(plus.querySelector('mu-topic-glyph')?.getAttribute('data-topic')).toBe('plus');
    expect(plus.querySelector('[data-testid="topic-level"]')?.textContent).toContain(
      'Stufe 3 von 4',
    );
    expect(plus.querySelectorAll('.steps__dot')).toHaveLength(4);
    expect(plus.querySelectorAll('.steps__dot--on')).toHaveLength(3);
    expect(byTestId(element, 'topic-reviews-plus').textContent).toContain('2 zum Wiederholen');
    expect(byTestId(element, 'topic-clock').querySelector('.meter__fill')).toBeTruthy();
    expect(
      byTestId(element, 'topic-compare').querySelector('[data-testid="topic-ahead"]'),
    ).toBeTruthy();
    const locked = byTestId(element, 'topic-times');
    expect(locked.getAttribute('aria-disabled')).toBe('true');
    expect(locked.textContent).toContain('Noch gesperrt');
    expect(byTestId(element, 'mix-reviews').textContent).toContain('3 zum Wiederholen');
    expect(element.querySelector('[data-testid="practice-track-empty"]')).toBeNull();
  });

  it('opens open and ahead topics, but only explains locked ones', async () => {
    const { element, fixture } = await open();
    const status = byTestId(element, 'practice-blocked');
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent?.trim()).toBe('');
    byTestId(element, 'topic-times').click();
    expect(navigate).not.toHaveBeenCalled();
    expect(effects).toHaveBeenCalledWith('locked');
    expect(speak).toHaveBeenCalledWith('Das kommt später auf deinem Bergpfad.');
    await fixture.whenStable();
    expect(status.textContent).toContain('Das kommt später auf deinem Bergpfad.');
    byTestId(element, 'topic-compare').click();
    expect(navigate).toHaveBeenCalledWith(['/learn/practice', 'compare']);
    byTestId(element, 'topic-plus').click();
    expect(navigate).toHaveBeenLastCalledWith(['/learn/practice', 'plus']);
  });

  it('lets Murmeli pick a mix, unless nothing is open yet', async () => {
    const { element, fixture } = await open();
    byTestId(element, 'practice-mix').click();
    expect(navigateByUrl).toHaveBeenCalledWith('/learn/practice/mix');

    const closed = await open({
      ...CATALOG,
      mix: { available: false, dueReviews: 0 },
    });
    const mix = byTestId(closed.element, 'practice-mix');
    expect(mix.getAttribute('aria-disabled')).toBe('true');
    expect(closed.element.querySelector('[data-testid="mix-reviews"]')).toBeNull();
    navigateByUrl.mockClear();
    mix.click();
    expect(navigateByUrl).not.toHaveBeenCalled();
    expect(speak).toHaveBeenCalledWith('Spiel zuerst eine Stufe auf dem Bergpfad.');
    await closed.fixture.whenStable();
    expect(byTestId(closed.element, 'practice-blocked').textContent).toContain(
      'Spiel zuerst eine Stufe auf dem Bergpfad.',
    );
    byTestId(closed.element, 'practice-back').click();
    expect(navigateByUrl).toHaveBeenCalledWith('/learn');
    fixture.destroy();
  });

  it('switches tracks by tap and arrow keys and remembers the choice', async () => {
    const { element, fixture } = await open();
    const panel = element.querySelector('#practice-panel')!;
    expect(panel.getAttribute('role')).toBe('tabpanel');
    expect(panel.getAttribute('aria-labelledby')).toBe('practice-tab-math');
    expect(byTestId(element, 'practice-track-math').getAttribute('aria-controls')).toBe(
      'practice-panel',
    );
    expect(byTestId(element, 'practice-topics').hasAttribute('aria-labelledby')).toBe(false);
    byTestId(element, 'topic-times').click();
    await fixture.whenStable();
    expect(byTestId(element, 'practice-blocked').textContent).toContain('Das kommt später');
    const reading = byTestId(element, 'practice-track-reading-de');
    reading.click();
    await fixture.whenStable();
    expect(byTestId(element, 'topic-syllables')).toBeTruthy();
    expect(byTestId(element, 'practice-topics').getAttribute('data-icon')).toBe('reading');
    expect(localStorage.getItem(`${PRACTICE_TRACK_STORAGE_KEY}:${KID.id}`)).toBe('reading-de');
    expect(byTestId(element, 'practice-blocked').textContent?.trim()).toBe('');

    reading.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    reading.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowRight', ctrlKey: true, bubbles: true }),
    );
    await fixture.whenStable();
    expect(byTestId(element, 'topic-syllables')).toBeTruthy();
    reading.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    await fixture.whenStable();
    expect(byTestId(element, 'topic-plus')).toBeTruthy();
    expect(document.activeElement).toBe(byTestId(element, 'practice-track-math'));
    byTestId(element, 'practice-track-math').dispatchEvent(
      new KeyboardEvent('keydown', { key: 'End', bubbles: true }),
    );
    await fixture.whenStable();
    expect(byTestId(element, 'topic-syllables')).toBeTruthy();
  });

  it('shows a single track without tabs, and an empty ground', async () => {
    const single = await open({ ...CATALOG, tracks: [CATALOG.tracks[0]!] });
    expect(single.element.querySelector('[data-testid="practice-tracks"]')).toBeNull();
    expect(byTestId(single.element, 'practice-topics').getAttribute('aria-labelledby')).toBe(
      'page-heading',
    );
    expect(single.element.querySelector('#practice-panel')?.hasAttribute('role')).toBe(false);
    single.fixture.destroy();

    const empty = await open({ mix: { available: false, dueReviews: 0 }, tracks: [] });
    expect(byTestId(empty.element, 'practice-empty')).toBeTruthy();
  });

  it('offers a retry when the ground cannot be loaded', async () => {
    const { element, fixture } = await renderComponent(PracticeGround);
    http
      .expectOne('/api/learn/practice')
      .flush(errorBody('INTERNAL', 500), { status: 500, statusText: 'x' });
    await settle(fixture);
    expect(byTestId(element, 'practice-error')).toBeTruthy();
    byTestId(element, 'practice-error').querySelector('button')!.click();
    http.expectOne('/api/learn/practice').flush(CATALOG);
    await settle(fixture);
    expect(byTestId(element, 'topic-plus')).toBeTruthy();
  });
});

describe('TopicGlyph', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: provideAppTesting() }));

  it('draws text or a small picture for every topic, and something for unknown ones', async () => {
    const { element, fixture } = await renderComponent(TopicGlyph, { topic: 'plus' });
    expect(element.getAttribute('aria-hidden')).toBe('true');
    expect(element.querySelector('.text--big')?.textContent).toBe('+');
    for (const id of [
      'ten-frame',
      'number-line',
      'bonds',
      'wall',
      'shapes',
      'patterns',
      'clock',
      'money',
      'read-words',
      'writing',
      'dictation',
      'sentences',
    ]) {
      fixture.componentRef.setInput('topic', id);
      await fixture.whenStable();
      expect(element.querySelector('svg')?.getAttribute('data-glyph')).toBe(id);
      expect(element.querySelector('svg')?.children.length).toBeGreaterThan(0);
    }
    fixture.componentRef.setInput('topic', 'syllables');
    await fixture.whenStable();
    expect(element.querySelector('.text')?.textContent).toBe('Ba-na');
    expect(element.querySelector('.text--big')).toBeNull();
    fixture.componentRef.setInput('topic', 'future-topic');
    await fixture.whenStable();
    expect(element.querySelector('svg')?.getAttribute('data-glyph')).toBe('sentences');
  });
});
