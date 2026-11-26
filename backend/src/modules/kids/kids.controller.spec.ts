import { type ExecutionContext, HttpException } from '@nestjs/common';
import type { Request, Response } from 'express';
import type { KidEntity } from './kid.entity';
import { KidGuard, type KidRequest } from './kid.guard';
import type { KidSessionService } from './kid-session.service';
import { KidsController } from './kids.controller';
import type { KidsService } from './kids.service';

const auth = { userId: 'u1', role: 'parent' as const, familyId: 'fam1' };
const request = { ip: '203.0.113.5', headers: {} } as unknown as Request;
const response = {} as Response;

function contextFor(req: Partial<KidRequest>): ExecutionContext {
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('KidGuard', () => {
  it('attaches the active kid', async () => {
    const kid = { id: 'k1' } as KidEntity;
    const sessions = { activeKid: jest.fn().mockResolvedValue(kid) };
    const req: Partial<KidRequest> = { auth };

    await expect(
      new KidGuard(sessions as unknown as KidSessionService).canActivate(
        contextFor(req),
      ),
    ).resolves.toBe(true);
    expect(req.kid).toBe(kid);
  });

  it('refuses without an active kid with 403 KID_SESSION_REQUIRED', async () => {
    const sessions = { activeKid: jest.fn().mockResolvedValue(null) };

    const error = await new KidGuard(sessions as unknown as KidSessionService)
      .canActivate(contextFor({ auth }))
      .catch((e: unknown) => e);

    expect((error as HttpException).getStatus()).toBe(403);
    expect((error as HttpException).getResponse()).toMatchObject({
      errorCode: 'KID_SESSION_REQUIRED',
    });
  });

  it('requires a signed-in user', async () => {
    const sessions = { activeKid: jest.fn() };

    await expect(
      new KidGuard(sessions as unknown as KidSessionService).canActivate(
        contextFor({}),
      ),
    ).rejects.toBeInstanceOf(HttpException);
    expect(sessions.activeKid).not.toHaveBeenCalled();
  });
});

describe('KidsController', () => {
  const kids = {
    list: jest.fn().mockResolvedValue([]),
    create: jest.fn().mockResolvedValue({ id: 'k1' }),
    update: jest.fn().mockResolvedValue({ id: 'k1' }),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const sessions = {
    activate: jest.fn().mockResolvedValue({ id: 'k1' }),
    deactivate: jest.fn(),
  };
  const controller = new KidsController(
    kids as unknown as KidsService,
    sessions as unknown as KidSessionService,
  );
  const dto = {
    nickname: 'Zoë',
    avatar: { animal: 'marmot', accessory: null, background: '#FFD8A8' },
    startClass: 'KG1' as const,
    language: 'de-CH' as const,
  };

  it('delegates to the services with the actor', async () => {
    await controller.list(auth);
    await controller.create(auth, dto, request);
    await controller.update(auth, 'k1', { nickname: 'Max' });
    await controller.remove(auth, 'k1', request);
    await controller.activate(
      auth,
      'k1',
      { pin: [1, 2, 3, 4] },
      request,
      response,
    );
    controller.deactivate(response);

    const actor = { userId: 'u1', ip: '203.0.113.5' };
    expect(kids.list).toHaveBeenCalledWith('u1');
    expect(kids.create).toHaveBeenCalledWith(actor, dto);
    expect(kids.update).toHaveBeenCalledWith('u1', 'k1', { nickname: 'Max' });
    expect(kids.remove).toHaveBeenCalledWith(actor, 'k1');
    expect(sessions.activate).toHaveBeenCalledWith(
      auth,
      'k1',
      [1, 2, 3, 4],
      response,
      '203.0.113.5',
    );
    expect(sessions.deactivate).toHaveBeenCalledWith(response);
  });
});
