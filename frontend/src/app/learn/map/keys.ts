/** Arrow keys with Alt, Ctrl, Meta or Shift belong to the browser (back, forward, selection). */
export function hasModifier(event: KeyboardEvent): boolean {
  return event.altKey || event.ctrlKey || event.metaKey || event.shiftKey;
}
