import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Options } from 'pino-http';
import {
  REDACTED_PATHS,
  buildLoggerOptions,
  resolveRequestId,
  maskSecretPath,
  serializeRequest,
  stripQuery,
} from './logger.options';

function exchange(headers: Record<string, string> = {}) {
  const req = { headers } as unknown as IncomingMessage;
  const setHeader = jest.fn();
  const res = { setHeader } as unknown as ServerResponse;
  return { req, res, setHeader };
}

describe('resolveRequestId', () => {
  it('reuses a well-formed incoming id and echoes it', () => {
    const { req, res, setHeader } = exchange({ 'x-request-id': 'abc-123' });

    expect(resolveRequestId(req, res)).toBe('abc-123');
    expect(setHeader).toHaveBeenCalledWith('x-request-id', 'abc-123');
  });

  it.each(['', 'has spaces', 'x'.repeat(129), '<script>'])(
    'replaces the malformed id %p with a UUID',
    (incoming) => {
      const { req, res } = exchange({ 'x-request-id': incoming });

      expect(resolveRequestId(req, res)).toMatch(/^[0-9a-f-]{36}$/);
    },
  );
});

describe('buildLoggerOptions', () => {
  function pinoHttp(nodeEnv: 'production' | 'development'): Options {
    return buildLoggerOptions({ NODE_ENV: nodeEnv, LOG_LEVEL: 'debug' })
      .pinoHttp as Options;
  }

  it('logs JSON in production and pretty output elsewhere', () => {
    expect(pinoHttp('production').transport).toBeUndefined();
    expect(pinoHttp('development').transport).toMatchObject({
      target: 'pino-pretty',
    });
  });

  it('uses the configured level and redacts secrets', () => {
    const options = pinoHttp('production');

    expect(options.level).toBe('debug');
    expect(options.redact).toEqual({
      paths: [...REDACTED_PATHS],
      censor: '[redacted]',
    });
    expect(REDACTED_PATHS).toEqual(
      expect.arrayContaining([
        'req.headers.authorization',
        'req.headers.cookie',
        'req.headers.referer',
        'req.headers["proxy-authorization"]',
        'req.headers["x-csrf-token"]',
        '*.password',
        '*.refreshToken',
      ]),
    );
  });

  it('does not log health probes', () => {
    const autoLogging = pinoHttp('production').autoLogging as {
      ignore: (req: IncomingMessage) => boolean;
    };
    const request = (url?: string) => ({ url }) as IncomingMessage;

    expect(autoLogging.ignore(request('/api/health'))).toBe(true);
    expect(autoLogging.ignore(request('/api/health/ready'))).toBe(true);
    expect(autoLogging.ignore(request('/api/healthy'))).toBe(false);
    expect(autoLogging.ignore(request(undefined))).toBe(false);
  });
});

describe('request serialization', () => {
  it('drops the query string', () => {
    expect(stripQuery('/api/auth/verify?token=secret')).toBe(
      '/api/auth/verify',
    );
    expect(stripQuery(undefined)).toBeUndefined();
  });

  it('logs the path without query values', () => {
    expect(
      serializeRequest({
        method: 'GET',
        url: '/api/invites/x?token=secret',
        query: { token: 'secret' },
      }),
    ).toEqual({ method: 'GET', url: '/api/invites/:token' });
  });

  it('is installed as the req serializer', () => {
    const options = buildLoggerOptions({
      NODE_ENV: 'production',
      LOG_LEVEL: 'info',
    }).pinoHttp as Options;

    expect(options.serializers?.req).toBe(serializeRequest);
  });

  describe('maskSecretPath', () => {
    it.each([
      ['/api/invites/abc_DEF-123', '/api/invites/:token'],
      ['/api/invites/abc/accept', '/api/invites/:token/accept'],
      ['/api/kids/123', '/api/kids/123'],
      [undefined, undefined],
    ])('masks %s', (path, expected) => {
      expect(maskSecretPath(path)).toBe(expected);
    });

    it('drops route params from the logged request', () => {
      expect(
        serializeRequest({
          url: '/api/invites/secret/accept',
          params: { token: 'secret' },
        }),
      ).toEqual({ url: '/api/invites/:token/accept' });
    });
  });
});
