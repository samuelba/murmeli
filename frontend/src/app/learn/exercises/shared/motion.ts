/** True when the kid's device asks for reduced motion. */
export function prefersReducedMotion(document: Document): boolean {
  return document.defaultView?.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}
