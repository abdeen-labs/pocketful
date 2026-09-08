import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { deliverPass } from "./hark";

const hark = { url: "https://hark.example", token: "hark-token" };
const PASS_URL = "https://pass.example/api/passes/abc";

const originalFetch = globalThis.fetch;

interface Captured {
  url: string;
  init: RequestInit;
}

function stubFetch(
  respond: (captured: Captured) => Response | Promise<Response>
): Captured[] {
  const calls: Captured[] = [];
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const captured = { url: String(input), init: init ?? {} };
    calls.push(captured);
    return respond(captured);
  }) as typeof fetch;
  return calls;
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("a 2xx from Hark counts as sent and carries the documented request", async () => {
  const calls = stubFetch(() =>
    Response.json(
      { notification: { id: "n1" }, accepted_count: 1, replayed: false, message: null },
      { status: 201 }
    )
  );
  const result = await deliverPass(hark, "Gym card", PASS_URL);
  assert.deepEqual(result, { sent: true });
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://hark.example/notifications");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(calls[0].init.headers, {
    Authorization: "Bearer hark-token",
    "Content-Type": "application/json",
  });
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    title: "Gym card",
    body: "Tap to add to Apple Wallet",
    pass_url: PASS_URL,
  });
  assert.ok(calls[0].init.signal instanceof AbortSignal);
});

test("a 2xx that no device accepted is a failed delivery carrying Hark's summary", async () => {
  stubFetch(() =>
    Response.json(
      { notification: { id: "n1" }, accepted_count: 0, message: "No device is registered." },
      { status: 201 }
    )
  );
  const result = await deliverPass(hark, "Gym card", PASS_URL);
  assert.deepEqual(result, { sent: false, error: "No device is registered." });
});

test("titles are cut to Hark's 80-character limit", async () => {
  const calls = stubFetch(() => Response.json({}, { status: 201 }));
  await deliverPass(hark, "x".repeat(120), PASS_URL);
  assert.equal(JSON.parse(String(calls[0].init.body)).title, "x".repeat(80));
});

test("a non-2xx response is a failed delivery carrying Hark's message", async () => {
  stubFetch(() =>
    Response.json(
      { error: { code: "validation_failed", message: "The request body is invalid." } },
      { status: 422 }
    )
  );
  const result = await deliverPass(hark, "Gym card", PASS_URL);
  assert.deepEqual(result, {
    sent: false,
    error: "Hark responded 422: The request body is invalid.",
  });
});

test("a non-2xx response without an error envelope reports the status alone", async () => {
  stubFetch(() => new Response("bad gateway", { status: 502 }));
  const result = await deliverPass(hark, "Gym card", PASS_URL);
  assert.deepEqual(result, { sent: false, error: "Hark responded 502" });
});

test("a thrown fetch is a failed delivery", async () => {
  stubFetch(() => {
    throw new TypeError("fetch failed");
  });
  const result = await deliverPass(hark, "Gym card", PASS_URL);
  assert.deepEqual(result, {
    sent: false,
    error: "Hark request failed: fetch failed",
  });
});

test("a timeout is reported as such", async () => {
  stubFetch(() => {
    throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
  });
  const result = await deliverPass(hark, "Gym card", PASS_URL);
  assert.deepEqual(result, {
    sent: false,
    error: "Hark request failed: timed out after 10s",
  });
});

test("nothing is sent when Hark is not configured", async () => {
  const calls = stubFetch(() => {
    throw new Error("fetch must not be called");
  });
  assert.equal(await deliverPass(undefined, "Gym card", PASS_URL), undefined);
  assert.equal(calls.length, 0);
});
