import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { AuthService } from '../../core/auth/auth.service';
import { BRAND_NAME } from '../../core/brand';
import { Logo } from '../../shared/logo/logo';

@Component({
  selector: 'mu-welcome',
  imports: [RouterLink, TranslocoPipe, Logo],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './welcome.html',
  styleUrl: './welcome.scss',
})
export class Welcome {
  protected readonly brand = { brand: BRAND_NAME };
  protected readonly config = inject(AuthService).config;
}
