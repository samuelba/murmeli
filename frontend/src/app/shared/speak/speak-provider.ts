import { InjectionToken } from '@angular/core';

export interface SpeakProvider {
  speak(text: string): void;
}

/** Registered by the audio service (milestone 3). Without it, <mu-speak> renders nothing. */
export const SPEAK_PROVIDER = new InjectionToken<SpeakProvider>('SPEAK_PROVIDER');
