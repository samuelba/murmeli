import { NgTemplateOutlet } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  TemplateRef,
  booleanAttribute,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { Icon } from '../../../shared/icon/icon';
import { Picture } from './picture';
import { Pointer } from './pointer';

export interface ChoiceItem {
  readonly id: string;
  readonly label?: string;
  readonly pictureId?: string;
  readonly value?: number;
}

export type ChoiceKind = 'number' | 'letter' | 'picture' | 'custom';

/**
 * Big answer buttons. A tap answers at once (single-tap exercises submit automatically).
 * The revealed choice gets a check badge, so the solution never depends on color alone.
 */
@Component({
  selector: 'mu-choices',
  imports: [NgTemplateOutlet, TranslocoPipe, Icon, Picture, Pointer],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="mu-choices"
      role="group"
      [attr.aria-label]="label()"
      [attr.data-kind]="kind()"
      [class.mu-cue]="highlighted()"
    >
      @for (choice of choices(); track choice.id; let i = $index) {
        <button
          type="button"
          class="mu-choice"
          [class.mu-choice--selected]="choice.id === selectedId()"
          [class.mu-choice--revealed]="choice.id === revealId()"
          [attr.aria-disabled]="locked() ? 'true' : null"
          [attr.aria-label]="ariaLabel(choice)"
          [attr.data-testid]="'choice-' + choice.id"
          [attr.data-value]="choice.value ?? choice.label ?? choice.pictureId"
          [style.--mu-choice-tint]="'var(--mu-avatar-bg-' + ((i % 9) + 1) + ')'"
          (click)="pick(choice)"
        >
          @if (template(); as tpl) {
            <ng-container *ngTemplateOutlet="tpl; context: { $implicit: choice }" />
          } @else if (choice.pictureId) {
            <mu-picture class="mu-choice__picture" [id]="choice.pictureId" />
          } @else {
            <span class="mu-choice__label">{{ choice.label ?? choice.value }}</span>
          }
          @if (choice.id === revealId()) {
            <span class="mu-choice__badge"><mu-icon name="check" /></span>
            <span class="mu-visually-hidden">{{ 'learn.player.correctLabel' | transloco }}</span>
            @if (pointing()) {
              <mu-pointer />
            }
          }
        </button>
      }
    </div>
  `,
})
export class Choices {
  readonly choices = input.required<readonly ChoiceItem[]>();
  readonly kind = input<ChoiceKind>('number');
  readonly label = input.required<string>();
  readonly locked = input(false, { transform: booleanAttribute });
  readonly revealId = input<string | null>(null);
  readonly pointing = input(false, { transform: booleanAttribute });
  readonly highlighted = input(false, { transform: booleanAttribute });
  readonly template = input<TemplateRef<{ $implicit: ChoiceItem }> | null>(null);
  readonly labelFor = input<((choice: ChoiceItem) => string) | null>(null);
  readonly picked = output<ChoiceItem>();

  protected readonly selectedId = signal<string | null>(null);
  private readonly transloco = inject(TranslocoService);

  protected ariaLabel(choice: ChoiceItem): string | null {
    const label = this.labelFor()?.(choice);
    if (!label) {
      return null;
    }
    return choice.id === this.revealId()
      ? `${label}, ${this.transloco.translate('learn.player.correctLabel')}`
      : label;
  }

  protected pick(choice: ChoiceItem): void {
    if (this.locked()) {
      return;
    }
    this.selectedId.set(choice.id);
    this.picked.emit(choice);
  }
}
