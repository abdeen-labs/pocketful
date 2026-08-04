import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { mkdtempSync } from "node:fs";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import type { Server } from "node:http";
import type { Config } from "./config";
import { initDb } from "./db";
import { createApp } from "./index";

// Plan 004's verification matrix: middleware ordering is the one thing
// typechecking cannot confirm, so every row runs against the real app over
// HTTP. Signing needs real certificates, so the "pass creates" row asserts
// 422 — the request cleared auth and both body parsers and failed only at
// the signing step, which is exactly what this plan changes.

const API_TOKEN = "test-api-token";
const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function testConfig(dataDir: string): Config {
  return {
    port: 0,
    passTypeIdentifier: "pass.test.pocketful",
    teamIdentifier: "TESTTEAM01",
    organizationName: "Pocketful Tests",
    apiToken: API_TOKEN,
    passTtlSeconds: 900,
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
  const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-intake-"));
  initDb(dataDir);
  const app = createApp(testConfig(dataDir));
  server = app.listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

after(() => {
  server.close();
});

test("health stays open", async () => {
  const res = await fetch(`${base}/healthz`);
  assert.equal(res.status, 200);
});

test("the pass list requires a token", async () => {
  const res = await fetch(`${base}/api/passes`);
  assert.equal(res.status, 401);
});

test("the pass list works with the token", async () => {
  const res = await fetch(`${base}/api/passes`, {
    headers: { authorization: `Bearer ${API_TOKEN}` },
  });
  assert.equal(res.status, 200);
});

test("a wrong token is rejected", async () => {
  const res = await fetch(`${base}/api/passes`, {
    headers: { authorization: "Bearer wrong" },
  });
  assert.equal(res.status, 401);
});

test("the download route stays open — 404, not 401", async () => {
  const res = await fetch(`${base}/api/passes/does-not-exist`);
  assert.equal(res.status, 404);
});

test("the stored-spec route is not swept into the download exemption", async () => {
  const res = await fetch(`${base}/api/passes/some-serial/spec`);
  assert.equal(res.status, 401);
});

test("an unauthenticated pass creation is rejected without parsing", async () => {
  // The body is far over the 100kb default limit; only the auth middleware
  // running before any parser can produce a 401 here rather than a 413.
  const res = await fetch(`${base}/api/passes`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ pad: "a".repeat(200_000) }),
  });
  assert.equal(res.status, 401);
});

test("a big body to the log sink is refused", async () => {
  const res = await fetch(`${base}/v1/log`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ logs: ["a".repeat(200_000)] }),
  });
  assert.equal(res.status, 413);
});

test("a normal log callback still returns 200", async () => {
  const res = await fetch(`${base}/v1/log`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ logs: ["Wallet refreshed the pass"] }),
  });
  assert.equal(res.status, 200);
});

test("an authed multi-megabyte pass body clears both parsers", async () => {
  // ~2 MB of padding — over the 100kb default, under the artwork limit. A 413
  // means the body-limit split regressed; 422 means signing (dummy certs) was
  // the only thing that failed, i.e. auth and both parsers passed.
  const spec = {
    style: "generic",
    description: "Intake test pass",
    images: {
      icon: PNG_HEADER.toString("base64"),
      "icon@2x": Buffer.concat([PNG_HEADER, Buffer.alloc(2_000_000)]).toString(
        "base64"
      ),
    },
  };
  const res = await fetch(`${base}/api/passes`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${API_TOKEN}`,
    },
    body: JSON.stringify(spec),
  });
  assert.equal(res.status, 422);
  const body = (await res.json()) as { error: string };
  assert.match(body.error, /Failed to build pass/);
});

test("the public surface is rate limited after 120 requests in a minute", async () => {
  // A fresh app instance so this test's hammering cannot 429 the others.
  const dataDir = mkdtempSync(path.join(tmpdir(), "pocketful-ratelimit-"));
  initDb(dataDir);
  const app = createApp(testConfig(dataDir));
  const local = app.listen(0);
  await new Promise((resolve) => local.once("listening", resolve));
  const port = (local.address() as AddressInfo).port;
  try {
    let limited = 0;
    for (let i = 0; i < 121; i += 1) {
      const res = await fetch(`http://127.0.0.1:${port}/api/passes/nope`);
      if (res.status === 429) limited += 1;
    }
    assert.equal(limited, 1);
  } finally {
    local.close();
  }
});
