import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { AuthService } from '../../core/auth/auth.service';
import { BRAND_NAME } from '../../core/brand';
import { Icon } from '../../shared/icon/icon';
import { PageCard } from '../../shared/page-card/page-card';

export type LegalPageKind = 'privacy' | 'terms';

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;

function filled(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

const SECTIONS: Record<LegalPageKind, readonly string[]> = {
  privacy: ['stored', 'kids', 'noPhotos', 'noTrackers', 'cookies', 'rights'],
  terms: ['purpose', 'accounts', 'kids', 'content', 'liability', 'changes'],
};

@Component({
  selector: 'mu-legal',
  imports: [TranslocoPipe, Icon, PageCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-page-card>
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'legal.' + kind() + 'Title' | transloco }}
      </h1>
      <p class="mu-notice" data-testid="legal-draft">
        <mu-icon name="warning" />
        <span>{{ 'legal.draft' | transloco }}</span>
      </p>
      @for (section of sections(); track section) {
        <section>
          <h2 class="mu-section-title">
            {{ 'legal.' + kind() + '.' + section + '.title' | transloco }}
          </h2>
          <p>{{ 'legal.' + kind() + '.' + section + '.text' | transloco: brand }}</p>
        </section>
      }
      <section data-testid="legal-operator">
        <h2 class="mu-section-title">{{ 'legal.operator.title' | transloco }}</h2>
        @if (operator(); as operator) {
          <address class="operator">
            @if (operator.name) {
              <span data-testid="operator-name">{{ operator.name }}</span>
            }
            @if (operator.address) {
              <span class="operator__address" data-testid="operator-address">{{
                operator.address
              }}</span>
            }
            @if (operator.email) {
              @if (operator.emailLink) {
                <a [href]="'mailto:' + operator.email" data-testid="operator-email">{{
                  operator.email
                }}</a>
              } @else {
                <span data-testid="operator-email">{{ operator.email }}</span>
              }
            }
          </address>
          @if (kind() === 'privacy' && operator.privacyNote) {
            <p class="operator__note" data-testid="operator-privacy-note">
              {{ operator.privacyNote }}
            </p>
          }
        } @else {
          <p data-testid="operator-none">{{ 'legal.operator.none' | transloco }}</p>
        }
      </section>
    </mu-page-card>
  `,
  styles: `
    section p {
      margin: var(--mu-space-2) 0 0;
      max-width: 70ch;
    }

    .operator {
      display: flex;
      flex-direction: column;
      align-items: flex-start;
      gap: var(--mu-space-1);
      margin-top: var(--mu-space-2);
      font-style: normal;

      a {
        display: inline-flex;
        align-items: center;
        min-height: var(--mu-touch-adult);
      }
    }

    .operator__address,
    .operator__note {
      white-space: pre-line;
    }
  `,
})
export class Legal {
  private readonly config = inject(AuthService).config;
  protected readonly brand = { brand: BRAND_NAME };
  protected readonly kind = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['kind'] as LegalPageKind)),
    { initialValue: 'privacy' as LegalPageKind },
  );
  protected readonly sections = computed(() => SECTIONS[this.kind()]);
  /** The operator block from `/api/auth/config`, or null for the neutral note. */
  protected readonly operator = computed(() => {
    const legal = this.config()?.legal;
    const operator = {
      name: filled(legal?.operatorName),
      address: filled(legal?.address),
      email: filled(legal?.contactEmail),
      privacyNote: filled(legal?.privacyNote),
    };
    if (!operator.name && !operator.address && !operator.email && !operator.privacyNote) {
      return null;
    }
    return { ...operator, emailLink: !!operator.email && EMAIL.test(operator.email) };
  });
}
