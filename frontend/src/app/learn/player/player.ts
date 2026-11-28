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
import { KidsService } from '../../core/kids/kids.service';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';
import { ExerciseHost } from '../exercises/exercise-host';
import { AnyAnswer, RunMode } from '../learn.models';
import { BreakReminder } from './break-reminder';
import { Confetti } from './confetti';
import { ExitDialog, ExitDialogData } from './exit-dialog';
import { PlayerStore } from './player-store';
import { ProgressDots } from './progress-dots';
import { Rest } from './rest';
import { Results } from './results';

/**
 * `/learn/level/:levelId`, `/learn/practice/mix` and `/learn/practice/:topicId`: one run,
 * from the demo to the stars.
 */
@Component({
  selector: 'mu-player',
  imports: [
    TranslocoPipe,
    BreakReminder,
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
  private readonly kids = inject(KidsService);
  protected readonly store = inject(PlayerStore);

  private readonly params = toSignal(
    inject(ActivatedRoute).paramMap.pipe(
      map((params) => ({ levelId: params.get('levelId'), topicId: params.get('topicId') })),
    ),
    { initialValue: { levelId: null, topicId: null } },
  );
  private readonly mode = computed<RunMode>(() => (this.params().levelId ? 'level' : 'practice'));
  /** The level of a level run, or the topic of a practice run (null: Murmeli wählt). */
  private readonly target = computed(() => {
    const { levelId, topicId } = this.params();
    return levelId ?? topicId;
  });

  protected readonly busy = computed(() => this.store.phase() === 'checking');
  protected readonly exercises = computed(() => {
    const item = this.store.item();
    return item ? [{ key: this.store.itemKey(), item }] : [];
  });

  constructor() {
    effect(() => {
      const target = this.target();
      untracked(() => void this.store.start(this.mode(), target));
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
      } else if (['playing', 'demo', 'results', 'resting', 'break', 'error'].includes(phase)) {
        untracked(() => this.focus('h1[tabindex="-1"]'));
      }
    });
  }

  protected answer(answer: AnyAnswer): void {
    void this.store.submit(answer);
  }

  protected async exit(): Promise<void> {
    const practice = this.mode() === 'practice';
    const ref = this.dialog.open<boolean, ExitDialogData>(ExitDialog, {
      data: { confirmKey: practice ? 'learn.player.exitPractice' : 'learn.player.exitConfirm' },
      ariaLabelledBy: 'exit-title',
      backdropClass: 'mu-dialog-backdrop',
      autoFocus: 'first-tabbable',
    });
    if (await firstValueFrom(ref.closed)) {
      await (practice ? this.toPractice() : this.toMap());
    }
  }

  protected toPractice(): Promise<boolean> {
    return this.router.navigateByUrl('/learn/practice');
  }

  protected toMap(): Promise<boolean> {
    return this.router.navigateByUrl('/learn');
  }

  /** "Pause machen": back to the profile picker, so the next kid (or a parent) can take over. */
  protected async takeBreak(): Promise<void> {
    try {
      await this.kids.deactivate();
      await this.router.navigateByUrl('/');
    } catch {
      await this.toMap();
    }
  }

  protected playLevel(levelId: string): Promise<boolean> {
    return this.router.navigate(['/learn/level', levelId]);
  }

  protected again(): void {
    void this.store.start(this.mode(), this.target());
  }

  private focus(selector: string): void {
    const target = this.host.nativeElement.querySelector<HTMLElement>(selector);
    if (target && !target.contains(this.document.activeElement)) {
      target.focus({ preventScroll: true });
    }
  }
}
