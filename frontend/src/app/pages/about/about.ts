import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TranslocoPipe } from '@jsverse/transloco';
import { BRAND_NAME } from '../../core/brand';
import { APP_VERSION } from '../../core/version';
import { PageCard } from '../../shared/page-card/page-card';

const SECTIONS = ['what', 'curriculum', 'voices', 'privacy'] as const;

interface Credit {
  readonly key: string;
  readonly license: string;
  readonly href: string | null;
}

const CREDITS: readonly Credit[] = [
  { key: 'pictures', license: 'Apache-2.0', href: '/pictures/LICENSE' },
  { key: 'fonts', license: 'SIL Open Font License 1.1', href: null },
  { key: 'artwork', license: '', href: null },
];

/** `/about`: what the app is, how the voices are made, credits, licenses and the version. */
@Component({
  selector: 'mu-about',
  imports: [TranslocoPipe, PageCard],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <mu-page-card>
      <h1 id="page-heading" class="mu-page-title" data-testid="page-title">
        {{ 'about.title' | transloco: brand }}
      </h1>
      @for (section of sections; track section) {
        <section [attr.data-testid]="'about-' + section">
          <h2 class="mu-section-title">{{ 'about.' + section + '.title' | transloco: brand }}</h2>
          <p>{{ 'about.' + section + '.text' | transloco: brand }}</p>
        </section>
      }
      <section data-testid="about-credits">
        <h2 class="mu-section-title">{{ 'about.credits.title' | transloco }}</h2>
        <ul class="credits">
          @for (credit of credits; track credit.key) {
            <li [attr.data-testid]="'credit-' + credit.key">
              {{ 'about.credits.' + credit.key | transloco: brand }}
              @if (credit.license) {
                ·
                @if (credit.href) {
                  <a [href]="credit.href" target="_blank" rel="noopener">{{ credit.license }}</a>
                } @else {
                  {{ credit.license }}
                }
              }
            </li>
          }
        </ul>
      </section>
      <p class="mu-muted" data-testid="app-version">
        {{ 'about.version' | transloco: { brand: brand.brand, version } }}
      </p>
    </mu-page-card>
  `,
  styles: `
    section p {
      margin: var(--mu-space-2) 0 0;
      max-width: 70ch;
    }

    .credits {
      display: grid;
      gap: var(--mu-space-2);
      margin: var(--mu-space-2) 0 0;
      padding-left: var(--mu-space-5);
      max-width: 70ch;

      a {
        display: inline-flex;
        align-items: center;
        min-height: var(--mu-touch-adult);
      }
    }
  `,
})
export class About {
  protected readonly brand = { brand: BRAND_NAME };
  protected readonly sections = SECTIONS;
  protected readonly credits = CREDITS;
  protected readonly version = APP_VERSION;
}
