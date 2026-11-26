import { type Page, expect, test } from '@playwright/test';
import { kid, mockFamily } from '../helpers/family';

const MIA = kid();
const NGSW_IDLE_MS = 6_000;
/** The production build: the nginx image (E2E_BASE_URL) or scripts/serve-dist.mjs. */
const DIST_URL =
  process.env['E2E_BASE_URL'] ?? `http://localhost:${process.env['E2E_DIST_PORT'] ?? 4301}`;

async function openMap(page: Page) {
  await page.goto('/');
  await page.getByTestId(`kid-tile-${MIA.id}`).click();
  await expect(page.getByTestId('trail')).toBeVisible();
}

function cachedUrls(page: Page): Promise<string[]> {
  return page.evaluate(async () => {
    const urls: string[] = [];
    for (const name of await caches.keys()) {
      const cache = await caches.open(name);
      urls.push(...(await cache.keys()).map((request) => new URL(request.url).pathname));
    }
    return urls;
  });
}

/**
 * Waits until the Angular service worker controls the page (it claims open pages) and has
 * cached the whole app shell, which it does in the background after activating.
 */
async function waitForServiceWorker(page: Page) {
  const manifest = (await (await page.request.get('/ngsw.json')).json()) as {
    assetGroups: { name: string; urls: string[] }[];
  };
  const shell = manifest.assetGroups.find((group) => group.name === 'app-shell')!.urls;
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null, undefined, {
    timeout: 30_000,
  });
  await page.waitForFunction(
    async (expected) => {
      const name = (await caches.keys()).find((key) => key.endsWith(':assets:app-shell:cache'));
      if (!name) {
        return false;
      }
      const cached = new Set(
        (await (await caches.open(name)).keys()).map((request) => new URL(request.url).pathname),
      );
      return expected.every((url) => cached.has(url));
    },
    shell,
    { timeout: 45_000, polling: 500 },
  );
}

test.describe('offline screen', () => {
  test('kids see a sleeping Murmeli while offline and the trail again afterwards', async ({
    page,
    context,
  }) => {
    await mockFamily(page, { kids: [MIA] });
    await openMap(page);

    await context.setOffline(true);
    const offline = page.getByTestId('offline-screen');
    await expect(offline).toBeVisible();
    await expect(page.getByTestId('offline-title')).toBeFocused();
    await expect(offline.locator('mu-mascot')).toHaveAttribute('data-pose', 'sleeping');
    await expect(page.getByTestId('trail')).toBeHidden();

    await page.getByTestId('offline-retry').click();
    await expect(offline).toBeVisible();

    await context.setOffline(false);
    await expect(offline).toBeHidden();
    await expect(page.getByTestId('trail')).toBeVisible();
  });

  test('parents keep their page and get a banner instead', async ({ page, context }) => {
    await mockFamily(page, { kids: [MIA], gate: true });
    await page.goto('/parent');
    await expect(page.getByTestId('page-title')).toBeVisible();

    await context.setOffline(true);
    await expect(page.getByTestId('offline-banner')).toBeVisible();
    await expect(page.getByTestId('offline-screen')).toHaveCount(0);
    await expect(page.getByTestId('page-title')).toBeVisible();
  });
});

test.describe('service worker', () => {
  test.use({ serviceWorkers: 'allow', baseURL: DIST_URL });

  test('caches the app shell but never an /api response', async ({ page, context }) => {
    const backend = await mockFamily(context, { kids: [MIA] });
    await page.goto('/');
    await expect(page.getByTestId(`kid-tile-${MIA.id}`)).toBeVisible();
    await waitForServiceWorker(page);
    await page.reload();
    await expect(page.getByTestId(`kid-tile-${MIA.id}`)).toBeVisible();

    const first = await page.evaluate(() => fetch('/api/kids').then((r) => r.json()));
    expect(first).toHaveLength(1);
    backend.on('GET /api/kids', { body: [] });
    const second = await page.evaluate(() => fetch('/api/kids').then((r) => r.json()));
    expect(second).toEqual([]);

    const cached = await cachedUrls(page);
    expect(cached).toContain('/index.html');
    expect(cached.some((path) => /^\/main-[\w-]+\.js$/.test(path))).toBe(true);
    expect(cached.filter((path) => path.startsWith('/api/'))).toEqual([]);

    await context.unrouteAll({ behavior: 'ignoreErrors' });
    await context.setOffline(true);
    const offlineStatus = await page.evaluate(() =>
      fetch('/api/kids').then(
        (r) => r.status,
        () => 0,
      ),
    );
    expect(offlineStatus).not.toBe(200);
  });

  test('starts offline from the cache and shows the offline screen', async ({ page, context }) => {
    await mockFamily(context, { kids: [MIA] });
    await page.goto('/');
    await expect(page.getByTestId(`kid-tile-${MIA.id}`)).toBeVisible();
    await waitForServiceWorker(page);
    // ngsw finishes setting up a new version after 5 s without requests (its idle tasks).
    await page.waitForTimeout(NGSW_IDLE_MS);

    await context.setOffline(true);
    await page.reload();
    await expect(page.getByTestId('offline-screen')).toBeVisible();

    await context.setOffline(false);
    await expect(page.getByTestId(`kid-tile-${MIA.id}`)).toBeVisible({ timeout: 15_000 });
  });

  test('keeps narration clips for the level in the clip cache', async ({ page, context }) => {
    await mockFamily(context, { kids: [MIA], learn: { demoSeen: ['math-zahlenwiese-01'] } });
    await page.goto('/');
    await expect(page.getByTestId(`kid-tile-${MIA.id}`)).toBeVisible();
    await waitForServiceWorker(page);
    await page.reload();
    await page.getByTestId(`kid-tile-${MIA.id}`).click();
    await page.getByTestId('level-math-zahlenwiese-01').click();
    await expect(page.getByTestId('prompt-text')).toBeVisible();

    await expect
      .poll(async () => (await cachedUrls(page)).filter((path) => path.endsWith('.opus')).length)
      .toBeGreaterThan(0);
    expect(await cachedUrls(page)).toContain('/audio/manifest.json');
  });

  test('meets the browser install criteria', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Installability is reported by Chromium');
    await mockFamily(context, { loggedIn: false });
    await page.goto('/');
    await waitForServiceWorker(page);
    const cdp = await context.newCDPSession(page);
    const { installabilityErrors } = (await cdp.send('Page.getInstallabilityErrors')) as {
      installabilityErrors: { errorId: string }[];
    };
    expect(installabilityErrors.map((error) => error.errorId)).toEqual([]);

    const manifest = await page.request.get('/manifest.webmanifest');
    expect(manifest.ok()).toBe(true);
    const ngsw = await page.request.get('/ngsw.json');
    expect(ngsw.ok()).toBe(true);
    expect(((await ngsw.json()) as { dataGroups: { name: string }[] }).dataGroups).toEqual(
      expect.arrayContaining([expect.objectContaining({ name: 'audio-clips' })]),
    );
  });
});
