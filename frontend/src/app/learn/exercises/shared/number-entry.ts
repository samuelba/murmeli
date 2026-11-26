export type KeypadKey = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'back' | 'ok';

export const DIGIT_KEYS: readonly KeypadKey[] = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

/** Applies a key to a typed number (as text, so a leading 0 can be replaced). */
export function applyKey(current: string, key: KeypadKey, maxDigits: number): string {
  if (key === 'back') {
    return current.slice(0, -1);
  }
  if (key === 'ok') {
    return current;
  }
  if (current === '0') {
    return key;
  }
  return current.length >= maxDigits ? current : current + key;
}

export function entryValue(text: string): number | null {
  return text === '' ? null : Number(text);
}

export function keyFromEvent(event: KeyboardEvent): KeypadKey | null {
  if (/^[0-9]$/.test(event.key)) {
    return event.key as KeypadKey;
  }
  if (event.key === 'Backspace' || event.key === 'Delete') {
    return 'back';
  }
  return event.key === 'Enter' ? 'ok' : null;
}
