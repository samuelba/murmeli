import {
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  inject,
  input,
} from '@angular/core';
import { LearnContent, pictureUrl } from '../../content/learn-content';

/** A content picture (`/pictures/<id>.svg`) named by its word in the kid's language. */
@Component({
  selector: 'mu-picture',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'mu-picture' },
  template: `<img [src]="src()" [alt]="decorative() ? '' : word()" draggable="false" />`,
  styles: `
    :host {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      width: 64px;
      height: 64px;
      flex: none;
    }

    img {
      display: block;
      width: 100%;
      height: 100%;
      object-fit: contain;
      user-select: none;
      pointer-events: none;
    }
  `,
})
export class Picture {
  private readonly content = inject(LearnContent);

  readonly id = input.required<string>();
  readonly decorative = input(false, { transform: booleanAttribute });

  protected readonly src = computed(() => pictureUrl(this.id()));
  protected readonly word = computed(() => this.content.word(this.id()));
}
