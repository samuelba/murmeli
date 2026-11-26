import { defineConfig, devices } from '@playwright/test';

const port = Number(process.env['E2E_PORT'] ?? 4300);
const baseURL = process.env['E2E_BASE_URL'] ?? `http://localhost:${port}`;
const isCI = !!process.env['CI'];

export default defineConfig({
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
    : {
        command: `npx ng serve --configuration production --port ${port} --no-live-reload --no-hmr`,
        url: baseURL,
        reuseExistingServer: !isCI,
        timeout: 120_000,
      },
});
