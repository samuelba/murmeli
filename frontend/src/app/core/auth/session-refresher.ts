import { HttpClient, HttpContext } from '@angular/common/http';
import { DOCUMENT, Injectable, inject } from '@angular/core';
import { Observable, finalize, firstValueFrom, from, shareReplay } from 'rxjs';
import { apiUrl } from '../http/api-paths';
import { SKIP_AUTH_REFRESH, quietSession } from '../http/http-context';

export const REFRESH_LOCK = 'mu-refresh';

interface LockManagerLike {
  request<T>(name: string, callback: () => Promise<T>): Promise<T>;
}

/**
 * Single-flight POST /auth/refresh. Concurrent 401s in this tab share one request, and the
 * Web Locks API serializes refreshes across tabs: after waiting for the lock, a quick
 * /auth/me probe shows whether another tab already rotated the cookies.
 */
@Injectable({ providedIn: 'root' })
export class SessionRefresher {
  private readonly http = inject(HttpClient);
  private readonly locks = (inject(DOCUMENT).defaultView?.navigator as { locks?: LockManagerLike })
    ?.locks;
  private pending: Observable<void> | null = null;

  refresh(): Observable<void> {
    this.pending ??= from(this.locked()).pipe(
      finalize(() => (this.pending = null)),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    return this.pending;
  }

  private locked(): Promise<void> {
    const locks = this.locks;
    if (!locks?.request) {
      return this.post();
    }
    return locks.request(REFRESH_LOCK, async () => {
      if (await this.sessionIsValid()) {
        return;
      }
      await this.post();
    });
  }

  private async sessionIsValid(): Promise<boolean> {
    const context: HttpContext = quietSession().set(SKIP_AUTH_REFRESH, true);
    try {
      await firstValueFrom(this.http.get(apiUrl('auth/me'), { context }));
      return true;
    } catch {
      return false;
    }
  }

  private async post(): Promise<void> {
    await firstValueFrom(this.http.post(apiUrl('auth/refresh'), {}));
  }
}
