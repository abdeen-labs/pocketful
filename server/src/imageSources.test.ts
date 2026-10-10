import assert from "node:assert/strict";
import dns from "node:dns";
import { test, type TestContext } from "node:test";
import {
  fillUpload,
  isPublicAddress,
  publicLookup,
  reserveUpload,
  resolveImages,
  stashUpload,
  UPLOAD_TTL_MS,
} from "./imageSources";
import { SOURCE_PNG } from "./testSupport";
import { ApiError } from "./validate";

function rejectsWith(promise: Promise<unknown>, status: number, pattern: RegExp) {
  return assert.rejects(
    promise,
    (err: unknown) => err instanceof ApiError && err.status === status && pattern.test(err.message)
  );
}

test("an upload ref resolves to the uploaded bytes, more than once", async () => {
  const ref = await stashUpload(SOURCE_PNG);
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const { images } = await resolveImages({ icon: ref, "de.lproj/logo": ref });
    assert.ok(images.icon.equals(SOURCE_PNG));
    assert.ok(images["de.lproj/logo"].equals(SOURCE_PNG));
  }
});

test("an upload URL takes exactly one image", async () => {
  const { id, ref } = reserveUpload();
  assert.deepEqual(await fillUpload(id, SOURCE_PNG), {
    ref,
    bytes: SOURCE_PNG.byteLength,
    width: 1200,
    height: 1500,
  });
  await rejectsWith(fillUpload(id, SOURCE_PNG), 409, /already used/);
});

test("an upload must decode as an image", async () => {
  const { id } = reserveUpload();
  await rejectsWith(fillUpload(id, Buffer.from("not an image")), 400, /not a decodable image/);
  await rejectsWith(fillUpload(id, Buffer.alloc(0)), 400, /empty/);
});

test("an upload URL dies after its lifetime", async (t) => {
  const { id, ref } = reserveUpload();
  const later = Date.now() + UPLOAD_TTL_MS + 1;
  t.mock.method(Date, "now", () => later);
  await rejectsWith(fillUpload(id, SOURCE_PNG), 404, /not found or expired/);
  await rejectsWith(resolveImages({ icon: ref }), 400, /never uploaded or has expired/);
});

test("an unknown upload id is a 404", async () => {
  await rejectsWith(fillUpload("00000000-0000-0000-0000-000000000000", SOURCE_PNG), 404, /not found/);
});

for (const [name, images, pattern] of [
  ["a slot name outside the allowlist", { banner: "upload:x" }, /Unknown image path "banner"/],
  ["a slot keyed with a scale suffix", { "icon@2x": "upload:x" }, /provide one image per slot \("icon"\) — the server produces every scale/],
  ["a localized slot keyed with a scale suffix", { "de.lproj/logo@3x": "upload:x" }, /one image per slot \("de\.lproj\/logo"\)/],
  ["a malformed upload ref", { icon: "upload:not-a-uuid" }, /must be an https:\/\/ URL or an upload:<id> ref/],
  ["a data: URL", { icon: "data:image/png;base64,AAAA" }, /inline image data is not accepted/],
  ["a non-string ref", { icon: 42 }, /must be an https:\/\/ URL/],
  ["images that are not an object", ["upload:x"], /must map Wallet artwork slot names/],
] as const) {
  test(`resolveImages rejects ${name}`, async () => {
    await rejectsWith(resolveImages(images), 400, pattern);
  });
}

test("null marks a slot for removal only when removal is allowed", async () => {
  assert.deepEqual(await resolveImages({ logo: null }, { allowRemoval: true }), {
    images: {},
    removed: ["logo"],
  });
  await rejectsWith(resolveImages({ logo: null }), 400, /must be an https:\/\/ URL/);
});

test("omitted images resolve to nothing", async () => {
  assert.deepEqual(await resolveImages(undefined), { images: {}, removed: [] });
});

for (const [address, isPublic] of [
  ["8.8.8.8", true],
  ["172.32.0.1", true],
  ["2606:4700:4700::1111", true],
  ["::ffff:8.8.8.8", true],
  ["127.0.0.1", false],
  ["10.1.2.3", false],
  ["172.16.5.4", false],
  ["192.168.1.1", false],
  ["169.254.169.254", false],
  ["100.64.0.1", false],
  ["0.0.0.0", false],
  ["::1", false],
  ["fe80::1", false],
  ["fd12:3456::1", false],
  ["::ffff:127.0.0.1", false],
  ["not-an-ip", false],
] as const) {
  test(`${address} is ${isPublic ? "" : "not "}a public address`, () => {
    assert.equal(isPublicAddress(address), isPublic);
  });
}

function lookupThrough(t: TestContext, answer: { address: string; family: number }[], all: boolean) {
  t.mock.method(dns, "lookup", (_host: string, _options: unknown, callback: (...args: unknown[]) => void) =>
    callback(null, answer)
  );
  return new Promise<{ err: NodeJS.ErrnoException | null; address: unknown }>((resolve) =>
    publicLookup("art.example.test", { all }, (err, address) => resolve({ err, address }))
  );
}

test("the download lookup dials only public addresses", async (t) => {
  const { err, address } = await lookupThrough(
    t,
    [
      { address: "10.0.0.5", family: 4 },
      { address: "93.184.215.14", family: 4 },
    ],
    true
  );
  assert.equal(err, null);
  assert.deepEqual(address, [{ address: "93.184.215.14", family: 4 }]);
});

test("the download lookup refuses a host that resolves only to private addresses", async (t) => {
  const { err } = await lookupThrough(t, [{ address: "127.0.0.1", family: 4 }], false);
  assert.equal(err?.code, "ENOTPUBLIC");
  assert.match(err?.message ?? "", /resolves only to private or local addresses/);
});
