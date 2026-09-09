import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { after, before, test, type TestContext } from "node:test";
import { PKPass } from "passkit-generator";
import type { Config } from "./config";
import { getPassRecord, initDb, insertPass } from "./db";
import { createPassService } from "./passService";
import { getPass, storeStats } from "./store";
import { ApiError } from "./validate";

const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-service-"));
const origin = "https://passes.example.test";
const signedPass = Buffer.from("signed-pass");
const spec = {
  style: "generic",
  description: "Membership",
  images: {
    icon: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
  },
};
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
  return insertPass({
    serialNumber,
    authToken,
    webServiceURL: origin,
    specJson: JSON.stringify(spec),
    description: spec.description,
  });
}

function mockExternals(t: TestContext) {
  const signing = t.mock.method(PKPass.prototype, "getAsBuffer", () => signedPass);
  const delivery = t.mock.method(globalThis, "fetch", async () =>
    Response.json({ notification: { accepted_count: 1 } })
  );
  return { signing, delivery };
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
