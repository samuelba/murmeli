import {
  VersionedCipher,
  deriveEncryptionKey,
} from '../../../common/crypto/versioned-cipher';

export const TOTP_KEY_VERSION = 'v1';

export function createTotpCipher(encryptionKey: string): VersionedCipher {
  return new VersionedCipher({
    current: TOTP_KEY_VERSION,
    keys: { [TOTP_KEY_VERSION]: deriveEncryptionKey(encryptionKey, 'totp') },
  });
}
