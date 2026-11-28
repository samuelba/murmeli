import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { prefersReducedMotion } from '../exercises/shared/motion';
import type { MapWorld } from '../learn.models';
import { SceneView } from './scene';
import { worldComplete } from './trail-layout';
import { hasModifier } from './keys';

/** Every world of a track as a row of round landscape tabs: done, open, locked, and where Murmeli is. */
@Component({
  selector: 'mu-world-strip',
  imports: [TranslocoPipe, Icon, Mascot, SceneView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      #strip
      class="strip"
      role="tablist"
      [attr.aria-label]="'learn.map.worlds' | transloco"
      data-testid="world-strip"
    >
      @for (world of worlds(); track world.id; let i = $index) {
        <button
          type="button"
          role="tab"
          class="chip"
          [id]="'world-tab-' + world.id"
          [attr.aria-selected]="i === selected()"
          [attr.aria-controls]="i === selected() ? panelId() : null"
          [attr.tabindex]="i === selected() ? 0 : -1"
          [attr.aria-label]="
            ('learn.map.world'
              | transloco
                : {
                    title: world.title,
                    state: ('learn.map.worldState.' + world.state | transloco),
                  }) + (i === here() ? ', ' + ('learn.map.youAreHere' | transloco) : '')
          "
          [attr.data-state]="world.state"
          [attr.data-testid]="'world-tab-' + world.id"
          (click)="choose(i)"
          (keydown)="onKey($event, i)"
        >
          <span class="chip__scene"><mu-scene [scene]="world.scene" /></span>
          @if (world.state === 'locked') {
            <span class="chip__badge chip__badge--locked"><mu-icon name="lock" /></span>
          } @else if (complete(world)) {
            <span class="chip__badge" [attr.data-testid]="'world-done-' + world.id">
              <svg viewBox="0 0 48 64" aria-hidden="true">
                <rect x="6" y="4" width="5" height="58" rx="2" fill="#6b4a2b" />
                <path d="M11 6 H44 L36 18 L44 30 H11Z" fill="#e5322d" />
              </svg>
            </span>
          }
          @if (i === here()) {
            <mu-mascot class="chip__here" pose="happy" />
          }
        </button>
      }
    </div>
  `,
  styleUrl: './world-strip.scss',
})
export class WorldStrip {
  readonly worlds = input.required<readonly MapWorld[]>();
  readonly selected = input.required<number>();
  /** The world with the next level to play. */
  readonly here = input.required<number>();
  readonly panelId = input.required<string>();
  readonly chosen = output<number>();

  private readonly strip = viewChild.required<ElementRef<HTMLElement>>('strip');
  private readonly document = inject(DOCUMENT);

  constructor() {
    afterRenderEffect(() => this.center(this.worlds()[this.selected()]?.id));
  }

  protected complete(world: MapWorld): boolean {
    return worldComplete(world);
  }

  protected choose(index: number): void {
    if (index !== this.selected()) {
      this.chosen.emit(index);
    }
  }

  protected onKey(event: KeyboardEvent, index: number): void {
    const last = this.worlds().length - 1;
    const targets: Record<string, number> = {
      ArrowRight: Math.min(last, index + 1),
      ArrowLeft: Math.max(0, index - 1),
      Home: 0,
      End: last,
    };
    const target = targets[event.key];
    if (target === undefined || hasModifier(event)) {
      return;
    }
    event.preventDefault();
    this.choose(target);
    this.tab(this.worlds()[target]!.id)?.focus();
  }

  private tab(worldId: string): HTMLElement | null {
    return this.strip().nativeElement.querySelector<HTMLElement>(
      `#${CSS.escape(`world-tab-${worldId}`)}`,
    );
  }

  private center(worldId: string | undefined): void {
    const strip = this.strip().nativeElement;
    const tab = worldId ? this.tab(worldId) : null;
    if (!tab) {
      return;
    }
    strip.scrollTo?.({
      left: tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2,
      behavior: prefersReducedMotion(this.document) ? 'auto' : 'smooth',
    });
  }
}
