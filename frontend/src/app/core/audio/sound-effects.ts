import { DOCUMENT, DestroyRef, Injectable, InjectionToken, computed, inject } from '@angular/core';
import { AuthService } from '../auth/auth.service';

export type SoundEffect = 'correct' | 'wrong' | 'star' | 'complete' | 'locked';

/** Creates the Web Audio context on first use; null where Web Audio is missing. */
export const AUDIO_CONTEXT_FACTORY = new InjectionToken<() => AudioContext | null>(
  'AUDIO_CONTEXT_FACTORY',
  {
    providedIn: 'root',
    factory: () => () => (typeof AudioContext === 'undefined' ? null : new AudioContext()),
  },
);

interface Note {
  readonly frequency: number;
  readonly at: number;
  readonly duration: number;
  readonly type?: OscillatorType;
  readonly volume?: number;
}

const C5 = 523.25;
const E5 = 659.25;
const G5 = 783.99;
const C6 = 1046.5;

/** Short, soft tones made with oscillators: no sound files to ship or license. */
export const EFFECTS: Readonly<Record<SoundEffect, readonly Note[]>> = {
  correct: [
    { frequency: C5, at: 0, duration: 0.14 },
    { frequency: E5, at: 0.09, duration: 0.14 },
    { frequency: G5, at: 0.18, duration: 0.28 },
  ],
  wrong: [
    { frequency: 392, at: 0, duration: 0.16, type: 'sine', volume: 0.12 },
    { frequency: 349.23, at: 0.14, duration: 0.24, type: 'sine', volume: 0.1 },
  ],
  star: [{ frequency: C6, at: 0, duration: 0.18, volume: 0.12 }],
  locked: [
    { frequency: 330, at: 0, duration: 0.1, type: 'sine', volume: 0.1 },
    { frequency: 330, at: 0.14, duration: 0.1, type: 'sine', volume: 0.1 },
  ],
  complete: [
    { frequency: C5, at: 0, duration: 0.16 },
    { frequency: E5, at: 0.12, duration: 0.16 },
    { frequency: G5, at: 0.24, duration: 0.16 },
    { frequency: C6, at: 0.36, duration: 0.5 },
    { frequency: G5, at: 0.36, duration: 0.5, volume: 0.08 },
  ],
};

/** Sound effects for feedback. Silent when the kid's `soundEnabled` setting is off. */
@Injectable({ providedIn: 'root' })
export class SoundEffects {
  private readonly createContext = inject(AUDIO_CONTEXT_FACTORY);
  private readonly activeKid = inject(AuthService).activeKid;
  private context: AudioContext | null | undefined;

  readonly enabled = computed(() => this.activeKid()?.soundEnabled ?? true);

  constructor() {
    const document = inject(DOCUMENT);
    const unlock = () => {
      if (this.enabled()) {
        void this.audioContext()
          ?.resume()
          .catch(() => undefined);
      }
    };
    document.addEventListener('pointerdown', unlock, { once: true, capture: true });
    inject(DestroyRef).onDestroy(() => {
      document.removeEventListener('pointerdown', unlock, { capture: true });
      void this.context?.close().catch(() => undefined);
    });
  }

  play(effect: SoundEffect): void {
    if (!this.enabled()) {
      return;
    }
    const context = this.audioContext();
    if (!context) {
      return;
    }
    if (context.state === 'suspended') {
      void context.resume().catch(() => undefined);
    }
    const start = context.currentTime + 0.01;
    EFFECTS[effect].forEach((note) => this.tone(context, note, start));
  }

  private audioContext(): AudioContext | null {
    if (this.context === undefined) {
      try {
        this.context = this.createContext();
      } catch {
        this.context = null;
      }
    }
    return this.context;
  }

  private tone(context: AudioContext, note: Note, start: number): void {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    const begin = start + note.at;
    const end = begin + note.duration;
    oscillator.type = note.type ?? 'triangle';
    oscillator.frequency.setValueAtTime(note.frequency, begin);
    gain.gain.setValueAtTime(0.0001, begin);
    gain.gain.exponentialRampToValueAtTime(note.volume ?? 0.18, begin + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(begin);
    oscillator.stop(end + 0.02);
  }
}
