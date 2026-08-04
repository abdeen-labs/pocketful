import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { Server } from "node:http";
import type { Config } from "./config";
import {
  getPassRecord,
  initDb,
  insertPass,
  pushTokensForSerial,
  updatePassSpec,
} from "./db";
import { createApp } from "./index";

// Exercises Apple's Wallet web service protocol over real HTTP against a real
// SQLite file. Routes that sign a pass need real certificates, which tests do
// not have — the dummy cert buffers below are only ever read on a build, so
// everything up to (but not including) signing is testable.

const PASS_TYPE = "pass.test.pocketful";
const AUTH_TOKEN = "test-auth-token";
const SERIAL = "test-serial-1";

function testConfig(dataDir: string): Config {
  return {
    port: 0,
    passTypeIdentifier: PASS_TYPE,
    teamIdentifier: "TESTTEAM01",
    organizationName: "Pocketful Tests",
    apiToken: "test-api-token",
    passTtlSeconds: 900,
    passStoreMaxBytes: 128 * 1024 * 1024,
    dataDir,
    certs: {
      wwdr: Buffer.from("dummy"),
      signerCert: Buffer.from("dummy"),
      signerKey: Buffer.from("dummy"),
    },
  };
}

let server: Server;
let base: string;

before(async () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-test-"));
  initDb(dataDir);
  insertPass({
    serialNumber: SERIAL,
    authToken: AUTH_TOKEN,
    webServiceURL: "https://example.test",
    specJson: JSON.stringify({ style: "generic", description: "Test pass" }),
    description: "Test pass",
  });
  const app = createApp(testConfig(dataDir));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

function registrationUrl(
  device: string,
  serial: string = SERIAL,
  passType: string = PASS_TYPE
): string {
  return `${base}/v1/devices/${device}/registrations/${passType}/${serial}`;
}

function register(
  device: string,
  pushToken: string,
  opts: { serial?: string; passType?: string; auth?: string | null } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  if (opts.auth !== null) {
    headers.authorization = opts.auth ?? `ApplePass ${AUTH_TOKEN}`;
  }
  return fetch(registrationUrl(device, opts.serial, opts.passType), {
    method: "POST",
    headers,
    body: JSON.stringify({ pushToken }),
  });
}

function poll(device: string, since?: string): Promise<Response> {
  const query = since ? `?passesUpdatedSince=${since}` : "";
  return fetch(
    `${base}/v1/devices/${device}/registrations/${PASS_TYPE}${query}`
  );
}

test("registering a device returns 201", async () => {
  const res = await register("device-a", "token-1");
  assert.equal(res.status, 201);
});

test("re-registering the same device and token returns 200", async () => {
  const res = await register("device-a", "token-1");
  assert.equal(res.status, 200);
  assert.deepEqual(pushTokensForSerial(SERIAL), ["token-1"]);
});

test("re-registering with a changed push token rotates the stored token", async () => {
  const res = await register("device-a", "token-2");
  assert.equal(res.status, 200);
  assert.deepEqual(pushTokensForSerial(SERIAL), ["token-2"]);
});

test("wrong passTypeIdentifier returns 401", async () => {
  const res = await register("device-a", "token-2", {
    passType: "pass.test.wrong",
  });
  assert.equal(res.status, 401);
});

test("missing ApplePass header returns 401", async () => {
  const res = await register("device-a", "token-2", { auth: null });
  assert.equal(res.status, 401);
});

test("bad ApplePass token returns 401", async () => {
  const res = await register("device-a", "token-2", {
    auth: "ApplePass wrong-token",
  });
  assert.equal(res.status, 401);
});

test("unknown serial with a valid-looking token returns 401, not 404", async () => {
  // Apple's spec: an attacker must not be able to distinguish "serial does
  // not exist" from "wrong token" — no existence oracle.
  const res = await register("device-a", "token-2", { serial: "no-such" });
  assert.equal(res.status, 401);
});

test("polling a device with no registrations returns 204", async () => {
  const res = await poll("device-never-registered");
  assert.equal(res.status, 204);
});

test("after an update the poll lists the serial and lastUpdated round-trips", async () => {
  const updated = updatePassSpec(
    SERIAL,
    JSON.stringify({ style: "generic", description: "Updated pass" }),
    "Updated pass",
    "https://example.test"
  );
  assert.ok(updated);

  const res = await poll("device-a");
  assert.equal(res.status, 200);
  const body = (await res.json()) as {
    serialNumbers: string[];
    lastUpdated: string;
  };
  assert.deepEqual(body.serialNumbers, [SERIAL]);

  // A device stores lastUpdated verbatim and sends it back; feeding it
  // straight back must report "nothing newer".
  const again = await poll("device-a", body.lastUpdated);
  assert.equal(again.status, 204);
});

test("two same-second updates produce distinct revisions and ETags", async () => {
  // The regression this plan exists for: with freshness keyed on a
  // second-truncated timestamp, the second of these updates was
  // indistinguishable from the first and never reached devices.
  const first = updatePassSpec(
    SERIAL,
    JSON.stringify({ style: "generic", description: "First" }),
    "First",
    "https://example.test"
  );
  const second = updatePassSpec(
    SERIAL,
    JSON.stringify({ style: "generic", description: "Second" }),
    "Second",
    "https://example.test"
  );
  assert.ok(first);
  assert.ok(second);
  assert.equal(second.revision, first.revision + 1);

  const etagFirst = `"${SERIAL}-${first.revision}"`;
  const etagSecond = `"${SERIAL}-${second.revision}"`;
  assert.notEqual(etagFirst, etagSecond);

  const record = getPassRecord(SERIAL);
  assert.ok(record);
  assert.equal(record.revision, second.revision);
});

test("fetching with the current ETag returns 304", async () => {
  const record = getPassRecord(SERIAL);
  assert.ok(record);
  const etag = `"${record.serialNumber}-${record.revision}"`;
  const res = await fetch(`${base}/v1/passes/${PASS_TYPE}/${SERIAL}`, {
    headers: {
      authorization: `ApplePass ${AUTH_TOKEN}`,
      "if-none-match": etag,
    },
  });
  assert.equal(res.status, 304);
  assert.equal(res.headers.get("etag"), etag);
});

test("a same-second update is never served as 304 to If-Modified-Since", async () => {
  // Simulate the losing sequence: the device fetched after update N and holds
  // the (second-truncated) Last-Modified; update N+1 lands in the same second.
  const record = getPassRecord(SERIAL);
  assert.ok(record);
  const heldLastModified = new Date(record.updatedAt).toUTCString();
  const next = updatePassSpec(
    SERIAL,
    JSON.stringify({ style: "generic", description: "Same second" }),
    "Same second",
    "https://example.test"
  );
  assert.ok(next);

  const res = await fetch(`${base}/v1/passes/${PASS_TYPE}/${SERIAL}`, {
    headers: {
      authorization: `ApplePass ${AUTH_TOKEN}`,
      "if-modified-since": heldLastModified,
    },
  });
  // The old comparison truncated to seconds and answered 304 here, losing the
  // update. Anything but 304 is correct; with dummy certs the rebuild then
  // fails, so the observable status is 500 rather than 200.
  assert.notEqual(res.status, 304);
});

test("after unregistering, the next poll returns 204", async () => {
  const res = await fetch(registrationUrl("device-a"), {
    method: "DELETE",
    headers: { authorization: `ApplePass ${AUTH_TOKEN}` },
  });
  assert.equal(res.status, 200);
  const next = await poll("device-a");
  assert.equal(next.status, 204);
});

// Runs last: it re-points the db module's singleton connection at a fresh
// directory, so every test above must already have finished with the old one.
test("initDb adds the revision column to a pre-existing database", () => {
  const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-migrate-"));
  const file = path.join(dataDir, "pocketful.sqlite");

  // Create the old schema — no revision column — with one row, as a
  // deployment that predates this migration would have on its volume.
  const old = new Database(file);
  old.exec(`
    CREATE TABLE passes (
      serial_number   TEXT PRIMARY KEY,
      auth_token      TEXT NOT NULL,
      web_service_url TEXT NOT NULL,
      spec_json       TEXT NOT NULL,
      description     TEXT NOT NULL,
      created_at      INTEGER NOT NULL,
      updated_at      INTEGER NOT NULL
    );
  `);
  old
    .prepare(
      `INSERT INTO passes VALUES ('old-serial', 'tok', 'https://example.test', '{}', 'Old pass', 1, 2)`
    )
    .run();
  old.close();

  initDb(dataDir);
  const record = getPassRecord("old-serial");
  assert.ok(record, "pre-existing row survived the migration");
  assert.equal(record.revision, 0);
  assert.equal(record.authToken, "tok");
  assert.equal(record.createdAt, 1);
  assert.equal(record.updatedAt, 2);

  // Idempotent: a second initDb against the migrated file must not throw.
  initDb(dataDir);
  assert.ok(getPassRecord("old-serial"));
});
