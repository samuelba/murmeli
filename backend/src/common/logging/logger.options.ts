import { randomUUID } from 'node:crypto';
import type { IncomingMessage, ServerResponse } from 'node:http';
import type { Params } from 'nestjs-pino';
import type { Env } from '../../config/env.schema';

export const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[\w.-]{1,128}$/;

const SENSITIVE_FIELDS = [
  'password',
  'currentPassword',
  'newPassword',
  'token',
  'accessToken',
  'refreshToken',
  'secret',
  'totpCode',
  'recoveryCode',
  'pin',
];

export const REDACTED_PATHS: readonly string[] = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers.referer',
  'req.headers["proxy-authorization"]',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  ...SENSITIVE_FIELDS.flatMap((field) => [field, `*.${field}`, `*.*.${field}`]),
];

export function resolveRequestId(
  req: IncomingMessage,
  res: ServerResponse,
): string {
  const incoming = req.headers[REQUEST_ID_HEADER];
  const requestId =
    typeof incoming === 'string' && VALID_REQUEST_ID.test(incoming)
      ? incoming
      : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, requestId);
  return requestId;
}

export function stripQuery(url: string | undefined): string | undefined {
  return url?.split('?', 1)[0];
}

export interface SerializedRequest {
  readonly url?: string;
  readonly query?: unknown;
  readonly [key: string]: unknown;
}

/**
 * Query strings can carry tokens (e.g. email verification links), so they are
 * never logged.
 */
export function serializeRequest(req: SerializedRequest): SerializedRequest {
  const { query: _query, ...rest } = req;
  return { ...rest, url: stripQuery(req.url) };
}

const HEALTH_PATH = /^\/api\/health(\/|$|\?)/;

export function buildLoggerOptions(
  env: Pick<Env, 'NODE_ENV' | 'LOG_LEVEL'>,
): Params {
  const isProduction = env.NODE_ENV === 'production';
  return {
    pinoHttp: {
      level: env.LOG_LEVEL,
      genReqId: resolveRequestId,
      redact: { paths: [...REDACTED_PATHS], censor: '[redacted]' },
      serializers: { req: serializeRequest },
      autoLogging: {
        ignore: (req) => HEALTH_PATH.test(req.url ?? ''),
      },
      transport: isProduction
        ? undefined
        : {
            target: 'pino-pretty',
            options: { singleLine: true, translateTime: 'SYS:HH:MM:ss.l' },
          },
    },
  };
}
