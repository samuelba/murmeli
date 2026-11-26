import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NavigationEnd, Router } from '@angular/router';
import { SwUpdate, VersionEvent } from '@angular/service-worker';
import { Subject } from 'rxjs';
import { byTestId, provideAppTesting, renderComponent } from '../../../testing/app-testing';
import { resetDocumentState } from '../../../testing/browser';
import { OfflineScreen } from '../../shared/offline/offline-screen';
import { AppUpdates, UPDATE_CHECK_INTERVAL_MS, isParentUrl, isPickerUrl } from './app-updates';
import { NetworkStatus } from './network-status';
import { PAGE_RELOAD } from './page-reload';

function setOnline(online: boolean): void {
  vi.spyOn(window.navigator, 'onLine', 'get').mockReturnValue(online);
}

describe('url areas', () => {
  it('tells parent pages and the profile picker apart', () => {
    expect(isParentUrl('/parent')).toBe(true);
    expect(isParentUrl('/parent/kids/1/progress')).toBe(true);
    expect(isParentUrl('/admin?x=1')).toBe(true);
    expect(isParentUrl('/parents')).toBe(false);
    expect(isParentUrl('/learn')).toBe(false);
    expect(isPickerUrl('/')).toBe(true);
    expect(isPickerUrl('/?returnUrl=x')).toBe(true);
    expect(isPickerUrl('/learn')).toBe(false);
  });
});

describe('AppUpdates', () => {
  let versionUpdates: Subject<VersionEvent>;
  let unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
  let events: Subject<unknown>;
  let sw: {
    isEnabled: boolean;
    versionUpdates: Subject<VersionEvent>;
    unrecoverable: Subject<{ type: 'UNRECOVERABLE_STATE'; reason: string }>;
    activateUpdate: ReturnType<typeof vi.fn>;
    checkForUpdate: ReturnType<typeof vi.fn>;
  };
  let snackBar: { open: ReturnType<typeof vi.fn> };
  let action: Subject<void>;
  let reload: ReturnType<typeof vi.fn>;
  let url: string;

  function setup(enabled = true) {
    versionUpdates = new Subject();
    unrecoverable = new Subject();
    events = new Subject();
    action = new Subject();
    reload = vi.fn();
    url = '/learn';
    sw = {
      isEnabled: enabled,
      versionUpdates,
      unrecoverable,
      activateUpdate: vi.fn().mockResolvedValue(true),
      checkForUpdate: vi.fn().mockResolvedValue(false),
    };
    snackBar = { open: vi.fn().mockReturnValue({ onAction: () => action }) };
    TestBed.configureTestingModule({
      providers: [
        ...provideAppTesting(),
        { provide: SwUpdate, useValue: sw },
        { provide: MatSnackBar, useValue: snackBar },
        { provide: PAGE_RELOAD, useValue: reload },
      ],
    });
    const router = TestBed.inject(Router);
    vi.spyOn(router, 'url', 'get').mockImplementation(() => url);
    Object.defineProperty(router, 'events', { value: events });
    return TestBed.inject(AppUpdates);
  }

  function navigate(to: string) {
    url = to;
    events.next(new NavigationEnd(1, to, to));
  }

  const ready = (): VersionEvent => ({
    type: 'VERSION_READY',
    currentVersion: { hash: 'a' },
    latestVersion: { hash: 'b' },
  });

  afterEach(() => {
    vi.useRealTimers();
    resetDocumentState();
  });

  it('never interrupts kids and applies the update at the profile picker', async () => {
    const updates = setup();
    updates.start();
    updates.start();
    versionUpdates.next({ type: 'VERSION_DETECTED', version: { hash: 'b' } });
    expect(updates.ready()).toBe(false);
    versionUpdates.next(ready());
    expect(updates.ready()).toBe(true);
    navigate('/learn/level/l1');
    await Promise.resolve();
    expect(snackBar.open).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();

    navigate('/');
    await vi.waitFor(() => expect(reload).toHaveBeenCalledTimes(1));
    expect(sw.activateUpdate).toHaveBeenCalled();
  });

  it('offers a reload once in the parent area', async () => {
    const updates = setup();
    updates.start();
    url = '/parent';
    versionUpdates.next(ready());
    await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalledTimes(1));
    expect(snackBar.open).toHaveBeenCalledWith(
      'Eine neue Version ist da.',
      'Neu laden',
      expect.objectContaining({ politeness: 'polite' }),
    );
    navigate('/admin/users');
    await Promise.resolve();
    expect(snackBar.open).toHaveBeenCalledTimes(1);

    action.next();
    await vi.waitFor(() => expect(reload).toHaveBeenCalled());
  });

  it('offers it when a parent page is opened later, and after a broken worker state', async () => {
    const updates = setup();
    updates.start();
    unrecoverable.next({ type: 'UNRECOVERABLE_STATE', reason: 'x' });
    expect(snackBar.open).not.toHaveBeenCalled();
    navigate('/parent/account');
    await vi.waitFor(() => expect(snackBar.open).toHaveBeenCalledTimes(1));
  });

  it('still reloads when activating fails', async () => {
    const updates = setup();
    sw.activateUpdate.mockRejectedValue(new Error('gone'));
    await updates.apply();
    expect(reload).toHaveBeenCalled();
  });

  it('checks for updates every hour', () => {
    vi.useFakeTimers();
    const updates = setup();
    updates.start();
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(1);
    sw.checkForUpdate.mockRejectedValue(new Error('offline'));
    vi.advanceTimersByTime(UPDATE_CHECK_INTERVAL_MS);
    expect(sw.checkForUpdate).toHaveBeenCalledTimes(2);
  });

  it('does nothing without a service worker', () => {
    const updates = setup(false);
    updates.start();
    versionUpdates.next(ready());
    expect(updates.ready()).toBe(false);
  });
});

describe('NetworkStatus and the offline screen', () => {
  let reload: ReturnType<typeof vi.fn>;

  function setup(online: boolean) {
    setOnline(online);
    reload = vi.fn();
    TestBed.configureTestingModule({
      providers: [...provideAppTesting(), { provide: PAGE_RELOAD, useValue: reload }],
    });
    return TestBed.inject(NetworkStatus);
  }

  afterEach(() => resetDocumentState());

  it('follows the browser online and offline events', () => {
    const network = setup(true);
    expect(network.online()).toBe(true);
    setOnline(false);
    window.dispatchEvent(new Event('offline'));
    expect(network.online()).toBe(false);
    setOnline(true);
    window.dispatchEvent(new Event('online'));
    expect(network.online()).toBe(true);
    expect(reload).not.toHaveBeenCalled();
  });

  it('reloads an app that started offline once the connection is back', () => {
    const network = setup(false);
    expect(network.online()).toBe(false);
    expect(network.recheck()).toBe(false);
    expect(reload).not.toHaveBeenCalled();
    setOnline(true);
    expect(network.recheck()).toBe(true);
    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('shows a sleeping Murmeli with a spoken title and a retry', async () => {
    const network = setup(false);
    const recheck = vi.spyOn(network, 'recheck');
    const { element, fixture } = await renderComponent(OfflineScreen);
    await fixture.whenStable();
    expect(element.querySelector('mu-mascot')?.getAttribute('data-pose')).toBe('sleeping');
    expect(byTestId(element, 'offline-title').textContent?.trim()).toBe(
      'Murmeli macht ein Nickerchen, bis das Internet wieder da ist.',
    );
    expect(element.classList).toContain('mu-kid-mode');
    byTestId(element, 'offline-retry').click();
    expect(recheck).toHaveBeenCalled();
  });
});
