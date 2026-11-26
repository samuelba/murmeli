import { type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join, normalize } from 'node:path';

const FIXTURES = join(__dirname, '..', 'fixtures', 'audio');

/** Serves e2e/fixtures/audio (a tiny manifest and three de-CH clips) under /audio. */
export async function routeAudio(page: Page): Promise<string[]> {
  const played: string[] = [];
  await page.route('**/audio/**', async (route) => {
    const path = normalize(new URL(route.request().url()).pathname.replace(/^\/audio\//, ''));
    if (path.startsWith('..')) {
      await route.fulfill({ status: 404 });
      return;
    }
    try {
      const body = await readFile(join(FIXTURES, path));
      if (path.endsWith('.opus')) {
        played.push(path);
      }
      await route.fulfill({
        status: 200,
        body,
        contentType: path.endsWith('.json') ? 'application/json' : 'audio/ogg',
      });
    } catch {
      await route.fulfill({ status: 404 });
    }
  });
  return played;
}
