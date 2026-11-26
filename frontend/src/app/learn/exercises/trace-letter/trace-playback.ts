import { signal } from '@angular/core';
import { prefersReducedMotion } from '../shared/motion';
import { TraceFrame, frameAt } from './trace-animation';
import { TraceStroke } from './trace-geometry';

const HOLD_FINISHED_MS = 1200;

export type PlaybackSource = 'demo' | 'help';

/**
 * Murmeli drawing the model: a frame per animation frame until every stroke is drawn. The demo
 * keeps the finished letter; "Zeig mir" and hints let it go after a moment.
 */
export class ModelPlayback {
  readonly frame = signal<TraceFrame | null>(null);
  private handle: number | null = null;
  private hold: ReturnType<typeof setTimeout> | null = null;
  private current: PlaybackSource | null = null;

  constructor(private readonly document: Document) {}

  get source(): PlaybackSource | null {
    return this.current;
  }

  play(strokes: readonly TraceStroke[], source: PlaybackSource): void {
    this.stop();
    this.current = source;
    const view = this.document.defaultView;
    const now = () => view?.performance?.now() ?? Date.now();
    const stepwise = prefersReducedMotion(this.document);
    const started = now();
    const tick = () => {
      const frame = frameAt(strokes, now() - started, stepwise);
      this.frame.set(frame);
      this.handle = null;
      if (!frame.finished) {
        this.handle = this.schedule(tick);
      } else if (source === 'help') {
        this.hold = setTimeout(() => this.stop(), HOLD_FINISHED_MS);
      }
    };
    tick();
  }

  stop(): void {
    const view = this.document.defaultView;
    if (this.handle !== null) {
      if (view?.cancelAnimationFrame) {
        view.cancelAnimationFrame(this.handle);
      } else {
        clearTimeout(this.handle);
      }
      this.handle = null;
    }
    if (this.hold !== null) {
      clearTimeout(this.hold);
      this.hold = null;
    }
    this.current = null;
    this.frame.set(null);
  }

  private schedule(callback: () => void): number {
    const view = this.document.defaultView;
    return view?.requestAnimationFrame
      ? view.requestAnimationFrame(callback)
      : (setTimeout(callback, 16) as unknown as number);
  }
}
