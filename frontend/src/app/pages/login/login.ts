import { ChangeDetectionStrategy, Component } from '@angular/core';
import { PlaceholderPage } from '../../shared/placeholder-page/placeholder-page';

@Component({
  selector: 'mu-login',
  imports: [PlaceholderPage],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<mu-placeholder-page titleKey="login.title" />`,
})
export class Login {}
