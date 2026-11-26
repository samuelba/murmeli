import { ChangeDetectionStrategy, Component, computed } from '@angular/core';
import { ExerciseBase } from '../shared/exercise-base';
import { LetterTiles } from '../shared/letter-tiles';
import { Picture } from '../shared/picture';

/** Builds the word for a picture from letter tiles: tap a tile to place it, a slot to remove it. */
@Component({
  selector: 'mu-build-word',
  imports: [LetterTiles, Picture],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="mu-ex">
      <div class="mu-ex__stage" [class.mu-cue]="highlighted('picture', 'word')">
        <mu-picture class="hero" data-testid="exercise-picture" [id]="payload().pictureId" />
      </div>
      <mu-letter-tiles
        [length]="payload().length"
        [tiles]="payload().tiles"
        [locked]="locked()"
        [revealed]="revealed()"
        [pointing]="pointing()"
        [highlightTiles]="highlighted('tiles', 'letters')"
        (answered)="emit({ letters: $event })"
      />
    </div>
  `,
  styles: `
    .hero {
      width: clamp(110px, 34vw, 160px);
      height: clamp(110px, 34vw, 160px);
    }
  `,
})
export class BuildWord extends ExerciseBase<'build-word'> {
  protected readonly revealed = computed(() => this.reveal()?.letters ?? null);
}
