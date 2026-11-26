import { type BrowserContext, type Page, type Request, type Route } from '@playwright/test';

/** A page, or a whole context (which also sees the requests a service worker makes). */
export type RouteTarget = Pick<Page | BrowserContext, 'route'>;
import { createChallenge } from 'altcha-lib';
import { deriveKey } from 'altcha-lib/algorithms/pbkdf2';

export interface MockResponse {
  status?: number;
  body?: unknown;
  headers?: Record<string, string>;
}

export interface MockRequest {
  readonly method: string;
  readonly path: string;
  readonly url: URL;
  readonly params: Readonly<Record<string, string>>;
  readonly body: unknown;
}

export type MockHandler =
  MockResponse | ((request: MockRequest) => MockResponse | Promise<MockResponse>);

export interface RecordedCall {
  readonly method: string;
  readonly path: string;
  readonly body: unknown;
}

interface Entry {
  readonly method: string;
  readonly pattern: RegExp;
  readonly names: readonly string[];
  readonly handler: MockHandler;
}

function compile(key: string): Omit<Entry, 'handler'> {
  const [method, path] = key.split(' ');
  const names: string[] = [];
  const source = path.replace(/:(\w+)/g, (_, name: string) => {
    names.push(name);
    return '([^/]+)';
  });
  return { method, pattern: new RegExp(`^${source}$`), names };
}

function parseBody(request: Request): unknown {
  const raw = request.postData();
  if (!raw) {
    return undefined;
  }
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return raw;
  }
}

async function fulfill(route: Route, { status = 200, body, headers }: MockResponse) {
  if (status === 204 || body === undefined) {
    await route.fulfill({ status, headers, body: '' });
    return;
  }
  await route.fulfill({
    status,
    headers,
    contentType: 'application/json',
    body: JSON.stringify(body),
  });
}

export function apiError(status: number, errorCode: string, headers?: Record<string, string>) {
  return { status, headers, body: { statusCode: status, errorCode, message: errorCode } };
}

/**
 * Runs the SPA without a backend: every /api call is answered here. Later registrations win,
 * so tests can override a default. Unknown endpoints return 404 so a test never silently
 * depends on a live server.
 */
export class MockBackend {
  readonly calls: RecordedCall[] = [];
  private readonly entries: Entry[] = [];

  constructor(handlers: Record<string, MockHandler> = {}) {
    this.onAll(handlers);
  }

  on(key: string, handler: MockHandler): this {
    this.entries.unshift({ ...compile(key), handler });
    return this;
  }

  onAll(handlers: Record<string, MockHandler>): this {
    Object.entries(handlers).forEach(([key, handler]) => this.on(key, handler));
    return this;
  }

  callsTo(method: string, path: string): RecordedCall[] {
    return this.calls.filter((call) => call.method === method && call.path === path);
  }

  async install(page: RouteTarget): Promise<this> {
    await page.route('**/api/**', async (route) => {
      const request = route.request();
      const url = new URL(request.url());
      const method = request.method();
      const body = parseBody(request);
      this.calls.push({ method, path: url.pathname, body });
      for (const entry of this.entries) {
        const match = entry.method === method ? entry.pattern.exec(url.pathname) : null;
        if (match) {
          const params = Object.fromEntries(entry.names.map((name, i) => [name, match[i + 1]]));
          const handler = entry.handler;
          const response =
            typeof handler === 'function'
              ? await handler({ method, path: url.pathname, url, params, body })
              : handler;
          await fulfill(route, response);
          return;
        }
      }
      await fulfill(route, {
        status: 404,
        body: { errorCode: 'NOT_FOUND', message: 'Not mocked' },
      });
    });
    return this;
  }
}

export async function mockApi(page: Page, handlers: Record<string, MockHandler> = {}) {
  return new MockBackend(handlers).install(page);
}

export async function mockHealthyBackend(page: Page) {
  return mockApi(page, {
    'GET /api/health': { body: { status: 'ok' } },
    'GET /api/auth/config': {
      body: { registrationEnabled: true, emailEnabled: true, setupRequired: false },
    },
    'GET /api/auth/me': apiError(401, 'UNAUTHORIZED'),
  });
}

/** A real, low-cost ALTCHA v2 challenge so the widget and its worker run for real. */
export async function altchaChallenge(): Promise<MockResponse> {
  const challenge = await createChallenge({
    algorithm: 'PBKDF2/SHA-256',
    cost: 50,
    deriveKey,
    hmacSignatureSecret: 'e2e-altcha-secret',
    expiresAt: new Date(Date.now() + 10 * 60_000),
  });
  return { body: challenge };
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

/**
 * Console errors, page errors (CSP violations are logged as console errors) and failed
 * non-API responses such as a missing asset. Expected API failures (401 from /auth/me while
 * signed out, a mocked 429...) are part of the flows and are ignored.
 */
export function collectPageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource')) {
      errors.push(message.text());
    }
  });
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (response.status() >= 400 && !url.pathname.startsWith('/api/')) {
      errors.push(`HTTP ${response.status()} ${url.pathname}`);
    }
  });
  return errors;
}
