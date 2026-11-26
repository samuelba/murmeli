import { InjectionToken } from '@angular/core';

const PBKDF2 = ['PBKDF2/SHA-256', 'PBKDF2/SHA-384', 'PBKDF2/SHA-512'];
const SHA = ['SHA-256', 'SHA-384', 'SHA-512'];

/**
 * Loads the CSP-friendly ALTCHA build: no inline workers or styles. The workers are served
 * from /altcha/ (copied from node_modules by angular.json) so `script-src 'self'` covers them.
 */
export async function loadAltcha(): Promise<void> {
  await import('altcha/external');
  const altcha = globalThis.$altcha;
  PBKDF2.forEach((name) => altcha.algorithms.set(name, () => new Worker('/altcha/pbkdf2.js')));
  SHA.forEach((name) => altcha.algorithms.set(name, () => new Worker('/altcha/sha.js')));
}

export const ALTCHA_LOADER = new InjectionToken<() => Promise<void>>('ALTCHA_LOADER', {
  providedIn: 'root',
  factory: () => loadAltcha,
});
