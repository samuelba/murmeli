import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const VERSION_PATTERN = /^v\d+$/;

export class UnknownKeyVersionError extends Error {
  constructor(version: string) {
    super(
      `Value is encrypted with key version ${version}, which is not configured`,
    );
    this.name = 'UnknownKeyVersionError';
  }
}

/**
 * Derives a 32-byte AES key for one purpose from an operator-provided secret.
 */
export function deriveEncryptionKey(secret: string, purpose: string): Buffer {
  return Buffer.from(
    hkdfSync('sha256', secret, '', `murmeli:enc:${purpose}`, KEY_LENGTH),
  );
}

function seal(plaintext: string, key: Buffer, aad: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  return [iv, cipher.getAuthTag(), encrypted]
    .map((part) => part.toString('base64url'))
    .join(':');
}

function open(payload: string, key: Buffer, aad: string): string {
  const parts = payload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted value format');
  }
  const [iv, tag, encrypted] = parts.map((part) =>
    Buffer.from(part, 'base64url'),
  );
  if (iv.length !== IV_LENGTH || tag.length !== TAG_LENGTH) {
    throw new Error('Invalid encrypted value format');
  }
  const decipher = createDecipheriv(ALGORITHM, key, iv, {
    authTagLength: TAG_LENGTH,
  });
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString(
    'utf8',
  );
}

export interface CipherKeys {
  /** Version written into new values, e.g. `v1` */
  readonly current: string;
  /** Every key that may still be needed to read stored values, by version */
  readonly keys: Readonly<Record<string, Buffer>>;
}

/**
 * AES-256-GCM with a key version prefix (`v1:iv:tag:data`), so stored values
 * can move to a new key while the old ones stay readable until re-encrypted.
 */
export class VersionedCipher {
  constructor(private readonly config: CipherKeys) {
    if (!VERSION_PATTERN.test(config.current)) {
      throw new Error(`Invalid key version ${config.current}`);
    }
    if (config.keys[config.current] === undefined) {
      throw new Error(`No key configured for version ${config.current}`);
    }
  }

  versionOf(payload: string): string | null {
    const version = payload.slice(0, payload.indexOf(':'));
    return VERSION_PATTERN.test(version) ? version : null;
  }

  needsUpgrade(payload: string): boolean {
    return this.versionOf(payload) !== this.config.current;
  }

  /**
   * @param aad context the value is bound to (e.g. the owner's id); the same
   * value must be passed to decrypt
   */
  encrypt(plaintext: string, aad = ''): string {
    const key = this.config.keys[this.config.current];
    return `${this.config.current}:${seal(plaintext, key, aad)}`;
  }

  /**
   * @throws UnknownKeyVersionError for a version without a configured key
   * @throws Error if the value is malformed or was encrypted with another key
   */
  decrypt(payload: string, aad = ''): string {
    const version = this.versionOf(payload);
    if (version === null) {
      throw new Error('Invalid encrypted value format');
    }
    const key = this.config.keys[version];
    if (key === undefined) {
      throw new UnknownKeyVersionError(version);
    }
    return open(payload.slice(version.length + 1), key, aad);
  }
}
