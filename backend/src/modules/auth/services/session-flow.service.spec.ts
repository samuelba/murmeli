import { HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import { COOKIE_ACCESS, COOKIE_REFRESH } from '../auth.constants';
import { SessionFlowService } from './session-flow.service';

const meta = { ip: '203.0.113.5', userAgent: 'jest' };
const response = {} as Response;

function request(cookies: Record<string, string> = {}): Request {
  return { cookies } as unknown as Request;
}

function setup() {
  const deps = {
    sessions: {
      rotate: jest.fn(),
      findFamily: jest.fn(),
      revokeFamily: jest.fn(),
    },
    issuer: { setSessionCookies: jest.fn() },
    cookies: { clearAll: jest.fn() },
    tokens: { verify: jest.fn().mockReturnValue(null) },
    audit: { record: jest.fn() },
  };
  const service = new SessionFlowService(
    deps.sessions as never,
    deps.issuer as never,
    deps.cookies as never,
    deps.tokens as never,
    deps.audit as never,
  );
  return { service, ...deps };
}

async function errorCode(promise: Promise<unknown>): Promise<unknown> {
  const error = (await promise.catch(
    (caught: unknown) => caught,
  )) as HttpException;
  expect(error.getStatus()).toBe(401);
  return (error.getResponse() as { errorCode: string }).errorCode;
}

describe('SessionFlowService.refresh', () => {
  it('sets new cookies after a rotation', async () => {
    const { service, sessions, issuer, cookies } = setup();
    const rotated = {
      status: 'rotated',
      user: { id: 'u' },
      session: { familyId: 'f' },
    };
    sessions.rotate.mockResolvedValue(rotated);

    await service.refresh(request({ [COOKIE_REFRESH]: 'rt' }), response, meta);

    expect(sessions.rotate).toHaveBeenCalledWith('rt', 'jest');
    expect(issuer.setSessionCookies).toHaveBeenCalledWith(
      response,
      'u',
      rotated.session,
    );
    expect(cookies.clearAll).not.toHaveBeenCalled();
  });

  it('expires the session without a refresh cookie', async () => {
    const { service, sessions, cookies } = setup();

    expect(await errorCode(service.refresh(request(), response, meta))).toBe(
      'SESSION_EXPIRED',
    );
    expect(sessions.rotate).not.toHaveBeenCalled();
    expect(cookies.clearAll).toHaveBeenCalledWith(response);
  });

  it('expires an unknown or revoked token', async () => {
    const { service, sessions, audit } = setup();
    sessions.rotate.mockResolvedValue({ status: 'expired' });

    expect(
      await errorCode(
        service.refresh(request({ [COOKIE_REFRESH]: 'rt' }), response, meta),
      ),
    ).toBe('SESSION_EXPIRED');
    expect(audit.record).not.toHaveBeenCalled();
  });

  it('reports and audits a reused token', async () => {
    const { service, sessions, audit, cookies } = setup();
    sessions.rotate.mockResolvedValue({
      status: 'compromised',
      userId: 'user-1',
    });

    expect(
      await errorCode(
        service.refresh(request({ [COOKIE_REFRESH]: 'rt' }), response, meta),
      ),
    ).toBe('SESSION_COMPROMISED');
    expect(cookies.clearAll).toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith({
      action: 'auth.session_compromised',
      actorId: 'user-1',
      targetType: 'user',
      targetId: 'user-1',
      ip: meta.ip,
    });
  });
});

describe('SessionFlowService.logout', () => {
  it('revokes the family of the refresh token', async () => {
    const { service, sessions, audit, cookies } = setup();
    sessions.findFamily.mockResolvedValue({
      familyId: 'fam-1',
      userId: 'user-1',
    });

    await service.logout(request({ [COOKIE_REFRESH]: 'rt' }), response, meta);

    expect(cookies.clearAll).toHaveBeenCalledWith(response);
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam-1', 'logout');
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'auth.logout', actorId: 'user-1' }),
    );
  });

  it('falls back to the access token', async () => {
    const { service, sessions, tokens } = setup();
    sessions.findFamily.mockResolvedValue(null);
    tokens.verify.mockReturnValue({ sub: 'user-2', fam: 'fam-2' });

    await service.logout(
      request({ [COOKIE_REFRESH]: 'gone', [COOKIE_ACCESS]: 'at' }),
      response,
      meta,
    );

    expect(tokens.verify).toHaveBeenCalledWith('access', 'at');
    expect(sessions.revokeFamily).toHaveBeenCalledWith('fam-2', 'logout');
  });

  it('only clears cookies without a session', async () => {
    const { service, sessions, audit, cookies } = setup();

    await service.logout(request(), response, meta);

    expect(sessions.findFamily).not.toHaveBeenCalled();
    expect(cookies.clearAll).toHaveBeenCalled();
    expect(sessions.revokeFamily).not.toHaveBeenCalled();
    expect(audit.record).not.toHaveBeenCalled();
  });
});
