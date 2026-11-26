import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { Env } from '../../config/env.schema';
import { SameOriginGuard } from './same-origin.guard';

const APP_URL = 'https://murmeli.example.com';

function guard(corsOrigins: string[] = []): SameOriginGuard {
  const values: Record<string, unknown> = {
    APP_URL,
    CORS_ORIGINS: corsOrigins,
  };
  return new SameOriginGuard({
    get: (key: string) => values[key],
  } as unknown as ConfigService<Env, true>);
}

function http(
  method: string,
  headers: Record<string, string> = {},
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({ getRequest: () => ({ method, headers }) }),
  } as unknown as ExecutionContext;
}

describe('SameOriginGuard', () => {
  it.each(['GET', 'HEAD', 'OPTIONS', 'get'])(
    'lets safe %s requests through even cross-site',
    (method) => {
      expect(
        guard().canActivate(
          http(method, {
            'sec-fetch-site': 'cross-site',
            origin: 'https://evil.example.com',
          }),
        ),
      ).toBe(true);
    },
  );

  it('ignores non-HTTP contexts', () => {
    const context = { getType: () => 'rpc' } as unknown as ExecutionContext;
    expect(guard().canActivate(context)).toBe(true);
  });

  describe.each(['POST', 'PUT', 'PATCH', 'DELETE'])('%s', (method) => {
    it.each([
      ['a same-origin request', { 'sec-fetch-site': 'same-origin' }],
      ['a direct navigation', { 'sec-fetch-site': 'none' }],
      ['a non-browser client', {}],
      ['the app origin without Sec-Fetch-Site', { origin: APP_URL }],
      [
        'a same-site request from the app origin',
        { 'sec-fetch-site': 'same-site', origin: APP_URL },
      ],
    ])('allows %s', (_label, headers) => {
      expect(guard().canActivate(http(method, headers))).toBe(true);
    });

    it.each([
      [
        'a cross-site request',
        { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example.com' },
      ],
      [
        'a same-site sibling',
        { 'sec-fetch-site': 'same-site', origin: 'https://blog.example.com' },
      ],
      ['a foreign Origin', { origin: 'https://evil.example.com' }],
      [
        'a cross-site request without Origin',
        { 'sec-fetch-site': 'cross-site' },
      ],
    ])('rejects %s', (_label, headers) => {
      expect(() => guard().canActivate(http(method, headers))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('allows origins from CORS_ORIGINS', () => {
    expect(
      guard(['http://localhost:4200']).canActivate(
        http('POST', {
          'sec-fetch-site': 'cross-site',
          origin: 'http://localhost:4200',
        }),
      ),
    ).toBe(true);
  });
});
