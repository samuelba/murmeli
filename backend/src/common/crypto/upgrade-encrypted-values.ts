import { VersionedCipher } from './versioned-cipher';

export interface EncryptedValue<Id> {
  readonly id: Id;
  readonly value: string;
  /** The context the value was encrypted with */
  readonly aad?: string;
}

/**
 * Persists a re-encrypted value only if the stored value is still `oldValue`,
 * so concurrent instances never overwrite each other.
 * @returns true if the row was updated
 */
export type SaveIfUnchanged<Id> = (
  id: Id,
  oldValue: string,
  newValue: string,
) => Promise<boolean>;

export interface UpgradeReport<Id> {
  readonly upgraded: readonly Id[];
  readonly unreadable: readonly Id[];
}

function canDecrypt(
  cipher: VersionedCipher,
  value: string,
  aad: string,
): boolean {
  try {
    cipher.decrypt(value, aad);
    return true;
  } catch {
    return false;
  }
}

/**
 * Re-encrypts every readable value that is not on the current key version.
 * Each row is upgraded on its own: the version prefix keeps a partly
 * upgraded table valid.
 */
export async function upgradeEncryptedValues<Id>(
  values: readonly EncryptedValue<Id>[],
  cipher: VersionedCipher,
  save: SaveIfUnchanged<Id>,
): Promise<UpgradeReport<Id>> {
  const upgraded: Id[] = [];
  const unreadable: Id[] = [];

  for (const { id, value, aad = '' } of values) {
    if (!canDecrypt(cipher, value, aad)) {
      unreadable.push(id);
      continue;
    }
    if (!cipher.needsUpgrade(value)) {
      continue;
    }
    if (
      await save(id, value, cipher.encrypt(cipher.decrypt(value, aad), aad))
    ) {
      upgraded.push(id);
    }
  }

  return { upgraded, unreadable };
}
