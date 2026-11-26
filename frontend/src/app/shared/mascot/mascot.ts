import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { MascotThinking } from './mascot-thinking';

export const MASCOT_POSES = ['happy', 'thinking', 'cheering', 'encouraging', 'sleeping'] as const;
export type MascotPose = (typeof MASCOT_POSES)[number];

@Component({
  selector: 'mu-mascot',
  imports: [MascotThinking],
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-mascot', '[attr.data-pose]': 'pose()' },
  template: `
    @if (pose() === 'thinking' && animated()) {
      <mu-mascot-thinking />
    } @else {
      <img [src]="'/brand/mascot/' + pose() + '.svg'" alt="" width="200" height="200" />
    }
  `,
  styles: `
    :host {
      display: inline-block;
      width: 120px;
      height: 120px;
      flex: none;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
    }
  `,
})
export class Mascot {
  readonly pose = input<MascotPose>('happy');
  readonly animated = input(false, { transform: booleanAttribute });
}
