import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { ErrorMessage, errorMessage } from '../../core/errors/error-message';
import { KidsService } from '../../core/kids/kids.service';
import { AvatarView } from '../../shared/avatar/avatar';
import { FormError } from '../../shared/form-error/form-error';
import { Icon } from '../../shared/icon/icon';
import { Mascot } from '../../shared/mascot/mascot';
import { Speak } from '../../shared/speak/speak';

@Component({
  selector: 'mu-learn',
  imports: [TranslocoPipe, AvatarView, FormError, Icon, Mascot, Speak],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (kid(); as kid) {
      <section class="home mu-kid-mode" aria-labelledby="page-heading">
        <mu-avatar [avatar]="kid.avatar" [size]="128" />
        <div class="title-row">
          <h1 id="page-heading" class="title" data-testid="page-title">
            {{ 'learn.hello' | transloco: { name: kid.nickname } }}
          </h1>
          <mu-speak [text]="'learn.hello' | transloco: { name: kid.nickname }" />
        </div>
        <div class="bubble">
          <mu-mascot pose="happy" />
          <p class="mu-learning-text" data-testid="learn-soon">{{ 'learn.soon' | transloco }}</p>
          <mu-speak [text]="'learn.soon' | transloco" />
        </div>
        <mu-form-error [error]="error()" />
        <button
          type="button"
          class="mu-button mu-button--ghost"
          data-testid="switch-profile"
          [disabled]="busy()"
          (click)="switchProfile()"
        >
          <mu-icon name="family" />
          <span>{{ 'learn.switchProfile' | transloco }}</span>
        </button>
      </section>
    }
  `,
  styles: `
    .home {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--mu-space-5);
      text-align: center;
    }

    .title-row,
    .bubble {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: var(--mu-space-3);
    }

    .title {
      margin: 0;
      font-size: var(--mu-font-size-xl);
      color: var(--mu-color-meadow-strong);
    }

    .bubble {
      padding: var(--mu-space-4);
      border-radius: var(--mu-radius-chunky);
      background: var(--mu-color-surface);
      box-shadow: var(--mu-shadow-card);

      p {
        margin: 0;
        font-size: var(--mu-font-size-lg);
        font-weight: 700;
      }
    }
  `,
})
export class Learn {
  private readonly kids = inject(KidsService);
  private readonly router = inject(Router);

  protected readonly kid = inject(AuthService).activeKid;
  protected readonly busy = signal(false);
  protected readonly error = signal<ErrorMessage | null>(null);

  protected async switchProfile(): Promise<void> {
    this.busy.set(true);
    this.error.set(null);
    try {
      await this.kids.deactivate();
      await this.router.navigateByUrl('/');
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.busy.set(false);
    }
  }
}
