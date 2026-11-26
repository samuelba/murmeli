import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  numberAttribute,
} from '@angular/core';
import { Avatar, accessoryUrl, animalUrl } from '../../core/avatars/avatar-catalog';

@Component({
  selector: 'mu-avatar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'mu-avatar',
    '[style.width.px]': 'size()',
    '[style.height.px]': 'size()',
    '[style.background-color]': 'avatar().background',
    '[attr.role]': "label() ? 'img' : null",
    '[attr.aria-label]': 'label() || null',
    '[attr.aria-hidden]': "label() ? null : 'true'",
  },
  template: `
    @if (animal(); as src) {
      <img [src]="src" alt="" />
    }
    @if (accessory(); as src) {
      <img [src]="src" alt="" />
    }
  `,
  styles: `
    :host {
      position: relative;
      display: inline-block;
      flex: none;
      overflow: hidden;
      border-radius: 50%;
      box-shadow: inset 0 0 0 3px rgb(59 42 32 / 0.15);
    }

    img {
      position: absolute;
      inset: 0;
      width: 100%;
      height: 100%;
    }
  `,
})
export class AvatarView {
  readonly avatar = input.required<Avatar>();
  readonly size = input(64, { transform: numberAttribute });
  readonly label = input('');

  protected readonly animal = computed(() => animalUrl(this.avatar().animal));
  protected readonly accessory = computed(() => accessoryUrl(this.avatar().accessory));
}
