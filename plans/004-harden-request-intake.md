# Plan 004: Harden the server's request intake — auth before parsing, bounded bodies, bounded device logs

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat ddbf5eb..HEAD -- server/src/index.ts server/src/webService.ts server/src/updatable.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: S
- **Risk**: LOW
- **Depends on**: 001 (recommended), 005 (landed — this plan's excerpts were
  refreshed against it)
- **Category**: security
- **Planned at**: commit `f0dc115`, 2026-08-04; excerpts and line numbers
  refreshed 2026-08-04 against `ddbf5eb` (plan 005's `createApp` extraction,
  revision/ETag freshness, and `server/src/webservice.test.ts`)

## Why this matters

The signing server is internet-facing. Four cheap gaps in how it accepts
requests combine into a denial-of-service surface that an unauthenticated
client can reach:

1. A single global `express.json({ limit: "40mb" })` applies to **every** route,
   including the unauthenticated ones. A 40 MB JSON body is buffered and parsed
   into roughly 3–4× that in heap before anything checks a credential.
2. The API-token check runs *inside* each handler, so it happens after the body
   has already been read and parsed.
3. `POST /v1/log` — an unauthenticated endpoint Apple's protocol requires — has
   no cap on how many lines it accepts, no cap on line length, and writes each
   caller-supplied line to stdout with newlines intact.
4. Nothing anywhere is rate limited.

Separately and cheaply fixed here: the API-token comparison is a plain string
`!==`, which short-circuits on the first differing byte, even though a
constant-time helper already exists in this codebase and is already used for
the other credential.

None of these require a sophisticated attacker. All of them are small fixes
with a clean verification story.

## Current state

Since plan 005 landed, the whole app lives inside
`export function createApp(config: Config)` (`server/src/index.ts:20`) and
startup is guarded by `require.main === module`. Everything this plan adds —
parsers, auth middleware, rate limiter — goes **inside `createApp`**, where
`config` is the function parameter rather than a module-level constant.

`server/src/index.ts:20-36` today:

```ts
export function createApp(config: Config): express.Express {
  const app = express();
  // Railway terminates TLS at its proxy; trust it so req.protocol is https.
  app.set("trust proxy", true);
  // 24 MB of decoded PNG data expands to roughly 32 MB when base64 encoded.
  app.use(express.json({ limit: "40mb" }));

  function requireApiToken(req: express.Request): void {
    const auth = req.get("authorization");
    if (auth !== `Bearer ${config.apiToken}`) {
      throw new ApiError(401, "Missing or invalid API token");
    }
  }

  function requestOrigin(req: express.Request): string {
    return config.publicBaseUrl ?? `${req.protocol}://${req.get("host")}`;
  }
```

`requireApiToken(req)` is then called as the **first line of each handler body**
— see `server/src/index.ts:43, 105, 111, 177, 186, 200`. The routes that need
a large body are only these two:

- `POST /api/passes` (line 42)
- `PUT /api/passes/:serialNumber` (line 109)

Every other route has a small body or none. The unauthenticated routes are
`GET /healthz` (line 38), `GET /api/passes/:id` (line 224, protected by a
`randomUUID()` id), and the whole `/v1` Wallet web service router (line 241).

`server/src/webService.ts:128-137` — the device log sink today:

```ts
  router.post("/v1/log", (req, res) => {
    const logs =
      typeof req.body === "object" && req.body !== null
        ? (req.body as { logs?: unknown }).logs
        : undefined;
    if (Array.isArray(logs)) {
      for (const line of logs) console.log(`[wallet-device] ${String(line)}`);
    }
    res.status(200).send();
  });
```

The constant-time comparison that already exists, `server/src/updatable.ts:21-26`:

```ts
/** Constant-time comparison of secrets of possibly different lengths. */
export function secretsMatch(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
```

It is already used for the per-pass `ApplePass` token at
`server/src/webService.ts:25`. The management token is the one that does not
use it.

The image size limits that should drive the body limit,
`server/src/validate.ts:62-64`:

```ts
const MAX_IMAGE_MEGABYTES = 4;
const MAX_IMAGE_BYTES = MAX_IMAGE_MEGABYTES * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;
```

Repo conventions in `server/`: double quotes, 2-space indent, semicolons, named
exports, `ApiError(status, message)` for client-visible failures, comments that
explain *why* rather than *what* (see the `trust proxy` comment above).

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install | `cd server && bun install` | exit 0 |
| Typecheck | `cd server && ./node_modules/.bin/tsc --noEmit` | exit 0 |
| Tests | `cd server && bun run test` | all pass |
| Build | `cd server && bun run build` | exit 0 |

## Scope

**In scope**:

- `server/src/index.ts` (middleware ordering, body limits, token comparison)
- `server/src/webService.ts` (the `/v1/log` handler only)
- `server/src/validate.ts` — **only** to export the existing
  `MAX_TOTAL_IMAGE_BYTES` constant if it is not already exported. Do not change
  its value or any validation rule.
- `server/package.json`, `server/bun.lock` (adding a rate limiter)

**Out of scope** (do NOT touch, even though they look related):

- The `ApplePass` authentication in `server/src/webService.ts:17-29`. It is
  already correct: timing-safe, and a missing serial and a bad token both
  return the same 401 so there is no existence oracle. Leave it exactly as is.
- `GET /v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier`
  (line 64) has no `ApplePass` header **by design** — Apple's protocol defines
  it that way and the comment at line 63 says so. Do not add auth to it. The
  rate limiter in step 4 is the appropriate mitigation.
- `server/src/validate.ts` validation logic — plan 006 owns that.
- The `Host`-derived `webServiceURL` at line 42 — related but distinct; see
  plan 007.
- Do not change what `POST /api/passes` accepts. Passes that work today must
  still work.

## Git workflow

- Branch: `advisor/004-intake-hardening`
- Commit style: short imperative subjects, e.g.
  `Check the API token before parsing the body`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Use a constant-time comparison for the management token

In `server/src/index.ts`, import `secretsMatch` from `./updatable` (the file is
already imported at line 15 for `rebuildStoredPass` — extend that import) and
rewrite `requireApiToken`:

```ts
function requireApiToken(req: express.Request): void {
  const match = /^Bearer\s+(.+)$/i.exec(req.get("authorization") ?? "");
  if (!match || !secretsMatch(match[1], config.apiToken)) {
    throw new ApiError(401, "Missing or invalid API token");
  }
}
```

`secretsMatch` hashes both inputs before comparing, so differing lengths are
safe.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 2: Shrink the global body limit and apply the large one per-route

Replace the global parser at line 25 with a small default, and add a large
parser only to the two routes that carry base64 artwork.

```ts
// Only the two pass-authoring routes carry base64 artwork; everything else
// (device registration, log callbacks, health) sends a few hundred bytes.
const smallJson = express.json({ limit: "100kb" });
// 24 MB of decoded PNG data expands to roughly 32 MB when base64 encoded.
const passJson = express.json({
  limit: Math.ceil((MAX_TOTAL_IMAGE_BYTES * 4) / 3) + 1024 * 1024,
});

app.use(smallJson);
```

Import `MAX_TOTAL_IMAGE_BYTES` from `./validate`, exporting it there if it is
not already exported (`export const MAX_TOTAL_IMAGE_BYTES = ...`). Deriving the
limit from the validator's own constant means the two can never drift.

Then add `passJson` as route-level middleware on the two large routes only:

```ts
app.post("/api/passes", passJson, (req, res) => {
```

```ts
app.put("/api/passes/:serialNumber", passJson, async (req, res, next) => {
```

Express runs route-level middleware after the global `smallJson`. A body larger
than 100kb will already have been rejected by the global parser before
`passJson` runs — so `smallJson` must **skip** these two paths rather than
reject them. The simplest correct form: mount the global parser with a path
filter, or give `smallJson` a `type` guard. Prefer explicitness — replace
`app.use(smallJson)` with per-route application, or use:

```ts
app.use((req, res, next) => {
  if (req.method === "POST" && req.path === "/api/passes") return next();
  if (req.method === "PUT" && req.path.startsWith("/api/passes/")) return next();
  return smallJson(req, res, next);
});
```

Whichever form you choose, you **must** verify with step 6's manual checks that
a normal pass creation still succeeds and that a 1 MB body to `/v1/log` is
rejected. Do not guess at Express middleware ordering — test it.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run build` → exit 0.

### Step 3: Check the token before the body is parsed on `/api/*`

Move authentication ahead of the body parser for the management API. Add,
*before* the body-parser middleware:

```ts
// Authenticate before any body is buffered: /api/passes accepts megabytes.
app.use("/api", (req, res, next) => {
  // The signed-pass download link is authenticated by its unguessable id.
  if (req.method === "GET" && /^\/passes\/[^/]+$/.test(req.path)) return next();
  requireApiToken(req);
  next();
});
```

Two things make this subtle and you must get both right:

- `GET /api/passes/:id` (the download route, `index.ts:224`) is deliberately
  unauthenticated — the app downloads from it and the `randomUUID()` id is the
  credential. The regex above exempts it. But `GET /api/passes` (the list
  route, line 104) **must stay authenticated** — note the regex requires a
  path segment after `/passes`, so bare `/api/passes` is not exempt. Verify
  this distinction holds; getting it backwards exposes the pass list.
- `GET /api/passes/:serialNumber/spec` has two segments and so is **not**
  exempted by that regex, which is correct — it must stay authenticated.

`requireApiToken` throws `ApiError`, and Express 4 propagates a synchronous
throw from middleware to the error handler, so no try/catch is needed here.

Leave the existing in-handler `requireApiToken(req)` calls in place. They are
now redundant but harmless, and removing them in the same change makes the
diff harder to review. Note the redundancy in your report.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 4: Rate limit the public surface

Add `express-rate-limit`:

```bash
cd server && bun add express-rate-limit
```

Apply it to the Wallet web service router and to `/api`, before the routes:

```ts
import rateLimit from "express-rate-limit";

const limiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: "draft-7",
  legacyHeaders: false,
});
app.use("/v1", limiter);
app.use("/api", limiter);
```

Do **not** rate limit `/healthz` — the Docker `HEALTHCHECK`
(`server/Dockerfile:35-36`) polls it every 30 seconds and Railway may poll it
too.

Note: `app.set("trust proxy", true)` at line 23 trusts every hop, which means
`req.ip` is taken from a client-suppliable `X-Forwarded-For` and the rate limit
can be evaded by spoofing it. Fixing that properly means setting a specific hop
count and is bundled into plan 007. Add a comment saying so:

```ts
// NOTE: `trust proxy: true` means req.ip comes from X-Forwarded-For, which a
// client can spoof. Tightening that to a hop count is plan 007.
```

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run build` → exit 0.

### Step 5: Bound the device log sink

Rewrite the `/v1/log` handler in `server/src/webService.ts`:

```ts
  // Apple's device log callback. Unauthenticated by protocol design, so treat
  // every line as hostile: bounded count, bounded length, control characters
  // stripped so a caller cannot forge log lines.
  const MAX_LOG_LINES = 50;
  const MAX_LOG_LINE_CHARS = 500;

  router.post("/v1/log", (req, res) => {
    const logs =
      typeof req.body === "object" && req.body !== null
        ? (req.body as { logs?: unknown }).logs
        : undefined;
    if (Array.isArray(logs)) {
      const lines = logs
        .slice(0, MAX_LOG_LINES)
        .map((line) =>
          String(line)
            // eslint-disable-next-line no-control-regex
            .replace(/[ -]/g, " ")
            .slice(0, MAX_LOG_LINE_CHARS)
        );
      if (lines.length) {
        console.log(JSON.stringify({ source: "wallet-device", lines }));
      }
    }
    res.status(200).send();
  });
```

Emitting one structured JSON record instead of interpolating each line into its
own `console.log` is the part that actually defeats log forging — a caller
cannot inject a newline to fake a separate entry.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run build` → exit 0.

### Step 6: Verify the middleware ordering

Middleware ordering is the one thing here that typechecking cannot confirm.
**Preferred form (post-005): automate this matrix as route tests against
`createApp(config)`** — see the test plan below for the pattern and the one
row that needs adjusting. Run the manual form only as a supplement, or if the
automated tests cannot be written.

For the manual form, start the server against throwaway credentials — `INSTRUCTIONS.md` (search for
"without real certs") documents how to generate self-signed ones — then:

```bash
cd server && API_TOKEN=testtoken PASS_TYPE_IDENTIFIER=pass.test TEAM_IDENTIFIER=TESTTEAM01 \
  DATA_DIR=/tmp/pocketful-test bun run dev
```

(plus the three `*_BASE64` cert variables; `loadConfig` will name any that are
missing).

Confirm each of these against the running server:

| Check | Command | Expected |
|---|---|---|
| Health is open | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/healthz` | `200` |
| List needs auth | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/passes` | `401` |
| List works with auth | `curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer testtoken' localhost:3000/api/passes` | `200` |
| Wrong token rejected | `curl -s -o /dev/null -w '%{http_code}' -H 'Authorization: Bearer wrong' localhost:3000/api/passes` | `401` |
| Download route stays open | `curl -s -o /dev/null -w '%{http_code}' localhost:3000/api/passes/does-not-exist` | `404`, not `401` |
| Big body to log is refused | `python3 -c "print('{\"logs\":[\"' + 'a'*200000 + '\"]}')" > /tmp/big.json && curl -s -o /dev/null -w '%{http_code}' -X POST -H 'Content-Type: application/json' --data-binary @/tmp/big.json localhost:3000/v1/log` | `413` |
| A real pass still creates | `POST /api/passes` with a valid small spec and a bearer token | `201` |

The last row is the one that matters most — if the body-limit split is wrong,
pass creation breaks and that is the product's core function. Build a minimal
spec from the accepted baseline in `server/src/validate.test.ts` (plan 001) or
from `INSTRUCTIONS.md`'s curl example.

Record the actual status codes you observed in your report.

## Test plan

- Extend `server/src/validate.test.ts` only if you exported
  `MAX_TOTAL_IMAGE_BYTES` — add a test asserting the derived body limit is at
  least `MAX_TOTAL_IMAGE_BYTES * 4 / 3`.
- **Plan 005 landed the `createApp(config)` factory, so step 6's matrix is now
  automatable.** Write route-level tests modeled on
  `server/src/webservice.test.ts` (real SQLite in a `mkdtempSync` dir, dummy
  cert buffers, `app.listen(0)`, plain `fetch`). Every row of the matrix is
  expressible that way **except** "a real pass still creates 201": with dummy
  certs, signing throws and a valid authed spec returns 422. Assert 422 in the
  automated test — it proves the request passed auth and both body parsers,
  which is what this plan changes — and confirm the literal 201 manually with
  real certificates if available.
- Add the new cases to `server/src/webservice.test.ts` or a sibling
  `intake.test.ts`; note `server/src/db.ts` holds a singleton connection, so a
  new file (own process under the node test runner) is the safer choice.
- `cd server && bun run test` must still pass, including the 14 web-service
  tests plan 005 added.

## Done criteria

ALL must hold:

- [ ] `cd server && ./node_modules/.bin/tsc --noEmit` exits 0
- [ ] `cd server && bun run test` exits 0
- [ ] `cd server && bun run build` exits 0
- [ ] `grep -n "secretsMatch" server/src/index.ts` returns a match
- [ ] `grep -n '"40mb"' server/src/index.ts` returns **no matches**
- [ ] `grep -n "express-rate-limit" server/package.json` returns a match
- [ ] `grep -n "MAX_LOG_LINES" server/src/webService.ts` returns a match
- [ ] Every row of step 6's table produced the expected status code — via
      automated route tests (preferred; 422 stands in for the 201 row) or the
      manual matrix — and the observed codes are recorded in your report
- [ ] `git status --porcelain` shows no files outside the in-scope list
- [ ] `plans/README.md` status row for 004 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Any excerpt in "Current state" does not match the live code.
- Step 6 shows `GET /api/passes` returning 200 without a token — that means the
  exemption regex in step 3 is too broad and you have exposed the pass list.
  Stop immediately; do not attempt a second regex without reporting.
- A valid pass creation returns 413 after step 2 — the body-limit split is
  wrong. One fix attempt, then stop and report.
- `express-rate-limit` pulls in a dependency tree that fails `bun install`, or
  its types conflict with `@types/express@4`.
- You cannot start the server locally (missing certificates) **and** the
  automated route tests cannot be written either. Since plan 005, step 6's
  matrix runs against `createApp(config)` with dummy cert buffers and no env,
  so this should not normally occur — if you do end up skipping step 6, report
  clearly that the middleware ordering is **not** verified.

## Maintenance notes

- **Redundant checks left in place**: after step 3, `requireApiToken(req)` is
  called both by the `/api` middleware and inside each handler. That is
  deliberate belt-and-braces for this change; removing the in-handler calls is
  safe follow-up work, but do it as its own commit so a reviewer can see that
  every removed call is covered by the middleware.
- **`trust proxy: true` remains a real gap** (plan 007). Until it is a hop
  count, the rate limiter can be evaded with a spoofed `X-Forwarded-For`. It
  still raises the cost of casual probing, which is why it is worth adding now.
- **What a reviewer should scrutinize**: the exemption regex in step 3. It is
  the one line in this plan where a small mistake silently removes
  authentication from a route that needs it.
- The `/v1/log` output shape changed from a prefixed line to a JSON record. If
  anything downstream greps for `[wallet-device]`, it needs updating — at time
  of writing nothing does.
