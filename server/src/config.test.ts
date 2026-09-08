import assert from "node:assert/strict";
import { beforeEach, test } from "node:test";
import { loadConfig } from "./config";

const PEM = Buffer.from("-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----\n").toString("base64");

beforeEach(() => {
  for (const name of Object.keys(process.env)) {
    if (/^(PASS_TYPE_IDENTIFIER|TEAM_IDENTIFIER|API_TOKEN|WWDR_CERT_BASE64|SIGNER_CERT_BASE64|SIGNER_KEY_BASE64|APNS_|HARK_)/.test(name)) {
      delete process.env[name];
    }
  }
  Object.assign(process.env, {
    PASS_TYPE_IDENTIFIER: "pass.test.pocketful",
    TEAM_IDENTIFIER: "TESTTEAM01",
    API_TOKEN: "token",
    WWDR_CERT_BASE64: PEM,
    SIGNER_CERT_BASE64: PEM,
    SIGNER_KEY_BASE64: PEM,
  });
});

test("Hark is absent when neither variable is set", () => {
  assert.equal(loadConfig().hark, undefined);
});

test("HARK_URL without HARK_TOKEN is refused", () => {
  process.env.HARK_URL = "https://hark.example";
  assert.throws(loadConfig, /HARK_URL and HARK_TOKEN must be set together/);
});

test("HARK_TOKEN without HARK_URL is refused", () => {
  process.env.HARK_TOKEN = "secret";
  assert.throws(loadConfig, /HARK_URL and HARK_TOKEN must be set together/);
});

test("a trailing slash on HARK_URL is stripped", () => {
  process.env.HARK_URL = "https://hark.example/";
  process.env.HARK_TOKEN = "secret";
  assert.deepEqual(loadConfig().hark, { url: "https://hark.example", token: "secret" });
});
