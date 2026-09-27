import type { LookupAddress } from "node:dns";
import { describe, expect, it } from "vitest";
import { isPrivateAddress, makeSafeLookup } from "./net-guard";

describe("isPrivateAddress", () => {
  it.each([
    ["127.0.0.1", true],
    ["10.1.2.3", true],
    ["172.16.0.1", true],
    ["172.32.0.1", false],
    ["192.168.1.1", true],
    ["169.254.169.254", true],
    ["100.64.0.1", true],
    ["0.0.0.0", true],
    ["224.0.0.1", true],
    ["::1", true],
    ["::", true],
    ["fd00::1", true],
    ["fe80::1", true],
    ["fec0::1", true],
    ["::ffff:127.0.0.1", true],
    ["::ffff:7f00:1", true],
    ["::ffff:a9fe:a9fe", true],
    ["::127.0.0.1", true],
    ["::7f00:1", true],
    ["64:ff9b::7f00:1", true],
    ["2002:7f00:1::", true],
    ["not-an-ip", true],
    ["8.8.8.8", false],
    ["2606:4700::1111", false],
  ])("%s -> %s", (ip, expected) => expect(isPrivateAddress(ip)).toBe(expected));
});

type Resolve = Parameters<typeof makeSafeLookup>[0];
const fakeResolve = (addresses: LookupAddress[]): Resolve =>
  ((_host: string, _opts: unknown, cb: (e: Error | null, a: LookupAddress[]) => void) => cb(null, addresses)) as unknown as Resolve;

function run(addresses: LookupAddress[], all = false) {
  return new Promise<{ err: NodeJS.ErrnoException | null; address: unknown }>((resolve) =>
    makeSafeLookup(fakeResolve(addresses))("example.com", { all }, (err, address) => resolve({ err, address }))
  );
}

describe("makeSafeLookup (the connection's DNS lookup)", () => {
  it("connects to a public address", async () => {
    expect(await run([{ address: "93.184.216.34", family: 4 }])).toEqual({ err: null, address: "93.184.216.34" });
  });
  it("refuses if ANY resolved address is private (DNS rebinding / mixed answers)", async () => {
    const r = await run([
      { address: "93.184.216.34", family: 4 },
      { address: "127.0.0.1", family: 4 },
    ]);
    expect(r.err?.code).toBe("EBLOCKED");
  });
  it("refuses an empty answer", async () => {
    expect((await run([])).err?.code).toBe("EBLOCKED");
  });
  it("supports all:true callers", async () => {
    const list = [{ address: "2606:4700::1111", family: 6 }];
    expect((await run(list, true)).address).toEqual(list);
  });
});
