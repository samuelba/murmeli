import { Injectable, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslocoService } from '@jsverse/transloco';

@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly transloco = inject(TranslocoService);

  constructor() {
    super();
    this.transloco.events$.pipe(takeUntilDestroyed()).subscribe((event) => {
      if (event.type === 'translationLoadSuccess' || event.type === 'langChanged') {
        this.translate();
      }
    });
    this.translate();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return this.transloco.translate('paginator.empty');
    }
    const start = page * pageSize + 1;
    const end = Math.min(length, (page + 1) * pageSize);
    return this.transloco.translate('paginator.range', { start, end, length });
  };

  private translate(): void {
    this.itemsPerPageLabel = this.transloco.translate('paginator.itemsPerPage');
    this.nextPageLabel = this.transloco.translate('paginator.next');
    this.previousPageLabel = this.transloco.translate('paginator.previous');
    this.firstPageLabel = this.transloco.translate('paginator.first');
    this.lastPageLabel = this.transloco.translate('paginator.last');
    this.changes.next();
  }
}
