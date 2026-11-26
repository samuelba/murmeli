import { Dialog } from '@angular/cdk/dialog';
import {
  ChangeDetectionStrategy,
  Component,
  DOCUMENT,
  ElementRef,
  afterRenderEffect,
  computed,
  effect,
  inject,
  untracked,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { firstValueFrom, map } from 'rxjs';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';
import { ExerciseHost } from '../exercises/exercise-host';
import { AnyAnswer, RunMode } from '../learn.models';
import { Confetti } from './confetti';
import { ExitDialog } from './exit-dialog';
import { PlayerStore } from './player-store';
import { ProgressDots } from './progress-dots';
import { Rest } from './rest';
import { Results } from './results';

/** `/learn/level/:levelId` and `/learn/practice`: one run, from the demo to the stars. */
@Component({
  selector: 'mu-player',
  imports: [
    TranslocoPipe,
    Confetti,
    ExerciseHost,
    FormError,
    Icon,
    Mascot,
    ProgressDots,
    Rest,
    Results,
    Speak,
  ],
  providers: [PlayerStore],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './player.html',
  styleUrl: './player.scss',
})
export class Player {
  private readonly router = inject(Router);
  private readonly dialog = inject(Dialog);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly document = inject(DOCUMENT);
  protected readonly store = inject(PlayerStore);

  private readonly params = toSignal(
    inject(ActivatedRoute).paramMap.pipe(map((params) => params.get('levelId'))),
    { initialValue: null },
  );
  private readonly mode = computed<RunMode>(() => (this.params() ? 'level' : 'practice'));

  protected readonly busy = computed(() => this.store.phase() === 'checking');
  protected readonly exercises = computed(() => {
    const item = this.store.item();
    return item ? [{ key: this.store.itemKey(), item }] : [];
  });

  constructor() {
    effect(() => {
      const levelId = this.params();
      untracked(() => void this.store.start(this.mode(), levelId));
    });
    afterRenderEffect(() => {
      this.store.itemKey();
      const phase = this.store.phase();
      if (phase === 'feedback') {
        untracked(() => {
          this.focus('[data-testid="next"]');
          this.host.nativeElement
            .querySelector('.mu-choice--revealed, .mu-blank--revealed, .flag__cloth--revealed')
            ?.scrollIntoView?.({ block: 'center' });
        });
      } else if (['playing', 'demo', 'results', 'resting', 'error'].includes(phase)) {
        untracked(() => this.focus('h1[tabindex="-1"]'));
      }
    });
  }

  protected answer(answer: AnyAnswer): void {
    void this.store.submit(answer);
  }

  protected async exit(): Promise<void> {
    const ref = this.dialog.open<boolean>(ExitDialog, {
      ariaLabelledBy: 'exit-title',
      backdropClass: 'mu-dialog-backdrop',
      autoFocus: 'first-tabbable',
    });
    if (await firstValueFrom(ref.closed)) {
      await this.toMap();
    }
  }

  protected toMap(): Promise<boolean> {
    return this.router.navigateByUrl('/learn');
  }

  protected playLevel(levelId: string): Promise<boolean> {
    return this.router.navigate(['/learn/level', levelId]);
  }

  protected again(): void {
    void this.store.start(this.mode(), this.params());
  }

  private focus(selector: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
    if (target && !target.contains(this.document.activeElement)) {
      target.focus({ preventScroll: true });
    }
  }
}
