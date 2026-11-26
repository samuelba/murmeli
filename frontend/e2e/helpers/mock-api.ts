import { type Page, type Request, type Route } from '@playwright/test';

export interface MockResponse {
  status?: number;
  body?: unknown;
}

const json = (route: Route, { status = 200, body = {} }: MockResponse) =>
  route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });

/**
 * Runs the SPA without a backend: every /api call is answered here. Unknown endpoints
 * return 404 so a test never silently depends on a live server.
 */
export async function mockApi(page: Page, handlers: Record<string, MockResponse> = {}) {
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    const handler = handlers[`${route.request().method()} ${path}`];
    await json(route, handler ?? { status: 404, body: { message: 'Not mocked' } });
  });
}

export async function mockHealthyBackend(page: Page) {
  await mockApi(page, { 'GET /api/health': { body: { status: 'ok' } } });
}

/** Collects every request that leaves the app origin (fonts, CDNs, trackers...). */
export function trackExternalRequests(page: Page, appOrigin: string): Request[] {
  const external: Request[] = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (!['data:', 'blob:'].includes(url.protocol) && url.origin !== appOrigin) {
      external.push(request);
    }
  });
  return external;
}
