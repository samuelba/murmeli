import { DOCUMENT, DestroyRef, Injectable, inject, signal } from '@angular/core';
import { PAGE_RELOAD } from './page-reload';

/** Kept warm so the offline screen has its picture even before the service worker runs. */
export const OFFLINE_PICTURE = '/brand/mascot/sleeping.svg';

/**
 * Online or not, from the browser (`navigator.onLine` and its events). An app that started
 * offline has no session yet, so it reloads once the connection is back.
 */
@Injectable({ providedIn: 'root' })
export class NetworkStatus {
  private readonly window = inject(DOCUMENT).defaultView;
  private readonly reload = inject(PAGE_RELOAD);
  private readonly startedOffline = !this.browserOnline();
  private readonly onlineState = signal(!this.startedOffline);

  readonly online = this.onlineState.asReadonly();

  constructor() {
    if (!this.startedOffline && this.window && 'Image' in this.window) {
      new this.window.Image().src = OFFLINE_PICTURE;
    }
    const update = () => this.recheck();
    this.window?.addEventListener('online', update);
    this.window?.addEventListener('offline', update);
    inject(DestroyRef).onDestroy(() => {
      this.window?.removeEventListener('online', update);
      this.window?.removeEventListener('offline', update);
    });
  }

  recheck(): boolean {
    const online = this.browserOnline();
    this.onlineState.set(online);
    if (online && this.startedOffline) {
      this.reload();
    }
    return online;
  }

  private browserOnline(): boolean {
    return this.window?.navigator.onLine ?? true;
  }
}
