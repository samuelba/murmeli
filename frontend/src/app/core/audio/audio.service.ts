import { HttpClient } from '@angular/common/http';
import {
  DOCUMENT,
  DestroyRef,
  Injectable,
  InjectionToken,
  computed,
  inject,
  isDevMode,
  signal,
} from '@angular/core';
import { NavigationStart, Router } from '@angular/router';
import { filter, firstValueFrom } from 'rxjs';
import { Kid } from '../api/models';
import { AuthService } from '../auth/auth.service';
import { LanguageService } from '../i18n/language.service';
import { SpeakProvider, SpeechInput } from '../../shared/speak/speak-provider';
import {
  Clip,
  ClipIndex,
  EMPTY_INDEX,
  indexManifest,
  manifestVersion,
  normalizeText,
} from './audio-manifest';

export const AUDIO_BASE_URL = '/audio';
export const AUDIO_MANIFEST_URL = `${AUDIO_BASE_URL}/manifest.json`;
export const SEGMENT_GAP_MS = 120;
/** Extra time before a clip that never reports `ended` is given up on. */
const STALL_MARGIN_MS = 2500;
const UNKNOWN_DURATION_MS = 6000;

/** Creates the one reusable audio element (replaced by a fake in tests). */
export const AUDIO_ELEMENT_FACTORY = new InjectionToken<() => HTMLAudioElement>(
  'AUDIO_ELEMENT_FACTORY',
  { providedIn: 'root', factory: () => () => new Audio() },
);

type LoadState = 'idle' | 'loading' | 'ready' | 'failed';

const MANIFEST_RETRY_MS = 60_000;
/** A run needs a few dozen clips; more than this is not worth the bandwidth up front. */
export const PREFETCH_LIMIT = 80;

/** 10 ms of silence as a WAV file (blob: URLs are allowed by the CSP media-src). */
function silentWav(): Blob {
  const samples = 80;
  const view = new DataView(new ArrayBuffer(44 + samples));
  const text = (offset: number, value: string) =>
    [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
  text(0, 'RIFF');
  view.setUint32(4, 36 + samples, true);
  text(8, 'WAVEfmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  text(36, 'data');
  view.setUint32(40, samples, true);
  for (let i = 0; i < samples; i += 1) {
    view.setUint8(44 + i, 128);
  }
  return new Blob([view], { type: 'audio/wav' });
}

/** KG kids are pre-readers: with `readAloud: 'auto'` their prompts play by themselves. */
export function autoReadsAloud(kid: Pick<Kid, 'readAloud' | 'startClass'> | null): boolean {
  if (!kid) {
    return false;
  }
  if (kid.readAloud === 'auto') {
    return kid.startClass === 'KG1' || kid.startClass === 'KG2';
  }
  return kid.readAloud === 'on';
}

function segmentsOf(input: SpeechInput): readonly string[] {
  return typeof input === 'string' ? [input] : input;
}

/**
 * Narration from pre-rendered clips (docs/internal/learning-engine.md §5). Segments play back
 * to back with a short gap; a new `speak`, `stop` or a navigation cancels what is playing.
 * Segments without a clip are skipped silently. There is no speech-synthesis fallback.
 */
@Injectable({ providedIn: 'root' })
export class AudioService implements SpeakProvider {
  private readonly http = inject(HttpClient);
  private readonly language = inject(LanguageService).language;
  private readonly activeKid = inject(AuthService).activeKid;
  private readonly createElement = inject(AUDIO_ELEMENT_FACTORY);
  private readonly window = inject(DOCUMENT).defaultView;

  private readonly index = signal<ClipIndex>(EMPTY_INDEX);
  private readonly speakingState = signal(false);
  private loadState: LoadState = 'idle';
  private loading: Promise<void> | null = null;
  private element: HTMLAudioElement | null = null;
  private version: string | null = null;
  private failedAt = 0;
  private unlocked = false;
  private generation = 0;
  private prefetchGeneration = 0;
  private interrupt: (() => void) | null = null;

  readonly speaking = this.speakingState.asReadonly();
  readonly available = computed(() => (this.index().get(this.language())?.size ?? 0) > 0);
  /** Whether prompts play without a tap, from the kid's `readAloud` setting. */
  readonly autoRead = computed(() => autoReadsAloud(this.activeKid()));

  constructor() {
    inject(Router)
      .events.pipe(filter((event) => event instanceof NavigationStart))
      .subscribe(() => this.stop());
    const document = inject(DOCUMENT);
    const unlock = () => this.unlock();
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    document.addEventListener('keydown', unlock, { once: true, capture: true });
    inject(DestroyRef).onDestroy(() => {
      this.stop();
      document.removeEventListener('pointerdown', unlock, { capture: true });
      document.removeEventListener('keydown', unlock, { capture: true });
    });
  }

  prepare(): void {
    void this.load();
  }

  load(): Promise<void> {
    const retry = this.loadState === 'failed' && Date.now() - this.failedAt > MANIFEST_RETRY_MS;
    if (this.loadState === 'idle' || retry) {
      this.loadState = 'loading';
      this.loading = firstValueFrom(this.http.get<unknown>(AUDIO_MANIFEST_URL))
        .then((manifest) => {
          this.version = manifestVersion(manifest);
          this.index.set(indexManifest(manifest));
          this.loadState = 'ready';
        })
        .catch(() => {
          this.debug('no audio manifest, narration is off');
          this.failedAt = Date.now();
          this.loadState = 'failed';
        });
    }
    return this.loading ?? Promise.resolve();
  }

  /**
   * Called from the first tap: browsers (Safari above all) only allow audio that started
   * during a user gesture, so a silent clip blesses the shared element for later prompts.
   */
  unlock(): void {
    if (this.unlocked) {
      return;
    }
    this.unlocked = true;
    const element = this.audio();
    if (!element.src && typeof URL.createObjectURL === 'function') {
      element.src = URL.createObjectURL(silentWav());
      element.play()?.catch(() => undefined);
    }
  }

  canSpeak(input: SpeechInput): boolean {
    const clips = this.index().get(this.language());
    return !!clips && segmentsOf(input).some((segment) => clips.has(normalizeText(segment)));
  }

  speak(input: SpeechInput): void {
    void this.play(input);
  }

  /** Speaks on its own only when the kid's read-aloud setting asks for it. */
  narrate(input: SpeechInput): Promise<void> {
    return this.autoRead() ? this.play(input) : Promise.resolve();
  }

  /** Plays the segments in order; resolves when done or cancelled. */
  async play(input: SpeechInput): Promise<void> {
    const generation = this.cancel();
    const segments = segmentsOf(input);
    await this.load();
    if (generation !== this.generation) {
      return;
    }
    const clips = this.index().get(this.language());
    const queue = segments
      .map((segment) => ({ segment, clip: clips?.get(normalizeText(segment)) }))
      .filter((item): item is { segment: string; clip: Clip } => {
        if (!item.clip) {
          this.debug(`no clip for "${item.segment}"`);
        }
        return !!item.clip;
      });
    if (queue.length === 0) {
      return;
    }
    this.speakingState.set(true);
    for (const [position, { clip }] of queue.entries()) {
      if (position > 0) {
        await this.pause(SEGMENT_GAP_MS);
      }
      if (generation !== this.generation) {
        return;
      }
      await this.playClip(clip);
      if (generation !== this.generation) {
        return;
      }
    }
    this.speakingState.set(false);
  }

  stop(): void {
    this.cancel();
  }

  /**
   * Downloads the clips for these texts one by one in the background, so the service worker
   * (or the HTTP cache) has them when the kid gets there. A newer prefetch replaces this one.
   */
  async prefetch(texts: readonly string[]): Promise<number> {
    const generation = ++this.prefetchGeneration;
    const fetcher = this.window?.fetch?.bind(this.window);
    await this.load();
    const clips = this.index().get(this.language());
    if (!fetcher || !clips) {
      return 0;
    }
    const urls = [
      ...new Set(
        texts
          .map((text) => clips.get(normalizeText(text)))
          .filter((clip): clip is Clip => !!clip)
          .map((clip) => this.clipUrl(clip)),
      ),
    ].slice(0, PREFETCH_LIMIT);
    let fetched = 0;
    for (const url of urls) {
      if (generation !== this.prefetchGeneration) {
        break;
      }
      try {
        const response = await fetcher(url, { credentials: 'same-origin' });
        fetched += response.ok ? 1 : 0;
      } catch {
        break;
      }
    }
    return fetched;
  }

  private cancel(): number {
    this.generation += 1;
    this.interrupt?.();
    this.element?.pause();
    this.speakingState.set(false);
    return this.generation;
  }

  private audio(): HTMLAudioElement {
    this.element ??= this.createElement();
    return this.element;
  }

  private settle(setup: (done: () => void) => () => void): Promise<void> {
    return new Promise((resolve) => {
      let cleanup: (() => void) | null = null;
      let settled = false;
      const done = () => {
        if (settled) {
          return;
        }
        settled = true;
        cleanup?.();
        if (this.interrupt === done) {
          this.interrupt = null;
        }
        resolve();
      };
      this.interrupt = done;
      cleanup = setup(done);
      if (settled) {
        cleanup();
      }
    });
  }

  private pause(ms: number): Promise<void> {
    return this.settle((done) => {
      const timer = setTimeout(done, ms);
      return () => clearTimeout(timer);
    });
  }

  private playClip(clip: Clip): Promise<void> {
    const element = this.audio();
    return this.settle((done) => {
      const stall = setTimeout(done, (clip.durationMs ?? UNKNOWN_DURATION_MS) + STALL_MARGIN_MS);
      element.addEventListener('ended', done);
      element.addEventListener('error', done);
      element.src = this.clipUrl(clip);
      element.play()?.catch(() => done());
      return () => {
        clearTimeout(stall);
        element.removeEventListener('ended', done);
        element.removeEventListener('error', done);
      };
    });
  }

  private clipUrl(clip: Clip): string {
    const query = this.version ? `?v=${encodeURIComponent(this.version)}` : '';
    return `${AUDIO_BASE_URL}/${clip.file}${query}`;
  }

  private debug(message: string): void {
    if (isDevMode()) {
      console.debug(`[audio] ${message}`);
    }
  }
}
