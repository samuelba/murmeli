import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page/placeholder-page';

@Component({
  selector: 'mu-register',
  imports: [PlaceholderPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mu-placeholder-page titleKey="register.title" />`,
})
export class Register {}
