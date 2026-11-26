import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { map } from 'rxjs';
import { BRAND_NAME } from '../../core/brand';
import { Icon } from '../../shared/icon/icon';
import { PageCard } from '../../shared/page-card/page-card';

export type LegalPageKind = 'privacy' | 'terms';

const SECTIONS: Record<LegalPageKind, readonly string[]> = {
  privacy: ['stored', 'kids', 'noPhotos', 'noTrackers', 'cookies', 'rights', 'contact'],
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
    </mu-page-card>
  `,
  styles: `
    section p {
      margin: var(--mu-space-2) 0 0;
      max-width: 70ch;
    }
  `,
})
export class Legal {
  protected readonly brand = { brand: BRAND_NAME };
  protected readonly kind = toSignal(
    inject(ActivatedRoute).data.pipe(map((data) => data['kind'] as LegalPageKind)),
    { initialValue: 'privacy' as LegalPageKind },
  );
  protected readonly sections = computed(() => SECTIONS[this.kind()]);
}
