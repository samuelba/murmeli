import { isIPv4, isIPv6 } from 'node:net';

const IPV4_MAPPED_PREFIX = '::ffff:';
const IPV6_KEPT_GROUPS = 3;

function truncateIpv4(ip: string): string {
  const [a, b, c] = ip.split('.');
  return `${a}.${b}.${c}.0`;
}

function expandIpv6(ip: string): string[] {
  const [head, tail = ''] = ip.split('::');
  const headGroups = head === '' ? [] : head.split(':');
  const tailGroups = tail === '' ? [] : tail.split(':');
  const missing = 8 - headGroups.length - tailGroups.length;
  return ip.includes('::')
    ? [...headGroups, ...Array<string>(missing).fill('0'), ...tailGroups]
    : headGroups;
}

function ipv6Prefix(ip: string, groups: number): string {
  const kept = expandIpv6(ip)
    .slice(0, groups)
    .map((group) => parseInt(group, 16).toString(16));
  return `${kept.join(':')}::`;
}

function truncateIpv6(ip: string): string {
  return ipv6Prefix(ip, IPV6_KEPT_GROUPS);
}

function canonical(ip: string): string {
  const lower = ip.toLowerCase();
  return lower.startsWith(IPV4_MAPPED_PREFIX)
    ? lower.slice(IPV4_MAPPED_PREFIX.length)
    : lower.split('%')[0];
}

/**
 * The client network a rate limit is keyed on: the full IPv4 address or the
 * IPv6 /64 (one customer line), so rotating through a /64 does not help.
 */
export function rateLimitNetwork(ip: string | null | undefined): string {
  const candidate = canonical(ip ?? '');
  if (isIPv6(candidate)) {
    return `${ipv6Prefix(candidate, 4)}/64`;
  }
  return isIPv4(candidate) ? candidate : 'unknown';
}

/**
 * Keeps only the network part of an address: /24 for IPv4 and /48 for IPv6.
 * IPv4-mapped IPv6 addresses are treated as IPv4.
 */
export function truncateIp(ip: string | null | undefined): string | null {
  if (!ip) {
    return null;
  }
  const candidate = canonical(ip);
  if (isIPv4(candidate)) {
    return truncateIpv4(candidate);
  }
  if (isIPv6(candidate)) {
    return truncateIpv6(candidate);
  }
  return null;
}
