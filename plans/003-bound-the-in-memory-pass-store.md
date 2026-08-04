# Plan 003: Put a byte ceiling on the in-memory pass store and purge deleted passes from it

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f0dc115..HEAD -- server/src/store.ts server/src/index.ts server/src/config.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (recommended — gives you a test runner to verify with)
- **Category**: bug
- **Planned at**: commit `f0dc115`, 2026-08-04

## Why this matters

Every signed `.pkpass` the server produces is held in a plain in-memory `Map`
for 15 minutes so the app can download it. There is no cap on how many entries
that Map holds and no cap on total bytes. The validator allows 24 MB of images
per pass, and `passkit-generator` builds an uncompressed archive, so a single
entry can be roughly 24–30 MB resident.

A client holding the API token can therefore pin hundreds of megabytes in a
single Railway container simply by creating passes. When the container hits its
memory ceiling the process is killed and restarted — and because this Map is
the *only* copy of a non-updatable pass, every pending download link created by
every other user dies at the same moment. It is the most likely hard-failure
mode in the service.

A second, smaller problem shares this file: `DELETE /api/passes/:serial` removes
a pass from the database but leaves any already-minted download link intact, so
a deleted pass stays downloadable for up to the remaining 15 minutes.

## Current state

`server/src/store.ts` in full today (37 lines):

```ts
import { randomUUID } from "node:crypto";

interface StoredPass {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
}

const passes = new Map<string, StoredPass>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of passes) {
    if (entry.expiresAt <= now) passes.delete(id);
  }
}, 60_000).unref();

export function putPass(
  buffer: Buffer,
  filename: string,
  ttlSeconds: number
): { id: string; expiresAt: number } {
  const id = randomUUID();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  passes.set(id, { buffer, filename, expiresAt });
  return { id, expiresAt };
}

export function getPass(id: string): StoredPass | undefined {
  const entry = passes.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    passes.delete(id);
    return undefined;
  }
  return entry;
}
```

Note that `getPass` already handles expiry correctly on read — the 60-second
sweeper is only a memory-reclaim optimization. Eviction is the missing piece,
not expiry.

The two call sites of `putPass`, both in `server/src/index.ts`:

- Line 100, inside `POST /api/passes`:
  ```ts
  const filename = passFilename(spec.description);
  const { id, expiresAt } = putPass(buffer, filename, config.passTtlSeconds);
  ```
- Line 201, inside `POST /api/passes/:serialNumber/download` (minting a fresh
  link for a stored updatable pass), the same shape.

The delete route, `server/src/index.ts:162-168`:

```ts
app.delete("/api/passes/:serialNumber", (req, res) => {
  requireApiToken(req);
  if (!deletePassRecord(req.params.serialNumber)) {
    throw new ApiError(404, "No updatable pass with that serial number");
  }
  res.json({ ok: true });
});
```

`server/src/config.ts` reads all tunables from the environment with the pattern
at line 55:

```ts
    passTtlSeconds: Number(process.env.PASS_TTL_SECONDS) || 900,
```

and the `Config` interface documents each field with a `/** ... */` comment
(lines 1–24). Match both conventions.

Errors are raised with `ApiError` from `server/src/validate.ts`; the error
middleware at `server/src/index.ts:230-248` turns an `ApiError` into
`{ error: message }` with its status.

Repo conventions in `server/`: double quotes, 2-space indent, semicolons, named
exports, `/** ... */` doc comments on exported symbols.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `cd server && ./node_modules/.bin/tsc --noEmit` | exit 0 |
| Tests | `cd server && bun run test` | all pass |
| Build | `cd server && bun run build` | exit 0 |

If plan 001 has not landed, `bun run test` will not exist. In that case write
the test file anyway and run it directly with
`cd server && node --import tsx --test src/store.test.ts`, and say so in your
report.

## Scope

**In scope**:

- `server/src/store.ts`
- `server/src/store.test.ts` (create)
- `server/src/index.ts` — only the `DELETE` route and the two `putPass` call
  sites, to pass and use a serial tag
- `server/src/config.ts` — one new optional config field

**Out of scope** (do NOT touch):

- `server/src/validate.ts` image limits — the 4 MB/24 MB caps stay as they are;
  this plan bounds the *store*, not the input.
- `server/src/db.ts` — the SQLite layer is not involved.
- `server/src/webService.ts` — the device-facing rebuild path does not use this
  store. Caching rebuilt passes is a different, larger change (see Maintenance
  notes); do not start it here.
- The 60-second sweeper interval — leave it alone; with eviction in place the
  sweeper's laziness stops mattering.

## Git workflow

- Branch: `advisor/003-store-cap`
- Commit style: short imperative subjects, e.g. `Cap the in-memory pass store`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add the budget to config

In `server/src/config.ts`, add to the `Config` interface, with a doc comment
matching the surrounding style:

```ts
  /** Byte ceiling for the in-memory signed-pass store. Oldest entries evict first. */
  passStoreMaxBytes: number;
```

and in the returned object, next to `passTtlSeconds`:

```ts
    passStoreMaxBytes:
      Number(process.env.PASS_STORE_MAX_BYTES) || 128 * 1024 * 1024,
```

128 MB is roughly four maximum-size passes and is a deliberate default: large
enough that normal use never evicts, small enough to sit well under a typical
Railway container limit.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 2: Track total bytes and evict oldest-first in `store.ts`

Rewrite `server/src/store.ts` to keep a running byte total and evict in
insertion order when a new entry would exceed the budget. A `Map` preserves
insertion order, so the first key from `passes.keys()` is the oldest entry —
no separate LRU structure is needed.

The shape to produce:

- Add `serialNumber?: string` to `StoredPass` so deleted updatable passes can
  be purged (used in step 4).
- Keep a module-level `let totalBytes = 0`.
- `putPass(buffer, filename, ttlSeconds, serialNumber?)`:
  - Reject outright if `buffer.byteLength > budget` — throw
    `new ApiError(503, "Pass is too large to serve")`. Import `ApiError` from
    `./validate`.
  - While `totalBytes + buffer.byteLength > budget` and the Map is non-empty,
    delete the oldest entry and subtract its size.
  - Insert, add to `totalBytes`.
- `getPass` — subtract from `totalBytes` on the expiry-delete path it already has.
- The sweeper — subtract from `totalBytes` for each entry it deletes.
- Export `deletePassesForSerial(serialNumber: string): number` that deletes
  every entry whose `serialNumber` matches, adjusts `totalBytes`, and returns
  the count.
- Export `storeStats(): { entries: number; bytes: number }` for tests.

The budget must come from config rather than being a module constant, because
`store.ts` currently imports nothing from config. The simplest approach that
does not restructure the module: pass the budget in as a parameter to
`putPass`, alongside `ttlSeconds`. Prefer that over importing `loadConfig()`
into `store.ts` — `loadConfig()` is called once at startup in `index.ts:19` and
calling it again would re-read the environment.

Every mutation of `totalBytes` must be paired with the corresponding Map
mutation. Getting this wrong produces a slow leak that no test catches unless
you assert `storeStats().bytes` against the sum of live entries — do that in
step 3.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 3: Test the store

Create `server/src/store.test.ts` using `node:test` and `node:assert/strict`,
following the structure established by `server/src/validate.test.ts` if plan
001 has landed.

Cover:

- put then get returns the same buffer and filename
- get with an unknown id returns `undefined`
- an entry past its TTL returns `undefined` (pass a `ttlSeconds` of `0` or a
  negative value rather than waiting)
- **byte accounting**: after a put, `storeStats().bytes` equals the buffer
  length; after the entry expires and is read, it returns to 0
- **eviction**: with a small budget, inserting three 1 MB buffers into a 2 MB
  budget leaves exactly the newest entries that fit, and `storeStats().bytes`
  never exceeds the budget
- **eviction order**: the *oldest* entry is the one evicted
- a single buffer larger than the budget throws `ApiError` with status 503 and
  does not change `storeStats()`
- `deletePassesForSerial` removes only matching entries and returns the count
- after any sequence of operations, `storeStats().bytes` equals the sum of the
  lengths of all buffers still retrievable via `getPass` — assert this
  explicitly at the end of the eviction test; it is what catches an unpaired
  `totalBytes` update

**Verify**: `cd server && bun run test` → all pass, including the new store tests.

### Step 4: Tag entries with their serial and purge on delete

In `server/src/index.ts`:

- At line ~201 in `POST /api/passes/:serialNumber/download`, pass
  `record.serialNumber` as the new `serialNumber` argument to `putPass`.
- At line ~100 in `POST /api/passes`, pass `serialNumber` (the variable already
  declared at line 55 — it is `undefined` for non-updatable passes, which is
  correct).
- Both call sites must now also pass `config.passStoreMaxBytes`.
- In the `DELETE /api/passes/:serialNumber` route, after `deletePassRecord`
  succeeds, call `deletePassesForSerial(req.params.serialNumber)` so minted
  links for the deleted pass stop working immediately. Import it from `./store`
  alongside the existing `getPass, putPass` import at line 14.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run test && bun run build` → all exit 0.

### Step 5: Document the new variable

Add `PASS_STORE_MAX_BYTES` to the environment-variable table in
`INSTRUCTIONS.md` (find it with `grep -n "PASS_TTL_SECONDS" INSTRUCTIONS.md`),
marked optional with its default. Match the table's existing formatting.

**Verify**: `grep -n "PASS_STORE_MAX_BYTES" INSTRUCTIONS.md` → one match.

## Test plan

- New file: `server/src/store.test.ts`, covering the cases listed in step 3.
- Model after `server/src/validate.test.ts` (from plan 001) if it exists;
  otherwise it is `node:test` + `node:assert/strict` with no framework.
- Verification: `cd server && bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd server && ./node_modules/.bin/tsc --noEmit` exits 0
- [ ] `cd server && bun run test` exits 0, including the new store tests
- [ ] `cd server && bun run build` exits 0
- [ ] `grep -n "totalBytes" server/src/store.ts` shows the accounting exists
- [ ] `grep -n "deletePassesForSerial" server/src/index.ts` shows the delete
      route purges minted links
- [ ] `grep -n "PASS_STORE_MAX_BYTES" server/src/config.ts INSTRUCTIONS.md`
      returns a match in each
- [ ] `git status --porcelain` shows no files outside the in-scope list
- [ ] `plans/README.md` status row for 003 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `server/src/store.ts` does not match the "Current state" excerpt above.
- Importing `ApiError` from `./validate` into `./store` creates a circular
  import that `tsc` or the runtime complains about. (It should not —
  `validate.ts` does not import `store.ts` — but verify rather than assume. If
  it does, define a local error class in `store.ts` and map it in the route.)
- You find a third `putPass` call site beyond the two named above.
- The byte-accounting assertion in step 3 fails and the cause is not obvious
  after one fix attempt.

## Maintenance notes

- **Deliberately not done here**: caching *rebuilt* passes. Every device
  refresh calls `rebuildStoredPass` (`server/src/updatable.ts:12`), which
  re-parses the spec, re-validates it, re-decodes every image, and re-signs —
  synchronously, on the event loop. Memoizing that on
  `${serialNumber}:${updatedAt}` would be a real win and would naturally reuse
  this store's budget, but it needs its own invalidation story and belongs in
  its own plan. This plan's byte accounting is the groundwork for it.
- **If a queue or a second replica is ever added**, this store stops working —
  it is per-process, so a download link minted by one replica 404s on another.
  That is the point at which buffers should spill to `DATA_DIR` instead.
- **What a reviewer should scrutinize**: every `passes.delete(...)` and
  `passes.set(...)` has a matching `totalBytes` adjustment. That invariant is
  the whole plan.
- Eviction is oldest-first by insertion, not by last access. For 15-minute
  single-download links that is the right approximation; do not add access-time
  tracking without a reason.
