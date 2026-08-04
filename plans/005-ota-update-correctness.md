# Plan 005: Fix the two silent failures in over-the-air pass updates

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f0dc115..HEAD -- server/src/webService.ts server/src/db.ts server/src/index.ts server/src/apns.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: MED
- **Depends on**: 001 (required — this plan adds the route-test harness that
  001 deliberately deferred, and needs its test runner and scripts)
- **Category**: bug
- **Planned at**: commit `f0dc115`, 2026-08-04

## Why this matters

Over-the-air pass updates are the headline feature of this server: it
implements Apple's Wallet web service protocol so passes already installed on
someone's iPhone can be re-signed and pushed. Two bugs make that feature fail
*silently* — no error surfaces to the operator, and the pass in the user's
Wallet simply stops being correct.

**Bug 1 — updates inside the same second are lost forever.** The pass-fetch
route compares `If-Modified-Since` against a timestamp truncated to whole
seconds, while the device-polling route reports change times at full
millisecond precision. Two updates within the same wall-clock second produce
identical truncated timestamps: the polling route correctly tells the device
"this serial changed", the device fetches with `If-Modified-Since`, gets a 304,
records the new millisecond-precision `lastUpdated`, and never asks again. The
second update never reaches the device until some later, unrelated update
happens to bump the timestamp past the boundary.

**Bug 2 — a successful update reports as a server error.** `PUT` commits the
new spec to SQLite and *then* pushes to APNs. If the push throws — which it
does on the first call when the APNs key is malformed, because the client is
constructed lazily inside the push function and nothing validates the key at
startup — the route returns a generic 500. The client sees "Internal server
error" for an update that actually landed, and will likely retry, masking a
persistent APNs misconfiguration as an intermittent write failure.

## Current state

Relevant files:

- `server/src/webService.ts` — Apple's protocol router (133 lines).
- `server/src/db.ts` — SQLite layer; `listUpdatedSerials` at lines 193–214.
- `server/src/index.ts` — the `PUT` route at lines 116–160; `app.listen` at 250.
- `server/src/apns.ts` — the push path.

**Bug 1**, `server/src/webService.ts:90-119`:

```ts
  router.get("/v1/passes/:passTypeIdentifier/:serialNumber", (req, res) => {
    const record = authenticatedPass(req, config);
    // Last-Modified only carries second precision, so compare on seconds.
    const updatedSeconds = Math.floor(record.updatedAt / 1000);
    const ifModifiedSince = Date.parse(req.get("if-modified-since") ?? "");
    if (
      !Number.isNaN(ifModifiedSince) &&
      updatedSeconds * 1000 <= ifModifiedSince
    ) {
      res.status(304).send();
      return;
    }
```

and the header it sets at line 115:

```ts
        "Last-Modified": new Date(updatedSeconds * 1000).toUTCString(),
```

The counterpart at full precision, `server/src/db.ts:197-213`:

```ts
       WHERE r.device_library_id = ? AND p.updated_at > ?
```

```ts
  return {
    serialNumbers: rows.map((row) => row.serialNumber),
    lastUpdated: rows[rows.length - 1].updatedAt,
  };
```

**Bug 2**, `server/src/index.ts:145-159`:

```ts
    const updatedAt = updatePassSpec(
      record.serialNumber,
      JSON.stringify(req.body),
      validated.spec.description,
      webServiceURL
    );
    const push = await pushPassUpdate(config, record.serialNumber);
    res.json({
      serialNumber: record.serialNumber,
      updatedAt: new Date(updatedAt).toISOString(),
      push,
    });
  } catch (err) {
    next(err);
  }
```

`pushPassUpdate` already returns a structured result — read `server/src/apns.ts`
in full before starting; its result interface (around lines 8–14) has `sent`,
`failed`, `skipped`, and `pruned` fields. The fix reuses that shape rather than
inventing a new one.

Also relevant: `updatePassSpec` (`server/src/db.ts:97-112`) never inspects
`info.changes` and always returns a fresh `updatedAt`, so a `PUT` against a
serial deleted between the `getPassRecord` check and the update reports success.

The server's entry point today ends with `server/src/index.ts:250-252`:

```ts
app.listen(config.port, () => {
  console.log(`pocketful server listening on :${config.port}`);
});
```

Everything above it — `loadConfig()` at line 19, `initDb()` at line 20, and all
route registration — runs at module top level, which is why the app cannot be
imported by a test without starting a listener and requiring real certificates.

Repo conventions: double quotes, 2-space indent, semicolons, named exports,
`ApiError(status, message)`, `/** ... */` doc comments on exported symbols, and
comments that explain the protocol constraint rather than the code.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `cd server && ./node_modules/.bin/tsc --noEmit` | exit 0 |
| Tests | `cd server && bun run test` | all pass |
| Build | `cd server && bun run build` | exit 0 |
| Start (manual) | `cd server && bun run dev` | listens on :3000 |

## Scope

**In scope**:

- `server/src/index.ts` — extract `createApp(config)`; fix the `PUT` push path
- `server/src/webService.ts` — the pass-fetch route's freshness comparison
- `server/src/db.ts` — add a revision column and make `updatePassSpec` report
  whether a row changed
- `server/src/webservice.test.ts` (create)
- `server/src/apns.ts` — **only** to wrap client construction so a bad key
  surfaces as a structured failure rather than a throw

**Out of scope** (do NOT touch, even though they look related):

- The `authenticatedPass` helper (`server/src/webService.ts:17-29`). It is
  correct — timing-safe, no existence oracle. Do not modify it.
- The 201-vs-200 registration semantics, the 204-on-no-updates behavior, and the
  `ApplePass` header parsing. Apple dictates these; they are currently right.
  Write tests that pin them, but change nothing.
- `server/src/validate.ts` — plan 006 owns it.
- `server/src/store.ts` — plan 003 owns it.
- Do **not** change the wire format of `lastUpdated` in the device-polling
  response without reading the STOP conditions first. Devices store that value
  and send it back.

## Git workflow

- Branch: `advisor/005-ota-correctness`
- Commit style: short imperative subjects, e.g.
  `Serve a monotonic revision so same-second updates reach devices`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Extract `createApp(config)` so routes can be tested

Refactor `server/src/index.ts` so that everything from `const app = express()`
through the error middleware becomes:

```ts
export function createApp(config: Config): express.Express {
  const app = express();
  // ... all existing middleware and routes, unchanged ...
  return app;
}
```

`requireApiToken` and `requestOrigin` become inner functions (they close over
`config`) or take `config` as a parameter — either is fine, pick one and be
consistent.

Then guard the startup so importing the module does not start a server:

```ts
if (require.main === module) {
  const config = loadConfig();
  initDb(config.dataDir);
  if (!config.apns) {
    console.warn(
      "APNs is not configured (APNS_KEY_ID/APNS_KEY_BASE64) — updatable passes " +
        "will update only when iOS refreshes them on its own."
    );
  }
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`pocketful server listening on :${config.port}`);
  });
}
```

The module is CommonJS (`server/tsconfig.json` sets `"module": "commonjs"`), so
`require.main === module` is the correct idiom here.

This is a pure refactor: no behavior changes. **Do it as its own commit.**

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run build` → exit 0.
Then start it manually (`bun run dev` with the environment from
`INSTRUCTIONS.md`) and confirm it still listens and `GET /healthz` returns
`{"ok":true}`. A refactor that breaks startup is the worst possible outcome
here — verify it before moving on.

### Step 2: Add a monotonic revision to the pass record

Truncating a timestamp to seconds is the root cause of bug 1, and no comparison
on that truncated value can be made correct. Replace freshness-by-timestamp
with freshness-by-revision.

In `server/src/db.ts`:

- Add `revision INTEGER NOT NULL DEFAULT 0` to the `passes` table in the
  `CREATE TABLE IF NOT EXISTS` block (line 49). Because the table is created
  with `IF NOT EXISTS`, an existing deployment's table will **not** gain the
  column. Add an explicit migration immediately after the `db.exec(...)` block:

  ```ts
  // Additive migration: existing deployments predate the revision column.
  const columns = db.prepare(`PRAGMA table_info(passes)`).all() as {
    name: string;
  }[];
  if (!columns.some((column) => column.name === "revision")) {
    db.exec(`ALTER TABLE passes ADD COLUMN revision INTEGER NOT NULL DEFAULT 0`);
  }
  ```

  This matters: the production database lives on a mounted Railway volume and
  already has rows.
- Add `revision: number` to the `PassRecord` interface and to the `SELECT` in
  `getPassRecord`.
- In `updatePassSpec`, bump the revision and report whether a row changed:

  ```ts
  export function updatePassSpec(
    serialNumber: string,
    specJson: string,
    description: string,
    webServiceURL: string
  ): { updatedAt: number; revision: number } | undefined {
    const updatedAt = Date.now();
    const info = conn()
      .prepare(
        `UPDATE passes
         SET spec_json = ?, description = ?, web_service_url = ?,
             updated_at = ?, revision = revision + 1
         WHERE serial_number = ?`
      )
      .run(specJson, description, webServiceURL, updatedAt, serialNumber);
    if (info.changes === 0) return undefined;
    const row = conn()
      .prepare(`SELECT revision FROM passes WHERE serial_number = ?`)
      .get(serialNumber) as { revision: number } | undefined;
    return row ? { updatedAt, revision: row.revision } : undefined;
  }
  ```

- Update the `PUT` route in `server/src/index.ts` to handle `undefined` by
  throwing `new ApiError(404, "No updatable pass with that serial number")` —
  that is the race where the pass was deleted between the lookup and the write.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0. Fix any
call sites `tsc` flags; the return type changed from `number` to an object.

### Step 3: Serve an ETag instead of comparing truncated timestamps

In `server/src/webService.ts`, replace the `If-Modified-Since` comparison with
an `ETag`/`If-None-Match` comparison keyed on the revision:

```ts
  router.get("/v1/passes/:passTypeIdentifier/:serialNumber", (req, res) => {
    const record = authenticatedPass(req, config);
    // Freshness is keyed on a monotonic revision, not on Last-Modified:
    // HTTP dates carry only second precision, so two updates inside one second
    // would otherwise be indistinguishable and the second would never ship.
    const etag = `"${record.serialNumber}-${record.revision}"`;
    if (req.get("if-none-match") === etag) {
      res.status(304).set({ ETag: etag }).send();
      return;
    }
```

and in the success response headers, keep `Last-Modified` (Apple's clients read
it) but add the ETag:

```ts
      .set({
        "Content-Type": "application/vnd.apple.pkpass",
        ETag: etag,
        "Last-Modified": new Date(record.updatedAt).toUTCString(),
        "Cache-Control": "no-store",
      })
```

Note `Last-Modified` now uses the untruncated `record.updatedAt`; `toUTCString()`
truncates to seconds for the wire format, which is correct — it is only the
*comparison* that must not be truncated.

Keep honoring `If-Modified-Since` as a fallback for a device that sends it
without an `If-None-Match`, but make the comparison strict (`<`, not `<=`) so a
same-second update is never treated as unchanged:

```ts
    const ifModifiedSince = Date.parse(req.get("if-modified-since") ?? "");
    if (!Number.isNaN(ifModifiedSince) && record.updatedAt < ifModifiedSince) {
      res.status(304).set({ ETag: etag }).send();
      return;
    }
```

The trade-off is explicit: a device sending only `If-Modified-Since` may now
re-download a pass it already has when the update landed in the same second as
its last fetch. Re-downloading unnecessarily is harmless; missing an update is
not.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 4: Report push failures instead of 500-ing a committed update

In `server/src/apns.ts`, wrap the lazy client construction and the token lookup
so neither throws out of `pushPassUpdate`. Return the existing result shape with
the failure recorded — read the file first and match its interface exactly.
Add an `error?: string` field if the shape has no way to express "the push
subsystem itself failed".

In `server/src/index.ts`'s `PUT` route, the push must not be able to turn a
committed update into a 500:

```ts
    const result = updatePassSpec(/* ... */);
    if (!result) {
      throw new ApiError(404, "No updatable pass with that serial number");
    }
    let push;
    try {
      push = await pushPassUpdate(config, record.serialNumber);
    } catch (err) {
      // The spec is already committed; a push failure must not read as a
      // failed update. Surface it in the response instead.
      console.error(
        `APNs push failed for ${record.serialNumber}:`,
        err instanceof Error ? err.message : err
      );
      push = {
        sent: 0,
        failed: 0,
        skipped: 0,
        error: "Push failed — the pass was updated but devices were not notified",
      };
    }
    res.json({
      serialNumber: record.serialNumber,
      updatedAt: new Date(result.updatedAt).toISOString(),
      revision: result.revision,
      push,
    });
```

Match the literal above to `apns.ts`'s actual `PushResult` fields — do not
invent field names.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run build` → exit 0.

### Step 5: Test the protocol

Create `server/src/webservice.test.ts`. `initDb` takes a `dataDir`
(`server/src/db.ts:34`), so use `node:fs`'s `mkdtempSync` under `node:os`'s
`tmpdir()` for a real, isolated SQLite file per test run — no mocking.

Signing needs real certificates, which tests do not have. Cover the routes that
do not sign:

- register a device → **201**
- re-register the same device with the same push token → **200**
- re-register with a *changed* push token → **200**, and the stored token is
  rotated (assert via `pushTokensForSerial`)
- wrong `passTypeIdentifier` → **401**
- missing `ApplePass` header → **401**
- bad `ApplePass` token → **401**
- unknown serial with a valid-looking token → **401** (not 404 — no existence oracle)
- poll with no changes → **204**
- poll after an update → the serial is listed and `lastUpdated` round-trips:
  feed the returned `lastUpdated` straight back as `passesUpdatedSince` and
  assert the next poll is **204**
- **the same-second regression**: create a pass, call `updatePassSpec` twice in
  immediate succession (no delay), and assert the revision incremented twice and
  the two ETags differ. This is the test that fails against the old code.
- unregister → the following poll is **204**

Drive the app by calling `createApp(config)` and listening on port 0:

```ts
const server = app.listen(0);
const port = (server.address() as AddressInfo).port;
// ...fetch(`http://127.0.0.1:${port}/v1/...`)
server.close();
```

Build the `Config` object directly in the test rather than calling
`loadConfig()` — that way no environment variables or real certificates are
needed for the non-signing routes. Give `certs` dummy buffers; they are only
read when a pass is actually built.

**Verify**: `cd server && bun run test` → all pass, including the new
web-service tests.

### Step 6: Confirm the migration works against an existing database

The revision column migration in step 2 is the riskiest part of this plan
because production has data on a mounted volume.

```bash
cd server
rm -rf /tmp/pocketful-migration-test && mkdir -p /tmp/pocketful-migration-test
git stash            # go back to the pre-change code
# start the server once with DATA_DIR=/tmp/pocketful-migration-test to create
# the old-schema database, create one updatable pass, then stop it
git stash pop        # return to your changes
# start again with the same DATA_DIR
```

Confirm the second startup does not throw, and that
`sqlite3 /tmp/pocketful-migration-test/pocketful.sqlite "PRAGMA table_info(passes)"`
lists a `revision` column while the pre-existing row is still present with
`revision = 0`.

If `sqlite3` is unavailable, assert the same thing from a small test that calls
`initDb` twice against the same directory — once with a table created without
the column (create it manually with `db.exec`), then again through `initDb`.
That is the more reliable form; prefer it.

**Verify**: the migration test passes and no data is lost.

## Test plan

- New file: `server/src/webservice.test.ts` covering the cases in step 5.
- A migration test (step 6) asserting `initDb` is idempotent and additive
  against a pre-existing table without the `revision` column.
- Model after `server/src/validate.test.ts` from plan 001.
- Verification: `cd server && bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd server && ./node_modules/.bin/tsc --noEmit` exits 0
- [ ] `cd server && bun run test` exits 0, including the new web-service tests
- [ ] `cd server && bun run build` exits 0
- [ ] `grep -n "export function createApp" server/src/index.ts` returns a match
- [ ] `grep -n "revision" server/src/db.ts server/src/webService.ts` returns
      matches in both
- [ ] `grep -n "Math.floor(record.updatedAt / 1000)" server/src/webService.ts`
      returns **no matches**
- [ ] A test exists that fails against the pre-change code for the same-second
      update case — state in your report how you confirmed that
- [ ] The migration test from step 6 passes
- [ ] `git status --porcelain` shows no files outside the in-scope list
- [ ] `plans/README.md` status row for 005 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live code.
- The `createApp` extraction in step 1 changes any observable behavior, or the
  server fails to start after it.
- You conclude that changing `lastUpdated`'s wire format is necessary. It is
  not, and it must not change: devices persist that value and send it back as
  `passesUpdatedSince`. The revision is an *addition*, not a replacement for
  the polling timestamp.
- `PRAGMA table_info` shows the migration did not apply, or an existing row is
  lost or altered beyond gaining `revision = 0`.
- You find that `apns.ts`'s result interface cannot express a subsystem failure
  without a breaking change to the response shape the MCP server or app parses.
  Report the conflict rather than guessing.

## Maintenance notes

- **The ETag format is `"<serial>-<revision>"`.** If a future change makes
  passes rebuildable in a way that differs for the same revision (a certificate
  rotation, a `passkit-generator` upgrade that changes output), devices holding
  a matching ETag will not re-fetch. If that ever matters, mix a build
  identifier into the ETag.
- **This plan does not add push observability.** After it, a failed push
  appears in the `PUT` response and in the logs, but nothing is persisted — so
  "did the update actually reach devices?" is still unanswerable after the fact.
  A `push_log` table is the natural follow-up and would reuse the revision
  added here as its key.
- **`createApp` unlocks route tests generally.** Plan 004's manual curl matrix
  becomes automatable once this lands; consider converting it.
- **What a reviewer should scrutinize**: the migration in step 2 (it runs
  against a live volume) and the strict-vs-non-strict comparison in step 3 (`<`
  rather than `<=` is deliberate and is the actual bug fix for the fallback
  path).
