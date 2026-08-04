import assert from "node:assert/strict";
import { test } from "node:test";
import { deletePassesForSerial, getPass, putPass, storeStats } from "./store";
import { ApiError } from "./validate";

// The store is module-level state shared by every test in this file, so each
// test tags its entries with a serial and purges them before finishing; the
// empty-store assertions at the start of each test enforce that hygiene.
const BUDGET = 128 * 1024 * 1024;
const MB = 1024 * 1024;

test("put then get returns the same buffer and filename", () => {
  assert.equal(storeStats().entries, 0);
  const buffer = Buffer.from("hello pass");
  const { id, expiresAt } = putPass(buffer, "test.pkpass", 60, BUDGET, "t1");
  assert.ok(expiresAt > Date.now());
  const entry = getPass(id);
  assert.ok(entry);
  assert.equal(entry.buffer, buffer);
  assert.equal(entry.filename, "test.pkpass");
  assert.equal(deletePassesForSerial("t1"), 1);
});

test("get with an unknown id returns undefined", () => {
  assert.equal(getPass("not-a-real-id"), undefined);
});

test("an entry past its TTL returns undefined", () => {
  const { id } = putPass(Buffer.from("stale"), "stale.pkpass", -1, BUDGET);
  assert.equal(getPass(id), undefined);
});

test("byte accounting tracks puts and expiry deletes", () => {
  assert.equal(storeStats().bytes, 0);
  const buffer = Buffer.alloc(1234);
  const { id } = putPass(buffer, "counted.pkpass", 0, BUDGET);
  assert.equal(storeStats().bytes, 1234);
  assert.equal(storeStats().entries, 1);
  // ttl 0 means the entry is already expired; the read deletes it.
  assert.equal(getPass(id), undefined);
  assert.equal(storeStats().bytes, 0);
  assert.equal(storeStats().entries, 0);
});

test("eviction keeps the newest entries that fit and stays under budget", () => {
  assert.equal(storeStats().bytes, 0);
  const budget = 2 * MB;
  const ids: string[] = [];
  for (let i = 0; i < 3; i++) {
    ids.push(putPass(Buffer.alloc(MB, i), `p${i}.pkpass`, 60, budget, "evict").id);
    assert.ok(storeStats().bytes <= budget);
  }
  // The third put evicted the oldest; the two newest 1 MB entries remain.
  assert.equal(getPass(ids[0]), undefined);
  assert.ok(getPass(ids[1]));
  assert.ok(getPass(ids[2]));
  assert.equal(storeStats().entries, 2);
  // The invariant that catches an unpaired totalBytes update: accounted bytes
  // equal the sum of every buffer still retrievable.
  const liveBytes = ids
    .map((id) => getPass(id)?.buffer.byteLength ?? 0)
    .reduce((a, b) => a + b, 0);
  assert.equal(storeStats().bytes, liveBytes);
  assert.equal(deletePassesForSerial("evict"), 2);
  assert.equal(storeStats().bytes, 0);
});

test("eviction removes the oldest entry first", () => {
  assert.equal(storeStats().bytes, 0);
  const budget = 3 * MB;
  const first = putPass(Buffer.alloc(MB), "a.pkpass", 60, budget, "order").id;
  const second = putPass(Buffer.alloc(MB), "b.pkpass", 60, budget, "order").id;
  const third = putPass(Buffer.alloc(2 * MB), "c.pkpass", 60, budget, "order").id;
  assert.equal(getPass(first), undefined);
  assert.ok(getPass(second));
  assert.ok(getPass(third));
  assert.equal(deletePassesForSerial("order"), 2);
});

test("a buffer larger than the budget throws 503 and leaves stats untouched", () => {
  assert.equal(storeStats().bytes, 0);
  const keep = putPass(Buffer.alloc(100), "keep.pkpass", 60, BUDGET, "keep").id;
  const before = storeStats();
  assert.throws(
    () => putPass(Buffer.alloc(2 * MB), "huge.pkpass", 60, MB),
    (err: unknown) => err instanceof ApiError && err.status === 503
  );
  assert.deepEqual(storeStats(), before);
  assert.ok(getPass(keep));
  assert.equal(deletePassesForSerial("keep"), 1);
});

test("deletePassesForSerial removes only matching entries and returns the count", () => {
  assert.equal(storeStats().bytes, 0);
  const a1 = putPass(Buffer.alloc(10), "a1.pkpass", 60, BUDGET, "serial-a").id;
  const a2 = putPass(Buffer.alloc(20), "a2.pkpass", 60, BUDGET, "serial-a").id;
  const b = putPass(Buffer.alloc(30), "b.pkpass", 60, BUDGET, "serial-b").id;
  const untagged = putPass(Buffer.alloc(40), "u.pkpass", 60, BUDGET).id;
  assert.equal(deletePassesForSerial("serial-a"), 2);
  assert.equal(getPass(a1), undefined);
  assert.equal(getPass(a2), undefined);
  assert.ok(getPass(b));
  assert.ok(getPass(untagged));
  assert.equal(storeStats().bytes, 70);
  assert.equal(deletePassesForSerial("serial-b"), 1);
  assert.equal(deletePassesForSerial("serial-b"), 0);
  // Drain the untagged entry via a budget-filling put so the file leaves the
  // store empty: an insert whose budget is its own size evicts everything older.
  const drain = putPass(Buffer.alloc(64), "drain.pkpass", 60, 64, "drain").id;
  assert.ok(getPass(drain));
  assert.equal(deletePassesForSerial("drain"), 1);
  assert.equal(storeStats().entries, 0);
  assert.equal(storeStats().bytes, 0);
});
