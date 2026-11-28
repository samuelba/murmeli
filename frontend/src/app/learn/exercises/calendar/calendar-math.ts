import type { CalendarCard } from '@murmeli/content';

/** How many cards a count along steps through: from the first card to the target card. */
export function ringSteps(ring: readonly CalendarCard[], target: number | null): number {
  return target === null ? 0 : ring.findIndex((card) => card.index === target) + 1;
}
