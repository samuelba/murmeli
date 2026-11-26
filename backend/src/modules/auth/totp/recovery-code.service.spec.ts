import { IsNull } from 'typeorm';
import {
  RECOVERY_CODE_COUNT,
  RecoveryCodeService,
  generateRecoveryCode,
  hashRecoveryCode,
  normalizeRecoveryCode,
} from './recovery-code.service';

function setup() {
  const repository = {
    delete: jest.fn(),
    insert: jest.fn(),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
  };
  return { service: new RecoveryCodeService(repository as never), repository };
}

describe('recovery code helpers', () => {
  it('generates XXXX-XXXX-XXXX codes without ambiguous characters', () => {
    for (let i = 0; i < 50; i += 1) {
      expect(generateRecoveryCode()).toMatch(
        /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/,
      );
    }
  });

  it('normalises case, spaces and dashes before hashing', () => {
    expect(normalizeRecoveryCode(' abcd-efgh jkmn ')).toBe('ABCDEFGHJKMN');
    expect(hashRecoveryCode('abcd efgh-jkmn')).toBe(
      hashRecoveryCode('ABCD-EFGH-JKMN'),
    );
  });
});

describe('RecoveryCodeService', () => {
  it('replaces all codes with ten fresh hashed ones', async () => {
    const { service, repository } = setup();

    const codes = await service.replace('user-1');

    expect(codes).toHaveLength(RECOVERY_CODE_COUNT);
    expect(new Set(codes).size).toBe(RECOVERY_CODE_COUNT);
    expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
    expect(repository.insert).toHaveBeenCalledWith(
      codes.map((code) => ({
        userId: 'user-1',
        codeHash: hashRecoveryCode(code),
      })),
    );
  });

  it('uses the transaction manager when given', async () => {
    const { service, repository } = setup();
    const scoped = { delete: jest.fn(), insert: jest.fn() };
    const manager = { getRepository: jest.fn().mockReturnValue(scoped) };

    await service.replace('user-1', manager as never);
    await service.removeAll('user-1', manager as never);

    expect(scoped.delete).toHaveBeenCalledTimes(2);
    expect(repository.delete).not.toHaveBeenCalled();
  });

  it('redeems an unused code once', async () => {
    const { service, repository } = setup();

    await expect(service.consume('user-1', 'abcd-efgh-jkmn')).resolves.toBe(
      true,
    );

    expect(repository.update).toHaveBeenCalledWith(
      {
        userId: 'user-1',
        codeHash: hashRecoveryCode('ABCDEFGHJKMN'),
        usedAt: IsNull(),
      },
      { usedAt: expect.any(Date) },
    );
  });

  it('rejects an unknown or used code', async () => {
    const { service, repository } = setup();
    repository.update.mockResolvedValue({ affected: 0 });

    await expect(service.consume('user-1', 'ABCD-EFGH-JKMN')).resolves.toBe(
      false,
    );
    repository.update.mockResolvedValue({});
    await expect(service.consume('user-1', 'ABCD-EFGH-JKMN')).resolves.toBe(
      false,
    );
  });

  it('rejects malformed codes without touching the database', async () => {
    const { service, repository } = setup();

    await expect(service.consume('user-1', '123456')).resolves.toBe(false);
    expect(repository.update).not.toHaveBeenCalled();
  });

  it('removes all codes', async () => {
    const { service, repository } = setup();

    await service.removeAll('user-1');

    expect(repository.delete).toHaveBeenCalledWith({ userId: 'user-1' });
  });
});
