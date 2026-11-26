import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import type { Scene } from '@murmeli/content';
import { SPEAK_PROVIDER } from '../../../shared/speak/speak-provider';
import { LearnContent } from '../../content/learn-content';
import { ChoiceItem, Choices } from '../shared/choices';
import { ExerciseBase } from '../shared/exercise-base';
import { SceneView } from './scene';

interface Word {
  readonly text: string;
  readonly spoken: string;
}

/** Read a sentence and tap the matching picture. Words with a clip can be tapped to hear them. */
@Component({
  selector: 'mu-sentence-picture',
  imports: [TranslocoPipe, Choices, SceneView],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage stage" [class.mu-cue]="highlighted('sentence', 'word', 'prompt')">
        <p class="sentence mu-learning-text" data-testid="sentence">
          @for (word of words(); track $index) {
            @if (canSpeak(word.spoken)) {
              <button
                type="button"
                class="word word--speak"
                [attr.data-testid]="'word-' + $index"
                [attr.aria-label]="'common.readAloud' | transloco: { text: word.spoken }"
                (click)="say(word.spoken)"
              >
                {{ word.text }}
              </button>
            } @else {
              <span class="word">{{ word.text }}</span>
            }
          }
        </p>
      </div>
      <mu-choices
        kind="custom"
        [choices]="choices()"
        [label]="'learn.ex.answers' | transloco"
        [locked]="locked()"
        [revealId]="reveal()?.choiceId ?? null"
        [pointing]="pointing()"
        [highlighted]="highlighted('choices', 'picture')"
        [template]="sceneTemplate"
        [labelFor]="labelFor"
        (picked)="emit({ choiceId: $event.id })"
      />
      <ng-template #sceneTemplate let-choice>
        <mu-scene [scene]="sceneOf(choice.id)" />
      </ng-template>
    </div>
  `,
  styles: `
    .stage {
      gap: var(--mu-space-3);
    }

    .sentence {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: var(--mu-space-2) 0.45em;
      margin: 0;
      font-size: clamp(2rem, 1.5rem + 2.4vw, 2.9rem);
      font-weight: 700;
      line-height: 1.35;
      word-spacing: 0.2em;
    }

    .word {
      display: inline-flex;
      align-items: center;
      padding: 0 0.12em;
    }

    .word--speak {
      min-height: var(--mu-touch-target);
      border: 0;
      border-bottom: 4px dotted var(--mu-color-sky-strong);
      border-radius: var(--mu-radius-sm);
      background: transparent;
      color: inherit;
      font: inherit;
      cursor: pointer;
      touch-action: manipulation;

      &:focus-visible {
        outline: 4px solid var(--mu-color-focus);
        outline-offset: 2px;
      }

      &:active {
        background: color-mix(in srgb, var(--mu-color-sky) 25%, transparent);
      }
    }
  `,
})
export class SentencePicture extends ExerciseBase<'sentence-picture'> {
  private readonly speaker = inject(SPEAK_PROVIDER, { optional: true });
  private readonly transloco = inject(TranslocoService);
  private readonly content = inject(LearnContent);

  protected readonly words = computed<Word[]>(() =>
    this.payload()
      .sentence.split(/\s+/)
      .filter((text) => text.length > 0)
      .map((text) => ({ text, spoken: text.replace(/[.,!?;:]+$/u, '') })),
  );
  protected readonly choices = computed<ChoiceItem[]>(() =>
    this.payload().choices.map((choice) => ({ id: choice.id })),
  );
  private readonly scenes = computed(
    () => new Map(this.payload().choices.map((choice) => [choice.id, choice.scene])),
  );

  protected readonly labelFor = (choice: ChoiceItem): string => {
    const scene = this.scenes().get(choice.id);
    return scene ? this.describe(scene) : '';
  };

  protected sceneOf(id: string): Scene {
    return this.scenes().get(id) ?? { kind: 'count', pictureId: '', count: 0 };
  }

  protected canSpeak(word: string): boolean {
    return this.speaker?.canSpeak?.(word) ?? false;
  }

  protected say(word: string): void {
    this.speaker?.speak(word);
  }

  private describe(scene: Scene): string {
    if (scene.kind === 'count') {
      return this.transloco.translate('learn.ex.quantity.objects', {
        count: scene.count,
        word: this.content.word(scene.pictureId),
      });
    }
    return this.transloco.translate('learn.ex.sentence.scene', {
      subject: this.content.word(scene.subject),
      relation: this.transloco.translate(`learn.ex.sentence.${scene.relation}`),
      object: this.content.word(scene.object),
    });
  }
}
