import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['E2E_PORT'] ?? 4300);
const baseURL = process.env['E2E_BASE_URL'] ?? `http://localhost:${port}`;
const isCI = !!process.env['CI'];
const distPort = Number(process.env['E2E_DIST_PORT'] ?? 4301);
const distURL = `http://127.0.0.1:${distPort}`;

export default defineConfig({
  // @murmeli/content is a symlinked ESM package: load it as is, never transpile it.
  build: { external: ['**/content/dist/**'] },
  testDir: './e2e/specs',
  outputDir: './e2e-results',
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  workers: isCI ? 2 : undefined,
  reporter: isCI
    ? [['html', { open: 'never' }], ['github']]
    : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL,
    locale: 'de-CH',
    // page.route cannot see requests a service worker answers; pwa.spec.ts turns it back on.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
    { name: 'phone', use: { ...devices['Pixel 7'] } },
  ],

  webServer: process.env['E2E_BASE_URL']
    ? undefined
    : [
        {
          command: `npx ng serve --configuration production --port ${port} --no-live-reload --no-hmr`,
          url: baseURL,
          reuseExistingServer: !isCI,
          timeout: 120_000,
        },
        // The service worker only works with the real build (the dev server's index.html does
        // not match the hashes in ngsw.json), so pwa.spec.ts runs against it.
        {
          command: `npx ng build && node scripts/serve-dist.mjs --port ${distPort}`,
          url: `${distURL}/healthz`,
          reuseExistingServer: !isCI,
          timeout: 300_000,
        },
      ],
});
