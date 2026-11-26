import { createHash } from 'node:crypto';

export const HIBP_RANGE_URL = 'https://api.pwnedpasswords.com/range/';
export const HIBP_TIMEOUT_MS = 2_000;

export type Fetch = (
  input: string,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
) => Promise<Pick<Response, 'ok' | 'status' | 'text'>>;

/**
 * k-anonymity range query: only the first five hex characters of the SHA-1
 * hash leave the server.
 * @returns true if the password appears in a known breach
 * @throws when the service is unreachable, slow or answers with an error
 */
export async function isPwnedPassword(
  password: string,
  fetchFn: Fetch = fetch,
  timeoutMs = HIBP_TIMEOUT_MS,
): Promise<boolean> {
  const hash = createHash('sha1').update(password, 'utf8').digest('hex');
  const prefix = hash.slice(0, 5).toUpperCase();
  const suffix = hash.slice(5).toUpperCase();

  const response = await fetchFn(`${HIBP_RANGE_URL}${prefix}`, {
    headers: { 'Add-Padding': 'true' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    throw new Error(`HIBP answered ${response.status}`);
  }
  const body = await response.text();
  return body.split('\n').some((line) => {
    const [candidate, count] = line.trim().split(':');
    return candidate === suffix && Number(count) > 0;
  });
}
