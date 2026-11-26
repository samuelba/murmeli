import fc from 'fast-check';
import { rateLimitNetwork, truncateIp } from './truncate-ip';

function expandIpv6(ip: string): number[] {
  const [head, tail = ''] = ip.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const groups = ip.includes('::')
    ? [
        ...headGroups,
        ...Array<string>(8 - headGroups.length - tailGroups.length).fill('0'),
        ...tailGroups,
      ]
    : headGroups;
  return groups.map((group) => parseInt(group, 16));
}

describe('truncateIp', () => {
  it.each([
    ['203.0.113.77', '203.0.113.0'],
    ['::ffff:203.0.113.77', '203.0.113.0'],
    ['::FFFF:10.1.2.3', '10.1.2.0'],
    ['2001:db8:abcd:12:3456::1', '2001:db8:abcd::'],
    ['2001:0db8:0001:ffff:ffff:ffff:ffff:ffff', '2001:db8:1::'],
    ['::1', '0:0:0::'],
    ['fe80::1%eth0', 'fe80:0:0::'],
  ])('%s -> %s', (input, expected) => {
    expect(truncateIp(input)).toBe(expected);
  });

  it.each([null, undefined, '', 'not-an-ip', '999.1.1.1'])(
    'returns null for %p',
    (input) => {
      expect(truncateIp(input)).toBeNull();
    },
  );

  it('keeps the first three IPv4 octets and zeroes the last', () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        const [a, b, c, d] = (truncateIp(ip) ?? '').split('.');
        expect(d).toBe('0');
        expect([a, b, c].map(Number)).toEqual(
          ip.split('.').slice(0, 3).map(Number),
        );
      }),
    );
  });

  it('treats IPv4-mapped IPv6 addresses as IPv4', () => {
    fc.assert(
      fc.property(fc.ipV4(), (ip) => {
        expect(truncateIp(`::ffff:${ip}`)).toBe(truncateIp(ip));
      }),
    );
  });

  it('keeps only the first 48 bits of IPv6 addresses', () => {
    fc.assert(
      fc.property(
        fc.ipV6().filter((ip) => !ip.includes('.')),
        (ip) => {
          const truncated = truncateIp(ip) ?? '';
          expect(truncated.endsWith('::')).toBe(true);
          const expanded = expandIpv6(truncated);
          expect(expanded.slice(0, 3)).toEqual(expandIpv6(ip).slice(0, 3));
          expect(expanded.slice(3).every((group) => group === 0)).toBe(true);
        },
      ),
    );
  });
});

describe('rateLimitNetwork', () => {
  it.each([
    ['203.0.113.77', '203.0.113.77'],
    ['::ffff:203.0.113.77', '203.0.113.77'],
    ['2001:db8:abcd:12:3456::1', '2001:db8:abcd:12::/64'],
    ['2001:db8:abcd:12:ffff:ffff:ffff:ffff', '2001:db8:abcd:12::/64'],
    ['fe80::1%eth0', 'fe80:0:0:0::/64'],
    [null, 'unknown'],
    [undefined, 'unknown'],
    ['garbage', 'unknown'],
  ])('%p -> %s', (input, expected) => {
    expect(rateLimitNetwork(input)).toBe(expected);
  });

  it('groups every address of one IPv6 /64 together', () => {
    fc.assert(
      fc.property(
        fc.ipV6().filter((ip) => !ip.includes('.')),
        (ip) => {
          const prefix = expandIpv6(ip).slice(0, 4);
          const sibling = [...prefix, 1, 2, 3, 4]
            .map((group) => group.toString(16))
            .join(':');
          expect(rateLimitNetwork(sibling)).toBe(rateLimitNetwork(ip));
        },
      ),
    );
  });
});
