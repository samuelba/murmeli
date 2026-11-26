import { DestroyRef, Injectable, Injector, inject, signal } from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate } from '@angular/service-worker';
import { TranslocoService } from '@jsverse/transloco';
import { filter } from 'rxjs';
import { PAGE_RELOAD } from './page-reload';

export const UPDATE_CHECK_INTERVAL_MS = 60 * 60_000;

/** Parent and admin pages may offer a reload; kids are never interrupted. */
export function isParentUrl(url: string): boolean {
  return /^\/(?:parent|admin)(?:[/?#]|$)/.test(url);
}

/** The profile picker (or the welcome page): nobody is in the middle of anything here. */
export function isPickerUrl(url: string): boolean {
  return /^\/(?:[?#]|$)/.test(url);
}

/**
 * New app versions from the service worker. In the parent area a snackbar offers to reload;
 * everywhere else the update waits and is applied on the next visit to the profile picker.
 */
@Injectable({ providedIn: 'root' })
export class AppUpdates {
  private readonly updates = inject(SwUpdate, { optional: true });
  private readonly router = inject(Router);
  private readonly injector = inject(Injector);
  private readonly transloco = inject(TranslocoService);
  private readonly reload = inject(PAGE_RELOAD);
  private readonly destroyRef = inject(DestroyRef);
  private started = false;
  private offered = false;

  readonly ready = signal(false);

  start(): void {
    const updates = this.updates;
    if (this.started || !updates?.isEnabled) {
      return;
    }
    this.started = true;
    const subscriptions = [
      updates.versionUpdates
        .pipe(filter((event) => event.type === 'VERSION_READY'))
        .subscribe(() => this.markReady()),
      updates.unrecoverable.subscribe(() => this.markReady()),
      this.router.events
        .pipe(filter((event) => event instanceof NavigationEnd))
        .subscribe((event) => this.onNavigation(event.urlAfterRedirects)),
    ];
    const timer = setInterval(
      () => void updates.checkForUpdate().catch(() => false),
      UPDATE_CHECK_INTERVAL_MS,
    );
    this.destroyRef.onDestroy(() => {
      clearInterval(timer);
      subscriptions.forEach((subscription) => subscription.unsubscribe());
    });
  }

  async apply(): Promise<void> {
    try {
      await this.updates?.activateUpdate();
    } catch {
      // A broken or missing update still ends in a reload, which fetches the current version.
    }
    this.reload();
  }

  private markReady(): void {
    this.ready.set(true);
    this.offer(this.router.url);
  }

  private onNavigation(url: string): void {
    if (!this.ready()) {
      return;
    }
    if (isPickerUrl(url)) {
      void this.apply();
    } else {
      this.offer(url);
    }
  }

  private offer(url: string): void {
    if (this.offered || !isParentUrl(url)) {
      return;
    }
    this.offered = true;
    void this.showSnackBar();
  }

  /** Loaded on demand so the snackbar code stays out of the first download. */
  private async showSnackBar(): Promise<void> {
    const { MatSnackBar } = await import('@angular/material/snack-bar');
    const ref = this.injector
      .get(MatSnackBar)
      .open(this.transloco.translate('pwa.updateReady'), this.transloco.translate('pwa.reload'), {
        politeness: 'polite',
        panelClass: 'mu-update-snackbar',
      });
    ref.onAction().subscribe(() => void this.apply());
  }
}
