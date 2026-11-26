import { signal } from '@angular/core';
import {
  MAX_STROKES,
  TracePoint,
  TraceStroke,
  VIEW_MIN,
  VIEW_SIZE,
  appendPoint,
  distanceToStrokes,
  finishStroke,
  toBox,
} from './trace-geometry';

/** Arrow keys move the pen this far (box units); with Shift, further. */
export const KEY_STEP = 4;
export const KEY_BIG_STEP = 10;
/** The keyboard pen counts as "on the line" this close to the model. */
export const ON_LINE = 8;

const KEYS: Readonly<Record<string, TracePoint>> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

/** What the pen needs from the exercise around it. */
export interface PenHost {
  readonly locked: () => boolean;
  readonly model: () => readonly TraceStroke[];
  /** Where the keyboard pen starts: the start of the next stroke, if the model is shown. */
  readonly nextStart: (strokeIndex: number) => TracePoint;
  readonly rect: () => Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>;
  readonly capture: (pointerId: number) => void;
  readonly announce: (key: string, params?: Record<string, unknown>) => void;
  readonly drawingStarts: () => void;
  readonly submit: () => void;
}

/**
 * The kid's strokes, from pointers (one at a time, primary only, so a palm is ignored) or from
 * the keyboard pen (arrows move it, space sets it down and lifts it).
 */
export class TracePen {
  readonly strokes = signal<readonly TraceStroke[]>([]);
  readonly current = signal<TraceStroke | null>(null);
  readonly pen = signal<TracePoint | null>(null);
  readonly keyboard = signal(false);
  readonly full = signal(false);
  private activePointer: number | null = null;
  private onLine: boolean | null = null;

  constructor(private readonly host: PenHost) {}

  down(event: PointerEvent): void {
    if (this.host.locked() || this.activePointer !== null || !event.isPrimary) {
      return;
    }
    if (event.pointerType === 'mouse' && event.button !== 0) {
      return;
    }
    event.preventDefault();
    if (this.strokes().length >= MAX_STROKES) {
      this.flashFull();
      return;
    }
    this.host.drawingStarts();
    this.keyboard.set(false);
    this.activePointer = event.pointerId;
    this.host.capture(event.pointerId);
    this.current.set([this.point(event)]);
  }

  move(event: PointerEvent): void {
    const stroke = this.current();
    if (event.pointerId !== this.activePointer || !stroke) {
      return;
    }
    const events = event.getCoalescedEvents?.() ?? [];
    this.current.set(
      (events.length > 0 ? events : [event]).reduce(
        (points, each) => appendPoint(points, this.point(each)),
        stroke,
      ),
    );
  }

  up(event: PointerEvent): void {
    if (event.pointerId !== this.activePointer) {
      return;
    }
    this.activePointer = null;
    if (event.type !== 'lostpointercapture') {
      this.current.update((stroke) => (stroke ? appendPoint(stroke, this.point(event)) : stroke));
    }
    this.endStroke();
  }

  /** The browser took the pointer away (a gesture, a palm): keep only a real stroke. */
  cancel(event: PointerEvent): void {
    if (event.pointerId !== this.activePointer) {
      return;
    }
    this.activePointer = null;
    if ((this.current()?.length ?? 0) < 3) {
      this.current.set(null);
    } else {
      this.endStroke();
    }
  }

  key(event: KeyboardEvent): void {
    if (this.host.locked() || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const direction = KEYS[event.key];
    if (direction) {
      event.preventDefault();
      this.movePen(direction, event.shiftKey ? KEY_BIG_STEP : KEY_STEP);
    } else if (event.key === ' ') {
      event.preventDefault();
      this.togglePen();
    } else if (event.key === 'Backspace' || event.key === 'Delete') {
      event.preventDefault();
      this.undo();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.host.submit();
    }
  }

  clear(): void {
    this.strokes.set([]);
    this.current.set(null);
    this.activePointer = null;
    this.host.announce('learn.ex.trace.cleared');
  }

  /** Every stroke, the one still being drawn included. */
  finish(): readonly TraceStroke[] {
    if (this.current()) {
      this.endStroke();
    }
    return this.strokes();
  }

  private point(event: Pick<PointerEvent, 'clientX' | 'clientY'>): TracePoint {
    return toBox(event.clientX, event.clientY, this.host.rect());
  }

  private movePen([dx, dy]: TracePoint, step: number): void {
    this.keyboard.set(true);
    const [x, y] = this.pen() ?? this.host.nextStart(this.strokes().length);
    const clampToView = (value: number) =>
      Math.min(Math.max(value, VIEW_MIN), VIEW_MIN + VIEW_SIZE);
    const next: TracePoint = [clampToView(x + dx * step), clampToView(y + dy * step)];
    this.pen.set(next);
    this.current.update((stroke) => (stroke ? appendPoint(stroke, next) : stroke));
    this.announcePosition(next);
  }

  /** Says "on the line" or "off the line", only when that changes. */
  private announcePosition(point: TracePoint): void {
    const onLine = distanceToStrokes(point, this.host.model()) <= ON_LINE;
    if (onLine !== this.onLine) {
      this.onLine = onLine;
      this.host.announce(onLine ? 'learn.ex.trace.onLine' : 'learn.ex.trace.offLine');
    }
  }

  private togglePen(): void {
    this.keyboard.set(true);
    if (this.current()) {
      this.endStroke();
      this.host.announce('learn.ex.trace.penUp');
      return;
    }
    if (this.strokes().length >= MAX_STROKES) {
      this.flashFull();
      return;
    }
    this.host.drawingStarts();
    const pen = this.pen() ?? this.host.nextStart(this.strokes().length);
    this.pen.set(pen);
    this.current.set([pen]);
    this.host.announce('learn.ex.trace.penDown');
  }

  /** Drops the stroke being drawn, or else the last one. */
  private undo(): void {
    if (this.current()) {
      this.current.set(null);
    } else {
      this.strokes.update((strokes) => strokes.slice(0, -1));
    }
    this.announceCount();
  }

  private endStroke(): void {
    const stroke = this.current();
    this.current.set(null);
    if (!stroke || stroke.length === 0) {
      return;
    }
    this.strokes.update((strokes) => [...strokes, finishStroke(stroke)]);
    this.announceCount();
  }

  private announceCount(): void {
    this.host.announce('learn.ex.trace.drawn', { count: this.strokes().length });
  }

  private flashFull(): void {
    this.full.set(false);
    this.host.announce('learn.ex.trace.full');
    queueMicrotask(() => this.full.set(true));
  }
}
