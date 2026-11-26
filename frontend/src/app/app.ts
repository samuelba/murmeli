import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { filter, map } from 'rxjs';
import { AppUpdates, isParentUrl } from './core/pwa/app-updates';
import { NetworkStatus } from './core/pwa/network-status';
import { ThemeService } from './core/theme/theme.service';
import { TopBar } from './layout/top-bar/top-bar';
import { OfflineScreen } from './shared/offline/offline-screen';

@Component({
  selector: 'mu-root',
  imports: [RouterOutlet, RouterLink, TranslocoPipe, TopBar, OfflineScreen],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly router = inject(Router);
  private readonly network = inject(NetworkStatus);
  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );
  private readonly parentArea = computed(() => isParentUrl(this.url()));

  protected readonly offlineBanner = computed(() => !this.network.online() && this.parentArea());
  protected readonly offlineScreen = computed(() => !this.network.online() && !this.parentArea());

  constructor() {
    inject(ThemeService);
    inject(AppUpdates).start();
  }

  protected skipToMain(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }
}
