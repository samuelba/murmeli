import { HttpTestingController } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationStart, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { KID, provideAppTesting } from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from '../i18n/language.service';
import { indexManifest, manifestVersion } from './audio-manifest';
import {
  AUDIO_ELEMENT_FACTORY,
  AUDIO_MANIFEST_URL,
  AudioService,
  SEGMENT_GAP_MS,
  autoReadsAloud,
} from './audio.service';

class FakeAudio extends EventTarget {
  src = '';
  readonly played: string[] = [];
  readonly play = vi.fn(() => {
    this.played.push(this.src);
    return Promise.resolve();
  });
  readonly pause = vi.fn();

  end(): void {
    this.dispatchEvent(new Event('ended'));
  }
}

const MANIFEST = {
  version: 'v1',
  locales: {
    'de-CH': {
      a: { text: 'Wie viel ist', file: 'de-CH/a.opus', durationMs: 700, status: 'ok' },
      b: { text: '7', file: 'de-CH/b.opus', durationMs: 400, status: 'ok' },
      c: { text: 'plus', file: 'de-CH/c.opus', durationMs: null, status: 'ok' },
      evil: { text: 'evil', file: '../../etc/passwd', durationMs: 1, status: 'ok' },
      flagged: { text: 'wrong', file: 'de-CH/f.opus', durationMs: 1, status: 'flagged' },
    },
    'en-US': { d: { text: 'Hello', file: 'en-US/d.opus', durationMs: 500, status: 'ok' } },
  },
};

const flushMicrotasks = () => new Promise<void>((resolve) => queueMicrotask(resolve));

describe('audio manifest', () => {
  it('indexes clips by locale and text and drops unsafe files', () => {
    const index = indexManifest(MANIFEST);
    expect(index.get('de-CH')?.get('Wie viel ist')).toEqual({
      file: 'de-CH/a.opus',
      durationMs: 700,
    });
    expect(index.get('de-CH')?.get('plus')?.durationMs).toBeNull();
    expect(index.get('de-CH')?.has('evil')).toBe(false);
    expect(index.get('de-CH')?.has('wrong')).toBe(false);
    expect(index.get('en-US')?.size).toBe(1);
  });

  it('reads a safe manifest version', () => {
    expect(manifestVersion(MANIFEST)).toBe('v1');
    expect(manifestVersion({ version: '../x?y' })).toBeNull();
    expect(manifestVersion(null)).toBeNull();
  });

  it('ignores anything that is not a manifest', () => {
    expect(indexManifest(null).size).toBe(0);
    expect(indexManifest({ locales: [] }).size).toBe(0);
    expect(indexManifest({ locales: { 'de-CH': 'x', 'en-US': { a: 'x' } } }).size).toBe(0);
  });
});

describe('autoReadsAloud', () => {
  it('reads aloud for kindergarten kids in auto mode and follows on/off', () => {
    expect(autoReadsAloud(null)).toBe(false);
    expect(autoReadsAloud({ readAloud: 'auto', startClass: 'KG1' })).toBe(true);
    expect(autoReadsAloud({ readAloud: 'auto', startClass: 'KG2' })).toBe(true);
    expect(autoReadsAloud({ readAloud: 'auto', startClass: '1' })).toBe(false);
    expect(autoReadsAloud({ readAloud: 'on', startClass: '2' })).toBe(true);
    expect(autoReadsAloud({ readAloud: 'off', startClass: 'KG1' })).toBe(false);
  });
});

describe('AudioService', () => {
  let http: HttpTestingController;
  let audio: FakeAudio;
  let service: AudioService;
  let events: Subject<unknown>;

  beforeEach(() => {
    audio = new FakeAudio();
    events = new Subject();
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: AUDIO_ELEMENT_FACTORY, useValue: () => audio },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'events', 'get').mockReturnValue(events as never);
    http = TestBed.inject(HttpTestingController);
    service = TestBed.inject(AudioService);
  });

  afterEach(() => {
    vi.useRealTimers();
    http.verify();
    resetDocumentState();
  });

  async function loaded(manifest: object = MANIFEST): Promise<void> {
    service.prepare();
    http.expectOne(AUDIO_MANIFEST_URL).flush(manifest);
    await service.load();
  }

  it('loads the manifest once and becomes available for the current language', async () => {
    expect(service.available()).toBe(false);
    await loaded();
    service.prepare();
    http.expectNone(AUDIO_MANIFEST_URL);
    expect(service.available()).toBe(true);
    expect(service.canSpeak(['nope', '7'])).toBe(true);
    expect(service.canSpeak('Hello')).toBe(false);

    TestBed.inject(LanguageService).useLanguage('en-US');
    expect(service.canSpeak('Hello')).toBe(true);
  });

  it('stays unavailable without a manifest and asks again a minute later', async () => {
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const now = vi.spyOn(Date, 'now').mockReturnValue(1_000_000);
    service.prepare();
    http.expectOne(AUDIO_MANIFEST_URL).flush(null, { status: 404, statusText: 'Not Found' });
    await service.load();
    service.prepare();
    http.expectNone(AUDIO_MANIFEST_URL);
    now.mockReturnValue(1_000_000 + 61_000);
    service.prepare();
    http.expectOne(AUDIO_MANIFEST_URL).flush(null, { status: 404, statusText: 'Not Found' });
    await service.load();
    expect(service.available()).toBe(false);
    expect(service.canSpeak('7')).toBe(false);
    await service.play('7');
    expect(audio.play).not.toHaveBeenCalled();
    expect(debug).toHaveBeenCalled();
  });

  it('prefetches the clips of a run once each, and stops when a newer prefetch starts', async () => {
    const fetch = vi
      .spyOn(window, 'fetch')
      .mockResolvedValueOnce(new Response('a'))
      .mockResolvedValueOnce(new Response(null, { status: 404 }))
      .mockResolvedValue(new Response('x'));
    const pending = service.prefetch(['Wie viel ist', '7', 'Wie viel ist', 'nope', 'evil', 'plus']);
    http.expectOne(AUDIO_MANIFEST_URL).flush(MANIFEST);
    expect(await pending).toBe(2);
    expect(fetch.mock.calls.map(([url]) => url)).toEqual([
      '/audio/de-CH/a.opus?v=v1',
      '/audio/de-CH/b.opus?v=v1',
      '/audio/de-CH/c.opus?v=v1',
    ]);

    fetch.mockClear();
    const first = service.prefetch(['7', 'plus']);
    const second = service.prefetch(['Wie viel ist']);
    expect(await first).toBe(0);
    expect(await second).toBe(1);
    expect(fetch).toHaveBeenCalledTimes(1);

    fetch.mockRejectedValue(new TypeError('offline'));
    expect(await service.prefetch(['7', 'plus'])).toBe(0);
    expect(fetch).toHaveBeenCalledTimes(2);
  });

  it('prefetches nothing without a manifest', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    const fetch = vi.spyOn(window, 'fetch');
    const pending = service.prefetch(['7']);
    http.expectOne(AUDIO_MANIFEST_URL).flush(null, { status: 404, statusText: 'Not Found' });
    expect(await pending).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('plays segments in order with a short gap and skips missing clips', async () => {
    vi.spyOn(console, 'debug').mockImplementation(() => undefined);
    await loaded();
    vi.useFakeTimers();
    const done = service.play(['Wie viel ist', 'gibt es nicht', '7']);
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.played).toEqual(['/audio/de-CH/a.opus?v=v1']);
    expect(service.speaking()).toBe(true);

    audio.end();
    await vi.advanceTimersByTimeAsync(SEGMENT_GAP_MS - 1);
    expect(audio.played).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(audio.played).toEqual(['/audio/de-CH/a.opus?v=v1', '/audio/de-CH/b.opus?v=v1']);

    audio.end();
    await done;
    expect(service.speaking()).toBe(false);
  });

  it('moves on when a clip fails, stalls or is blocked', async () => {
    await loaded();
    vi.useFakeTimers();
    audio.play.mockImplementationOnce(() => Promise.reject(new Error('NotAllowedError')));
    const done = service.play(['Wie viel ist', '7', 'plus']);
    await vi.advanceTimersByTimeAsync(SEGMENT_GAP_MS);
    expect(audio.play).toHaveBeenCalledTimes(2);
    audio.dispatchEvent(new Event('error'));
    await vi.advanceTimersByTimeAsync(SEGMENT_GAP_MS);
    expect(audio.play).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(6000 + 2500);
    await done;
    expect(service.speaking()).toBe(false);
  });

  it('cancels the current speech for a new one, on stop and on navigation', async () => {
    await loaded();
    vi.useFakeTimers();
    const first = service.play(['Wie viel ist', '7']);
    await vi.advanceTimersByTimeAsync(0);
    service.speak('plus');
    await first;
    await vi.advanceTimersByTimeAsync(0);
    expect(audio.played).toEqual(['/audio/de-CH/a.opus?v=v1', '/audio/de-CH/c.opus?v=v1']);
    expect(audio.pause).toHaveBeenCalled();

    events.next(new NavigationStart(1, '/learn'));
    expect(service.speaking()).toBe(false);

    const gap = service.play(['7', 'plus']);
    await vi.advanceTimersByTimeAsync(0);
    audio.end();
    service.stop();
    await gap;
    await vi.advanceTimersByTimeAsync(SEGMENT_GAP_MS);
    expect(audio.played.at(-1)).toBe('/audio/de-CH/b.opus?v=v1');
  });

  it('unlocks the audio element with a silent clip on the first tap', () => {
    const create = vi.fn(() => 'blob:silent');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: create });
    document.dispatchEvent(new Event('pointerdown'));
    document.dispatchEvent(new Event('pointerdown'));
    service.unlock();
    expect(create).toHaveBeenCalledTimes(1);
    expect(audio.played).toEqual(['blob:silent']);
    Reflect.deleteProperty(URL, 'createObjectURL');
  });

  it('narrates only when the kid setting reads aloud', async () => {
    await loaded();
    const auth = TestBed.inject(AuthService);
    auth.setActiveKid({ ...KID, readAloud: 'off' });
    await service.narrate('7');
    expect(audio.play).not.toHaveBeenCalled();

    auth.setActiveKid({ ...KID, readAloud: 'on', startClass: '2' });
    const done = service.narrate('7');
    await flushMicrotasks();
    await flushMicrotasks();
    expect(audio.play).toHaveBeenCalledTimes(1);
    audio.end();
    await done;
  });
});
