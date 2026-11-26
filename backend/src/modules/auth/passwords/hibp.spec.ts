import { createHash } from 'node:crypto';
import { type Fetch, HIBP_RANGE_URL, isPwnedPassword } from './hibp';

function sha1(value: string): string {
  return createHash('sha1').update(value).digest('hex').toUpperCase();
}

function fetchReturning(body: string, ok = true, status = 200): jest.Mock {
  return jest.fn().mockResolvedValue({
    ok,
    status,
    text: () => Promise.resolve(body),
  });
}

describe('isPwnedPassword', () => {
  const password = 'correct-horse-battery';
  const hash = sha1(password);

  it('sends only the first five hash characters', async () => {
    const fetchFn = fetchReturning('');

    await isPwnedPassword(password, fetchFn as Fetch);

    const [url, init] = fetchFn.mock.calls[0] as [
      string,
      { headers: Record<string, string>; signal: AbortSignal },
    ];
    expect(url).toBe(`${HIBP_RANGE_URL}${hash.slice(0, 5)}`);
    expect(url).not.toContain(hash.slice(5));
    expect(init.headers).toEqual({ 'Add-Padding': 'true' });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('finds a suffix with a positive count', async () => {
    const body = `0000000000000000000000000000000000A:1\r\n${hash.slice(5)}:42\r\n`;

    await expect(
      isPwnedPassword(password, fetchReturning(body) as Fetch),
    ).resolves.toBe(true);
  });

  it('ignores padding entries with a zero count', async () => {
    await expect(
      isPwnedPassword(password, fetchReturning(`${hash.slice(5)}:0`) as Fetch),
    ).resolves.toBe(false);
  });

  it('is false when the suffix is missing', async () => {
    await expect(
      isPwnedPassword(password, fetchReturning('ABC:3\nDEF:1') as Fetch),
    ).resolves.toBe(false);
  });

  it('uses the global fetch by default', async () => {
    const fetchSpy = jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(`${hash.slice(5)}:1`));

    await expect(isPwnedPassword(password)).resolves.toBe(true);
    expect(fetchSpy).toHaveBeenCalled();
    fetchSpy.mockRestore();
  });

  it('throws on an error status', async () => {
    await expect(
      isPwnedPassword(password, fetchReturning('', false, 503) as Fetch),
    ).rejects.toThrow('HIBP answered 503');
  });
});
