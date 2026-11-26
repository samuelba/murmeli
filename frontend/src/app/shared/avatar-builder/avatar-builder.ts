import { ChangeDetectionStrategy, Component, computed, inject, model } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  AVATAR_ACCESSORIES,
  AVATAR_ANIMALS,
  AVATAR_BACKGROUNDS,
  Avatar,
  animalName,
  partName,
} from '../../core/avatars/avatar-catalog';
import { LanguageService } from '../../core/i18n/language.service';
import { AvatarView } from '../avatar/avatar';
import { Icon } from '../icon/icon';

let nextId = 0;

@Component({
  selector: 'mu-avatar-builder',
  imports: [TranslocoPipe, AvatarView, Icon],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './avatar-builder.html',
  styleUrl: './avatar-builder.scss',
})
export class AvatarBuilder {
  private readonly language = inject(LanguageService).language;

  readonly avatar = model.required<Avatar>();

  protected readonly uid = `avatar-builder-${nextId++}`;
  protected readonly backgrounds = AVATAR_BACKGROUNDS;
  protected readonly animals = computed(() =>
    AVATAR_ANIMALS.map((part) => ({
      id: part.id,
      name: partName(part, this.language()),
      src: `/brand/avatars/${part.file}`,
    })),
  );
  protected readonly accessories = computed(() =>
    AVATAR_ACCESSORIES.map((part) => ({
      id: part.id,
      name: partName(part, this.language()),
      src: `/brand/avatars/${part.file}`,
    })),
  );
  protected readonly previewName = computed(() =>
    animalName(this.avatar().animal, this.language()),
  );
  protected readonly accessoryName = computed(() => {
    const id = this.avatar().accessory;
    const part = AVATAR_ACCESSORIES.find((accessory) => accessory.id === id);
    return part ? partName(part, this.language()) : null;
  });
  protected readonly colorKey = computed(
    () => `avatarBuilder.colors.c${AVATAR_BACKGROUNDS.indexOf(this.avatar().background) + 1}`,
  );

  setAnimal(animal: string): void {
    this.avatar.update((avatar) => ({ ...avatar, animal }));
  }

  setAccessory(accessory: string | null): void {
    this.avatar.update((avatar) => ({ ...avatar, accessory }));
  }

  setBackground(background: string): void {
    this.avatar.update((avatar) => ({ ...avatar, background }));
  }
}
