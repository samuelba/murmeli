import { upgradeEncryptedValues } from './upgrade-encrypted-values';
import { VersionedCipher, deriveEncryptionKey } from './versioned-cipher';

const oldKey = deriveEncryptionKey(
  'old-secret-0123456789-abcdefghijkl',
  'totp',
);
const newKey = deriveEncryptionKey(
  'new-secret-0123456789-abcdefghijkl',
  'totp',
);
const before = new VersionedCipher({ current: 'v1', keys: { v1: oldKey } });
const after = new VersionedCipher({
  current: 'v2',
  keys: { v1: oldKey, v2: newKey },
});

describe('upgradeEncryptedValues', () => {
  it('re-encrypts old values with the current key', async () => {
    const value = before.encrypt('secret');
    const save = jest.fn().mockResolvedValue(true);

    const report = await upgradeEncryptedValues(
      [{ id: 1, value }],
      after,
      save,
    );

    expect(report).toEqual({ upgraded: [1], unreadable: [] });
    const [, oldValue, newValue] = save.mock.calls[0] as [
      number,
      string,
      string,
    ];
    expect(oldValue).toBe(value);
    expect(newValue.startsWith('v2:')).toBe(true);
    expect(after.decrypt(newValue)).toBe('secret');
  });

  it('keeps the additional authenticated data of each value', async () => {
    const value = before.encrypt('secret', 'user-7');
    const save = jest.fn().mockResolvedValue(true);

    const report = await upgradeEncryptedValues(
      [
        { id: 1, value, aad: 'user-7' },
        { id: 2, value, aad: 'user-8' },
      ],
      after,
      save,
    );

    expect(report).toEqual({ upgraded: [1], unreadable: [2] });
    const newValue = (save.mock.calls[0] as [number, string, string])[2];
    expect(after.decrypt(newValue, 'user-7')).toBe('secret');
    expect(() => after.decrypt(newValue)).toThrow();
  });

  it('leaves current values alone', async () => {
    const save = jest.fn();

    const report = await upgradeEncryptedValues(
      [{ id: 'a', value: after.encrypt('x') }],
      after,
      save,
    );

    expect(report).toEqual({ upgraded: [], unreadable: [] });
    expect(save).not.toHaveBeenCalled();
  });

  it('reports unreadable values without touching them', async () => {
    const foreign = new VersionedCipher({
      current: 'v1',
      keys: { v1: newKey },
    });
    const save = jest.fn();

    const report = await upgradeEncryptedValues(
      [
        { id: 1, value: 'garbage' },
        { id: 2, value: foreign.encrypt('x') },
      ],
      after,
      save,
    );

    expect(report).toEqual({ upgraded: [], unreadable: [1, 2] });
    expect(save).not.toHaveBeenCalled();
  });

  it('does not count rows another instance changed meanwhile', async () => {
    const save = jest.fn().mockResolvedValue(false);

    const report = await upgradeEncryptedValues(
      [{ id: 1, value: before.encrypt('x') }],
      after,
      save,
    );

    expect(report.upgraded).toEqual([]);
  });
});
