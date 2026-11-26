import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // @murmeli/content is a symlinked ESM package: load it as is, never transpile it.
  build: { external: ['**/content/dist/**'] },
  testDir: './shots',
  outputDir: '../e2e-results/shots',
  reporter: [['list']],
  use: { baseURL: 'http://localhost:4300', locale: 'de-CH' },
  projects: [
    { name: 'phone', use: { ...devices['Pixel 7'] } },
    { name: 'tablet', use: { ...devices['iPad (gen 7)'], browserName: 'chromium' } },
  ],
});
