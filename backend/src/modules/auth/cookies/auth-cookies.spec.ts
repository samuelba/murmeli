import type { ConfigService } from '@nestjs/config';
import type { Request, Response } from 'express';
import type { Env } from '../../../config/env.schema';
import {
  ALL_COOKIES,
  AuthCookies,
  COOKIE_PATHS,
  readCookie,
} from './auth-cookies';

function cookies(secure: boolean, domain?: string): AuthCookies {
  const values: Record<string, unknown> = {
    COOKIE_SECURE: secure,
    COOKIE_DOMAIN: domain,
  };
  return new AuthCookies({
    get: (key: string) => values[key],
  } as unknown as ConfigService<Env, true>);
}

function response() {
  return { cookie: jest.fn(), clearCookie: jest.fn() };
}

describe('COOKIE_PATHS', () => {
  it('scopes every cookie as the contract says', () => {
    expect(COOKIE_PATHS).toEqual({
      mu_at: '/api',
      mu_rt: '/api/auth',
      mu_totp: '/api/auth/totp',
      mu_pg: '/api',
      mu_kid: '/api',
    });
    expect(ALL_COOKIES).toHaveLength(5);
  });
});

describe('readCookie', () => {
  it.each([
    [{ mu_at: 'token' }, 'token'],
    [{ mu_at: '' }, undefined],
    [{ mu_at: 42 }, undefined],
    [undefined, undefined],
  ])('reads %p as %p', (jar, expected) => {
    expect(readCookie({ cookies: jar } as unknown as Request, 'mu_at')).toBe(
      expected,
    );
  });
});

describe('AuthCookies', () => {
  it('sets httpOnly, SameSite=Strict cookies with a max age', () => {
    const res = response();
    const expiresAt = new Date(Date.now() + 60_000);

    cookies(true).set(res as unknown as Response, 'mu_rt', 'value', expiresAt);

    const [name, value, options] = res.cookie.mock.calls[0] as [
      string,
      string,
      Record<string, unknown>,
    ];
    expect([name, value]).toEqual(['mu_rt', 'value']);
    expect(options).toMatchObject({
      httpOnly: true,
      secure: true,
      sameSite: 'strict',
      path: '/api/auth',
    });
    expect(options.maxAge).toBeGreaterThan(55_000);
    expect(options).not.toHaveProperty('domain');
  });

  it('never uses a negative max age', () => {
    const res = response();

    cookies(false).set(
      res as unknown as Response,
      'mu_at',
      'v',
      new Date(Date.now() - 1000),
    );

    expect(res.cookie.mock.calls[0][2]).toMatchObject({
      maxAge: 0,
      secure: false,
    });
  });

  it('adds the domain when COOKIE_DOMAIN is set', () => {
    expect(cookies(true, 'example.com').options('mu_pg')).toMatchObject({
      domain: 'example.com',
      path: '/api',
    });
  });

  it('clears cookies with their own path', () => {
    const res = response();

    cookies(true).clear(res as unknown as Response, 'mu_totp');

    expect(res.clearCookie).toHaveBeenCalledWith(
      'mu_totp',
      expect.objectContaining({ path: '/api/auth/totp', httpOnly: true }),
    );
  });

  it('clears every mu_* cookie', () => {
    const res = response();

    cookies(true).clearAll(res as unknown as Response);

    expect(
      res.clearCookie.mock.calls.map(([name]) => name as string).sort(),
    ).toEqual([...ALL_COOKIES].sort());
  });
});
