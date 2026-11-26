import type { Request } from 'express';
import { USER_AGENT_MAX_LENGTH, requestMeta } from './request-meta';

const request = (ip: string | undefined, userAgent?: unknown) =>
  ({ ip, headers: { 'user-agent': userAgent } }) as unknown as Request;

describe('requestMeta', () => {
  it('returns the ip and user agent', () => {
    expect(requestMeta(request('203.0.113.7', 'Firefox'))).toEqual({
      ip: '203.0.113.7',
      userAgent: 'Firefox',
    });
  });

  it('truncates long user agents', () => {
    const meta = requestMeta(request('::1', 'x'.repeat(500)));

    expect(meta.userAgent).toHaveLength(USER_AGENT_MAX_LENGTH);
  });

  it('uses null for missing values', () => {
    expect(requestMeta(request(undefined, ''))).toEqual({
      ip: null,
      userAgent: null,
    });
    expect(requestMeta(request(undefined)).userAgent).toBeNull();
  });
});
