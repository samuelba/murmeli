import type { Response } from 'express';
import { ParentGateController } from './parent-gate.controller';

describe('ParentGateController', () => {
  const auth = { userId: 'u', familyId: 'f' };
  const response = {} as Response;

  function setup() {
    const gate = {
      unlock: jest.fn().mockResolvedValue(new Date('2026-11-26T12:10:00Z')),
      lock: jest.fn(),
    };
    return { controller: new ParentGateController(gate as never), gate };
  }

  it('returns the gate expiry as ISO string', async () => {
    const { controller, gate } = setup();

    await expect(
      controller.unlock(auth, { password: 'pw' }, response),
    ).resolves.toEqual({
      parentGateExpiresAt: '2026-11-26T12:10:00.000Z',
    });
    expect(gate.unlock).toHaveBeenCalledWith(auth, 'pw', response);
  });

  it('locks the gate', () => {
    const { controller, gate } = setup();

    controller.lock(response);

    expect(gate.lock).toHaveBeenCalledWith(response);
  });
});
