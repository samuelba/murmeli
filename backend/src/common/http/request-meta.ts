import type { Request } from 'express';

export const USER_AGENT_MAX_LENGTH = 200;

export interface RequestMeta {
  readonly ip: string | null;
  readonly userAgent: string | null;
}

export function requestMeta(request: Request): RequestMeta {
  const userAgent = request.headers['user-agent'];
  return {
    ip: request.ip ?? null,
    userAgent:
      typeof userAgent === 'string' && userAgent !== ''
        ? userAgent.slice(0, USER_AGENT_MAX_LENGTH)
        : null,
  };
}
