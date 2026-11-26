import { ChangeDetectionStrategy, Component, booleanAttribute, input } from '@angular/core';
import { BRAND_NAME } from '../../core/brand';

let nextId = 0;

@Component({
  selector: 'mu-logo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './logo.html',
  styleUrl: './logo.scss',
})
export class Logo {
  readonly animated = input(false, { transform: booleanAttribute });
  readonly decorative = input(true, { transform: booleanAttribute });

  protected readonly brandName = BRAND_NAME;
  protected readonly ids = Logo.createIds(nextId++);
  protected readonly refs = {
    sky: `url(#${this.ids.sky})`,
    meadow: `url(#${this.ids.meadow})`,
    fur: `url(#${this.ids.fur})`,
    tile: `url(#${this.ids.tile})`,
    burrow: `url(#${this.ids.burrow})`,
  };

  private static createIds(n: number) {
    return {
      sky: `mu-logo-sky-${n}`,
      meadow: `mu-logo-meadow-${n}`,
      fur: `mu-logo-fur-${n}`,
      tile: `mu-logo-tile-clip-${n}`,
      burrow: `mu-logo-burrow-clip-${n}`,
    };
  }
}
