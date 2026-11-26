import type { NestExpressApplication } from '@nestjs/platform-express';
import request from 'supertest';
import type TestAgent from 'supertest/lib/agent';

let ipCounter = Math.floor(Math.random() * 0xffffff);

export type Agent = TestAgent;

/**
 * A cookie-keeping browser stand-in with its own client IP, so the per-IP
 * rate limits of one test do not affect another.
 */
export function newClient(app: NestExpressApplication): Agent {
  ipCounter = (ipCounter + 1) % 0xffffff;
  const ip = `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
  return request.agent(app.getHttpServer()).set('X-Forwarded-For', ip);
}

interface CookieJarLike {
  setCookie(cookie: string, domain: string, path: string): void;
}

/**
 * Replaces a cookie in the agent's jar, e.g. to present a crafted token.
 */
export function putCookie(agent: Agent, name: string, value: string): void {
  (agent as unknown as { jar: CookieJarLike }).jar.setCookie(
    `${name}=${value}; Path=/api`,
    '127.0.0.1',
    '/',
  );
}

export function jwtClaims(token: string): Record<string, unknown> {
  return JSON.parse(
    Buffer.from(token.split('.')[1], 'base64url').toString('utf8'),
  ) as Record<string, unknown>;
}

export function uniqueEmail(prefix = 'parent'): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${Date.now()}-${suffix}@example.com`;
}

function setCookies(response: request.Response): string[] {
  const header = response.headers['set-cookie'] as unknown;
  return Array.isArray(header) ? (header as string[]) : [];
}

export function cookieLine(
  response: request.Response,
  name: string,
): string | undefined {
  return setCookies(response).find((line) => line.startsWith(`${name}=`));
}

/**
 * @returns the value the response set, '' when it cleared the cookie, or
 * undefined when the response did not touch it
 */
export function cookieValue(
  response: request.Response,
  name: string,
): string | undefined {
  const line = cookieLine(response, name);
  return line === undefined
    ? undefined
    : decodeURIComponent(line.slice(name.length + 1).split(';')[0]);
}

export function withoutRequestId(body: unknown): unknown {
  if (typeof body !== 'object' || body === null) {
    return body;
  }
  const { requestId: _requestId, ...rest } = body as Record<string, unknown>;
  return rest;
}
