import { Signal, computed, signal } from '@angular/core';
import { KeypadKey, applyKey } from './number-entry';

/**
 * Several blanks filled with one keypad (Zahlenhaus, Rechenmauer). Tap a blank to pick it; OK
 * moves on to the next empty blank and reports `complete` once every blank has a number.
 */
export class BlankEntry {
  private readonly texts = signal<Readonly<Record<string, string>>>({});
  private readonly selected = signal<string | null>(null);

  readonly active: Signal<string | null> = computed(() => {
    const selected = this.selected();
    const ids = this.ids();
    return selected !== null && ids.includes(selected) ? selected : (ids[0] ?? null);
  });
  readonly complete = computed(() => this.ids().every((id) => (this.texts()[id] ?? '') !== ''));
  readonly canConfirm = computed(() => {
    const active = this.active();
    return this.complete() || (active !== null && (this.texts()[active] ?? '') !== '');
  });

  constructor(
    private readonly ids: Signal<readonly string[]>,
    private readonly maxDigits = 3,
  ) {}

  text(id: string): string {
    return this.texts()[id] ?? '';
  }

  select(id: string): void {
    this.selected.set(id);
  }

  /** Returns true when OK was pressed with every blank filled. */
  press(key: KeypadKey): boolean {
    const active = this.active();
    if (active === null) {
      return false;
    }
    if (key !== 'ok') {
      this.texts.update((texts) => ({
        ...texts,
        [active]: applyKey(texts[active] ?? '', key, this.maxDigits),
      }));
      return false;
    }
    if (this.complete()) {
      return true;
    }
    if (this.text(active) === '') {
      return false;
    }
    const ids = this.ids();
    const start = ids.indexOf(active);
    const next = [...ids.slice(start + 1), ...ids.slice(0, start)].find(
      (id) => this.text(id) === '',
    );
    if (next !== undefined) {
      this.selected.set(next);
    }
    return false;
  }

  values(): Record<string, number> {
    return Object.fromEntries(this.ids().map((id) => [id, Number(this.text(id))]));
  }
}
