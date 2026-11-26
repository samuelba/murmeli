import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import type { Scene } from '@murmeli/content';
import { Picture } from '../shared/picture';

/** A tiny picture scene: one thing on, under or next to another, or a few of the same thing. */
@Component({
  selector: 'mu-scene',
  imports: [Picture],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true', '[attr.data-kind]': 'scene().kind' },
  template: `
    @if (position(); as scene) {
      <span class="ground"></span>
      <mu-picture
        decorative
        class="object"
        [attr.data-relation]="scene.relation"
        [id]="scene.object"
      />
      <mu-picture
        decorative
        class="subject"
        [attr.data-relation]="scene.relation"
        [id]="scene.subject"
      />
    } @else if (count(); as scene) {
      <span class="many" [attr.data-count]="scene.count">
        @for (item of items(); track item) {
          <mu-picture decorative class="one" [id]="scene.pictureId" />
        }
      </span>
    }
  `,
  styles: `
    :host {
      position: relative;
      display: block;
      width: clamp(112px, 34vw, 156px);
      aspect-ratio: 1.15;
    }

    .ground {
      position: absolute;
      inset: auto 4% 4% 4%;
      height: 5%;
      border-radius: 999px;
      background: color-mix(in srgb, var(--mu-color-meadow) 45%, transparent);
    }

    mu-picture {
      position: absolute;
    }

    .object {
      width: 64%;
      height: 56%;
      left: 18%;
      bottom: 8%;
    }

    .subject {
      width: 36%;
      height: 32%;
      left: 32%;
      z-index: 1;
    }

    .subject[data-relation='on'] {
      bottom: 41%;
    }

    .object[data-relation='under'] {
      bottom: 38%;
      height: 50%;
    }

    .subject[data-relation='under'] {
      bottom: 6%;
    }

    .object[data-relation='next-to'] {
      width: 50%;
      left: 4%;
    }

    .subject[data-relation='next-to'] {
      left: 58%;
      bottom: 8%;
    }

    .many {
      position: absolute;
      inset: 0;
      display: flex;
      flex-wrap: wrap;
      align-content: center;
      justify-content: center;
      gap: 4%;
    }

    .one {
      position: static;
      width: 30%;
      height: 38%;
    }
  `,
})
export class SceneView {
  readonly scene = input.required<Scene>();

  protected readonly position = computed(() => {
    const scene = this.scene();
    return scene.kind === 'position' ? scene : null;
  });
  protected readonly count = computed(() => {
    const scene = this.scene();
    return scene.kind === 'count' ? scene : null;
  });
  protected readonly items = computed(() => {
    const scene = this.count();
    return Array.from({ length: scene?.count ?? 0 }, (_, index) => index);
  });
}
