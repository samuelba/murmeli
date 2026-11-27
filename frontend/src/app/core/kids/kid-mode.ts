import { Location } from '@angular/common';
import { Injectable, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router } from '@angular/router';
import { filter, map } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import { isParentUrl } from '../pwa/app-updates';

/** A kid is in front of the screen: a profile is active and no grown-up page is open. */
@Injectable({ providedIn: 'root' })
export class KidMode {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: inject(Location).path() || '/' },
  );

  readonly kid = computed(() => (isParentUrl(this.url()) ? null : this.auth.activeKid()));
  readonly active = computed(() => this.kid() !== null);
}
