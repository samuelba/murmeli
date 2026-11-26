import { HttpException } from '@nestjs/common';
import type { Response } from 'express';
import { RetryAfterException } from '../../../common/errors/api-exception';
import { ParentGateService } from './parent-gate.service';

const auth = { userId: 'user-1', familyId: 'fam-1' };
const response = {} as Response;
const policies = { parentGate: { name: 'parent-gate' } };
const expiresAt = new Date('2026-11-26T12:10:00Z');

function setup() {
  const deps = {
    users: {
      findById: jest
        .fn()
        .mockResolvedValue({ id: 'user-1', passwordHash: 'h' }),
    },
    passwords: { verify: jest.fn().mockResolvedValue(true) },
    limiter: {
      attempt: jest.fn().mockResolvedValue({
        allowed: true,
        retryAfterSeconds: 0,
        justLocked: false,
      }),
      succeed: jest.fn(),
    },
    issuer: {
      openParentGate: jest.fn().mockReturnValue(expiresAt),
      closeParentGate: jest.fn(),
    },
  };
  const service = new ParentGateService(
    deps.users as never,
    deps.passwords as never,
    deps.limiter as never,
    policies as never,
    deps.issuer as never,
  );
  return { service, ...deps };
}

describe('ParentGateService', () => {
  it('opens the gate for the right password and refunds the attempt', async () => {
    const { service, issuer, limiter } = setup();

    await expect(service.unlock(auth, 'pw', response)).resolves.toBe(expiresAt);
    expect(limiter.attempt).toHaveBeenCalledWith(policies.parentGate, 'user-1');
    expect(limiter.succeed).toHaveBeenCalledWith(policies.parentGate, 'user-1');
    expect(issuer.openParentGate).toHaveBeenCalledWith(
      response,
      'user-1',
      'fam-1',
    );
  });

  it('refuses while locked', async () => {
    const { service, limiter, passwords } = setup();
    limiter.attempt.mockResolvedValue({
      allowed: false,
      retryAfterSeconds: 42,
      justLocked: false,
    });

    const error = await service
      .unlock(auth, 'pw', response)
      .catch((e: unknown) => e);

    expect(error).toBeInstanceOf(RetryAfterException);
    expect(passwords.verify).not.toHaveBeenCalled();
  });

  it('counts a wrong password as INVALID_CREDENTIALS', async () => {
    const { service, passwords, limiter, issuer } = setup();
    passwords.verify.mockResolvedValue(false);

    const error = (await service
      .unlock(auth, 'bad', response)
      .catch((e: unknown) => e)) as HttpException;

    expect(error.getResponse()).toMatchObject({
      errorCode: 'INVALID_CREDENTIALS',
    });
    expect(limiter.succeed).not.toHaveBeenCalled();
    expect(issuer.openParentGate).not.toHaveBeenCalled();
  });

  it('treats an unknown user as a wrong password', async () => {
    const { service, users } = setup();
    users.findById.mockResolvedValue(null);

    const error = (await service
      .unlock(auth, 'pw', response)
      .catch((e: unknown) => e)) as HttpException;

    expect(error.getResponse()).toMatchObject({
      errorCode: 'INVALID_CREDENTIALS',
    });
  });

  it('locks the gate', () => {
    const { service, issuer } = setup();

    service.lock(response);

    expect(issuer.closeParentGate).toHaveBeenCalledWith(response);
  });
});
