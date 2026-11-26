import { DestroyRef, Injectable, inject } from '@angular/core';
import { Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';
import { TranslocoService } from '@jsverse/transloco';
import { BRAND_NAME } from '../brand';

@Injectable({ providedIn: 'root' })
export class TranslatedTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly transloco = inject(TranslocoService);
  private titleKey: string | undefined;

  constructor() {
    super();
    const subscription = this.transloco.events$.subscribe((event) => {
      if (event.type === 'translationLoadSuccess' || event.type === 'langChanged') {
        this.render();
      }
    });
    inject(DestroyRef).onDestroy(() => subscription.unsubscribe());
  }

  override updateTitle(snapshot: RouterStateSnapshot): void {
    this.titleKey = this.buildTitle(snapshot);
    this.render();
  }

  private render(): void {
    const page = this.titleKey ? this.transloco.translate(this.titleKey) : '';
    this.title.setTitle(page && page !== this.titleKey ? `${page} · ${BRAND_NAME}` : BRAND_NAME);
  }
}
