import { lookup as dnsLookup, type LookupAddress } from "node:dns";
import { BlockList, isIP } from "node:net";

/**
 * Guards for fetching user-supplied links server-side (SSRF): only public
 * internet addresses. Used as the `lookup` of the actual HTTP connection,
 * so the address that's checked is the address that's connected to (no
 * DNS-rebinding gap between a check and the request).
 */

// Two lists: a BlockList checks IPv4 addresses against its IPv6 rules too
// (as IPv4-mapped), so IPv6 rules like ::ffff:0:0/96 must live apart.
const blockedV4 = new BlockList();
const blockedV6 = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.0.2.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["198.51.100.0", 24],
  ["203.0.113.0", 24],
  ["224.0.0.0", 3],
] as const) {
  blockedV4.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 96], // unspecified, loopback and IPv4-compatible (::a.b.c.d)
  ["::ffff:0:0", 96], // IPv4-mapped (a public site never needs these)
  ["64:ff9b::", 96], // NAT64
  ["100::", 64], // discard
  ["2001:db8::", 32], // documentation
  ["2002::", 16], // 6to4 (embeds an IPv4 address)
  ["fc00::", 7], // unique local
  ["fe80::", 10], // link-local
  ["fec0::", 10], // site-local (deprecated)
  ["ff00::", 8], // multicast
] as const) {
  blockedV6.addSubnet(net, prefix, "ipv6");
}

/** Is this a private/loopback/link-local/reserved address (never fetched)? Non-IPs count as private. */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip);
  if (family === 4) return blockedV4.check(ip, "ipv4");
  if (family === 6) return blockedV6.check(ip, "ipv6");
  return true;
}

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | LookupAddress[], family?: number) => void;

/**
 * A drop-in `lookup` for http(s).request that refuses private addresses.
 * `resolve` is injectable for tests.
 */
export function makeSafeLookup(resolve: typeof dnsLookup = dnsLookup) {
  return function safeLookup(hostname: string, options: { all?: boolean }, callback: LookupCallback) {
    resolve(hostname, { all: true }, (err, addresses) => {
      if (err) return callback(err, "");
      const list = addresses as LookupAddress[];
      if (list.length === 0 || list.some((a) => isPrivateAddress(a.address))) {
        const e = Object.assign(new Error(`Blocked address for ${hostname}`), { code: "EBLOCKED" }) as NodeJS.ErrnoException;
        return callback(e, "");
      }
      if (options?.all) return callback(null, list);
      callback(null, list[0].address, list[0].family);
    });
  };
}
