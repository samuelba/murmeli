export type TrustProxySetting = number | string | false;

const DEFAULT_HOPS = 1;

/**
 * Parses TRUST_PROXY into a value for Express' `trust proxy` setting: a hop
 * count, `false`, or an address/subnet list. `true` is rejected because it
 * trusts any client-supplied X-Forwarded-For and defeats IP rate limiting.
 */
export function parseTrustProxy(raw: string | undefined): TrustProxySetting {
  const value = raw?.trim() ?? '';
  if (value === '') {
    return DEFAULT_HOPS;
  }

  const lower = value.toLowerCase();
  if (lower === 'true') {
    throw new Error(
      'TRUST_PROXY=true trusts any client-supplied X-Forwarded-For header, which lets clients bypass rate limiting. Set the number of reverse proxies in front of the backend instead (1 for the bundled nginx).',
    );
  }
  if (lower === 'false') {
    return false;
  }
  if (/^\d+$/.test(value)) {
    const hops = Number(value);
    return hops === 0 ? false : hops;
  }
  return value;
}
