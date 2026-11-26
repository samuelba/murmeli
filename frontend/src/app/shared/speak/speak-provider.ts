import { InjectionToken, Signal } from '@angular/core';

/** What the narrator says: one text, or segments played back to back. */
export type SpeechInput = string | readonly string[];

export interface SpeakProvider {
  speak(input: SpeechInput): void;
  /** False while no narration exists (no audio manifest): `<mu-speak>` then stays hidden. */
  readonly available?: Signal<boolean>;
  /** True when at least one segment has a clip. Reads signals, so templates update on load. */
  canSpeak?(input: SpeechInput): boolean;
  /** Starts loading what `available` and `canSpeak` depend on. */
  prepare?(): void;
}

/** Registered by the audio service. Without it, <mu-speak> renders nothing. */
export const SPEAK_PROVIDER = new InjectionToken<SpeakProvider>('SPEAK_PROVIDER');
