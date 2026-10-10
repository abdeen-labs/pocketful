import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { PKPass } from "passkit-generator";
import type { Config } from "./config";
import { getPassImages, getPassRecord, initDb, insertPass } from "./db";
import { stashUpload } from "./imageSources";
import { createPassService } from "./passService";
import { getPass, storeStats } from "./store";
import { serveHttps, SOURCE_PNG, type FakeResponse } from "./testSupport";
import { ApiError } from "./validate";

const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-service-"));
const origin = "https://passes.example.test";
const signedPass = Buffer.from("signed-pass");
const spec = { style: "generic", description: "Membership" };
const ART_URL = "https://art.example.test/poster.png";
const config: Config = {
  port: 0,
  passTypeIdentifier: "pass.test.pocketful",
  teamIdentifier: "TESTTEAM01",
  organizationName: "Pocketful Tests",
  apiToken: "test-api-token",
  passTtlSeconds: 900,
  passStoreMaxBytes: 128 * 1024 * 1024,
  dataDir,
  hark: { url: "https://hark.example.test", token: "test-hark-token" },
  certs: {
    wwdr: Buffer.from("dummy"),
    signerCert: Buffer.from("dummy"),
    signerKey: Buffer.from("dummy"),
  },
};

before(() => initDb(dataDir));
after(() => rmSync(dataDir, { recursive: true, force: true }));

function storedPass(serialNumber: string, authToken = "original-auth-token") {
  return insertPass(
    {
      serialNumber,
      authToken,
      webServiceURL: origin,
      specJson: JSON.stringify(spec),
      description: spec.description,
    },
    { icon: SOURCE_PNG }
  );
}

/** Signing is stubbed, art downloads answer from `art`, and fetch plays Hark. */
function mockExternals(t: TestContext, art: Record<string, FakeResponse> = {}) {
  const signing = t.mock.method(PKPass.prototype, "getAsBuffer", () => signedPass);
  const downloads = serveHttps(t, art);
  const delivery = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ notification: { accepted_count: 1 } })
  );
  return { signing, delivery, downloads };
}

function rejectsWith(promise: Promise<unknown>, status: number, pattern: RegExp) {
  return assert.rejects(
    promise,
    (err: unknown) => err instanceof ApiError && err.status === status && pattern.test(err.message)
  );
}

test("create downloads https art and stores the bytes with an updatable pass", async (t) => {
  const { downloads } = mockExternals(t, { [ART_URL]: { status: 200, body: SOURCE_PNG } });
  const service = createPassService(config);
  await service.create(
    { ...spec, updatable: true, serialNumber: "url-art", images: { icon: ART_URL } },
    origin
  );

  assert.deepEqual(downloads, [ART_URL]);
  assert.ok(getPassImages("url-art").icon.equals(SOURCE_PNG));
  const stored = await service.getSpec("url-art");
  assert.deepEqual(stored.spec, { ...spec, updatable: true, serialNumber: "url-art" });
  assert.deepEqual(stored.images, {
    icon: { width: 1200, height: 1500, bytes: SOURCE_PNG.byteLength },
  });
  service.remove("url-art");
  assert.deepEqual(getPassImages("url-art"), {});
});

test("update replaces only the slots it names, and null removes one", async (t) => {
  mockExternals(t);
  const service = createPassService(config);
  storedPass("merge-slots");
  const slots = () => Object.keys(getPassImages("merge-slots"));

  await service.update("merge-slots", { ...spec, images: { logo: await stashUpload(SOURCE_PNG) } });
  assert.deepEqual(slots(), ["icon", "logo"]);
  await service.update("merge-slots", { ...spec, description: "Renamed" });
  assert.deepEqual(slots(), ["icon", "logo"]);
  await service.update("merge-slots", { ...spec, images: { logo: null } });
  assert.deepEqual(slots(), ["icon"]);
  service.remove("merge-slots");
});

test("create rejects inline image data", async (t) => {
  mockExternals(t);
  await rejectsWith(
    createPassService(config).create({ ...spec, images: { icon: SOURCE_PNG.toString("base64") } }, origin),
    400,
    /images\.icon must be an https:\/\/ URL or an upload:<id> ref.*inline image data is not accepted/
  );
});

test("create rejects null slots, which only mean removal on update", async (t) => {
  mockExternals(t);
  await rejectsWith(
    createPassService(config).create({ ...spec, images: { icon: null } }, origin),
    400,
    /images\.icon must be an https:\/\/ URL/
  );
});

test("an upload ref whose file never arrived is rejected", async (t) => {
  mockExternals(t);
  const service = createPassService(config);
  const { ref } = service.prepareUpload(origin);
  await rejectsWith(service.create({ ...spec, images: { icon: ref } }, origin), 400, /was never uploaded or has expired/);
});

test("prepareUpload hands out a one-time URL on the caller's origin", () => {
  const upload = createPassService(config).prepareUpload(origin);
  const id = upload.ref.replace(/^upload:/, "");
  assert.match(upload.ref, /^upload:[0-9a-f-]{36}$/);
  assert.equal(upload.uploadUrl, `${origin}/api/uploads/${id}`);
  assert.equal(upload.maxBytes, 4 * 1024 * 1024);
  assert.ok(Date.parse(upload.expiresAt) > Date.now());
});

const MOVED = "https://art.example.test/moved.png";

for (const [name, routes, pattern] of [
  ["an art URL that answers 404", { [ART_URL]: { status: 404, body: "gone" } }, /answered HTTP 404/],
  [
    "an art URL that declares more than 4 MB",
    { [ART_URL]: { status: 200, headers: { "content-length": String(5 * 1024 * 1024) }, body: SOURCE_PNG } },
    /larger than 4 MB/,
  ],
  ["an art URL that is not an image", { [ART_URL]: { status: 200, body: "<html>" } }, /could not be decoded/],
  [
    "a redirect off https",
    { [ART_URL]: { status: 302, headers: { location: "http://art.example.test/poster.png" } } },
    /must stay on https \(it led to http:\/\/art\.example\.test\/poster\.png\)/,
  ],
  [
    "a redirect to a private address",
    { [ART_URL]: { status: 301, headers: { location: "https://169.254.169.254/latest/meta-data" } } },
    /points at a private or local address/,
  ],
  [
    "a redirect loop",
    {
      [ART_URL]: { status: 302, headers: { location: MOVED } },
      [MOVED]: { status: 302, headers: { location: ART_URL } },
    },
    /redirected more than 5 times/,
  ],
] as [string, Record<string, FakeResponse>, RegExp][]) {
  test(`create rejects ${name}`, async (t) => {
    mockExternals(t, routes);
    await rejectsWith(createPassService(config).create({ ...spec, images: { icon: ART_URL } }, origin), 400, pattern);
  });
}

test("create follows an https redirect to the image", async (t) => {
  const { downloads } = mockExternals(t, {
    [ART_URL]: { status: 302, headers: { location: "/moved.png" } },
    [MOVED]: { status: 200, body: SOURCE_PNG },
  });
  const link = await createPassService(config).create({ ...spec, images: { icon: ART_URL } }, origin);
  assert.deepEqual(downloads, [ART_URL, MOVED]);
  assert.equal(getPass(link.id)?.buffer, signedPass);
});

for (const url of [
  "http://art.example.test/poster.png",
  "https://127.0.0.1/poster.png",
  "https://[::1]/poster.png",
  "https://10.0.0.8/poster.png",
]) {
  test(`create refuses ${url} without connecting`, async (t) => {
    const { downloads, delivery } = mockExternals(t);
    await rejectsWith(
      createPassService(config).create({ ...spec, images: { icon: url } }, origin),
      400,
      /must be an https:\/\/ URL|private or local address/
    );
    assert.deepEqual(downloads, []);
    assert.equal(delivery.mock.callCount(), 0);
  });
}

test("mintDownload stores and delivers a pass that still exists", async (t) => {
  const { signing, delivery } = mockExternals(t);
  const service = createPassService(config);
  const record = storedPass("mint-existing");

  const link = await service.mintDownload(record.serialNumber, origin);

  assert.equal(signing.mock.callCount(), 1);
  assert.equal(getPass(link.id)?.buffer, signedPass);
  assert.equal(getPass(link.id)?.serialNumber, record.serialNumber);
  assert.deepEqual(link.hark, { sent: true });
  assert.equal(delivery.mock.callCount(), 1);
  service.remove(record.serialNumber);
  assert.equal(getPass(link.id), undefined);
});

test("mintDownload does not store or deliver a pass deleted during rendering", async (t) => {
  const { signing, delivery } = mockExternals(t);
  const service = createPassService(config);
  const record = storedPass("mint-deleted");
  const initialStore = storeStats();

  const pending = service.mintDownload(record.serialNumber, origin);
  service.remove(record.serialNumber);

  await assert.rejects(pending, (err: unknown) => err instanceof ApiError && err.status === 404);
  assert.equal(signing.mock.callCount(), 1);
  assert.equal(getPassRecord(record.serialNumber), undefined);
  assert.deepEqual(storeStats(), initialStore);
  assert.equal(delivery.mock.callCount(), 0);
});

test("mintDownload rejects a deleted identity when its serial number is reused", async (t) => {
  const { signing, delivery } = mockExternals(t);
  const service = createPassService(config);
  const record = storedPass("mint-recreated");
  const initialStore = storeStats();

  const pending = service.mintDownload(record.serialNumber, origin);
  service.remove(record.serialNumber);
  const replacement = storedPass(record.serialNumber, "replacement-auth-token");

  await assert.rejects(pending, (err: unknown) => err instanceof ApiError && err.status === 404);
  assert.equal(signing.mock.callCount(), 1);
  assert.deepEqual(getPassRecord(record.serialNumber), replacement);
  assert.deepEqual(storeStats(), initialStore);
  assert.equal(delivery.mock.callCount(), 0);
  service.remove(record.serialNumber);
});
