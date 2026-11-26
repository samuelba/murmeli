import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page/placeholder-page';

@Component({
  selector: 'mu-not-found',
  imports: [PlaceholderPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mu-placeholder-page titleKey="notFound.title" messageKey="notFound.message" />`,
})
export class NotFound {}
