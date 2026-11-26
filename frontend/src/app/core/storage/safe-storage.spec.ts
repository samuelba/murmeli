import { TestBed } from '@angular/core/testing';
import { SafeStorage } from './safe-storage';

describe('SafeStorage', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('reads and writes localStorage', () => {
    const storage = TestBed.inject(SafeStorage);

    storage.set('key', 'value');

    expect(storage.get('key')).toBe('value');
    expect(storage.get('missing')).toBeNull();
  });

  it('swallows storage errors', () => {
    const storage = TestBed.inject(SafeStorage);
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });

    expect(() => storage.set('key', 'value')).not.toThrow();
    expect(storage.get('key')).toBeNull();
  });
});
