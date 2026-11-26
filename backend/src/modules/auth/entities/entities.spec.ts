import { getMetadataArgsStorage } from 'typeorm';
import { UserEntity } from '../../users/user.entity';
import { EmailTokenEntity } from './email-token.entity';
import { InviteEntity } from './invite.entity';
import { RecoveryCodeEntity } from './recovery-code.entity';
import { REVOCATION_REASONS, RefreshTokenEntity } from './refresh-token.entity';
import { TotpSecretEntity } from './totp-secret.entity';

const ENTITIES = [
  EmailTokenEntity,
  InviteEntity,
  RecoveryCodeEntity,
  RefreshTokenEntity,
  TotpSecretEntity,
];

describe('auth entities', () => {
  const storage = getMetadataArgsStorage();

  it.each(ENTITIES.map((entity) => [entity.name, entity]))(
    '%s references users',
    (_name, entity) => {
      const relations = storage.relations.filter((r) => r.target === entity);

      expect(relations).toHaveLength(1);
      expect((relations[0].type as () => unknown)()).toBe(UserEntity);
    },
  );

  it.each(
    ENTITIES.filter((entity) => entity !== TotpSecretEntity).map((entity) => [
      entity.name,
      entity,
    ]),
  )('%s defaults its id to uuidv7()', (_name, entity) => {
    const id = storage.columns.find(
      (c) => c.target === entity && c.propertyName === 'id',
    );

    expect((id?.options.default as () => string)()).toBe('uuidv7()');
  });

  it('allows the revocation reasons the services use', () => {
    expect(REVOCATION_REASONS).toEqual(
      expect.arrayContaining([
        'rotated',
        'compromised',
        'role_changed',
        'deleted',
      ]),
    );
  });
});
