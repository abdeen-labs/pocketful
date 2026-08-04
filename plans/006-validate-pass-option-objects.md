# Plan 006: Validate the pass option objects instead of spreading request data into a signed pass

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f0dc115..HEAD -- server/src/validate.ts server/src/passBuilder.ts server/src/updatable.ts server/src/types.ts`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P2
- **Effort**: M
- **Risk**: HIGH
- **Depends on**: 001 (required — you must not tighten this validator without a
  characterization suite proving existing specs still pass)
- **Category**: security
- **Planned at**: commit `f0dc115`, 2026-08-04

## Why this matters

`server/src/validate.ts` is 385 lines named and structured as the input
contract for the signing API, and it validates images, fields, colours,
barcodes, locations, beacons, localizations and personalization carefully. But
three whole sub-objects pass through it untouched — `options`,
`eventTicketOptions`, and `boardingPassOptions` — and `passBuilder.ts` spreads
them verbatim into the `pass.json` that gets signed with the operator's Apple
Developer certificate.

Two concrete consequences:

1. **Server-controlled keys can be supplied by the caller.** `webServiceURL`
   and `authenticationToken` are declared members of the options type. On the
   updatable path the server overwrites them afterwards, so they are harmless
   there. On the **non-updatable** path no identity is passed, nothing
   overwrites them, and whatever the request body contained is signed into the
   pass. A pass signed by the operator's certificate can therefore carry an
   update callback pointing anywhere.
2. **Roughly thirty URL, email and phone fields are never format-checked**, and
   arbitrary unknown keys ride along into `pass.json`. Wallet silently refuses
   to install a pass with malformed keys, and the server has no signal that it
   produced one.

The root enabler is a single cast: the request body is asserted to be a
`PassSpec` after only an `isRecord` check, so TypeScript's strict mode stops at
the boundary and every subsequent property read is unverified.

**The dangerous part of this plan is not the fix — it is the blast radius.**
The server re-validates *stored* specs every time a device refreshes an
installed pass. Any rule you tighten here retroactively applies to passes
already in people's Wallets, and a newly-rejected stored spec turns a device
refresh into a 500. That is why this plan lands last, why it requires plan 001,
and why step 1 makes the rebuild path lenient *before* anything is tightened.

## Current state

`server/src/passBuilder.ts:36-56` — where unvalidated data enters the signed pass:

```ts
  const passJson: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: spec.organizationName || config.organizationName,
    serialNumber: spec.serialNumber || randomUUID(),
    description: spec.description,
    ...(spec.options ?? {}),
    ...(spec.style === "eventTicket" ? spec.eventTicketOptions ?? {} : {}),
    ...(spec.style === "boardingPass" ? spec.boardingPassOptions ?? {} : {}),
    ...(spec.upcomingPassInformation
      ? { upcomingPassInformation: spec.upcomingPassInformation }
      : {}),
    [spec.style]: styleBody,
  };

  if (identity) {
    passJson.serialNumber = identity.serialNumber;
    passJson.webServiceURL = identity.webServiceURL;
    passJson.authenticationToken = identity.authenticationToken;
  }
```

`identity` is only passed on the updatable path — compare
`server/src/index.ts:72` (`buildPass(validated, config, identity)`) with
`server/src/index.ts:88` (`buildPass(validated, config)`).

`server/src/validate.ts:349-353` — the cast that ends compile-time checking:

```ts
export function validateSpec(body: unknown): ValidatedSpec {
  if (!isRecord(body)) throw new ApiError(400, "Request body must be a JSON object");
  const spec = body as unknown as PassSpec;
  if (!STYLES.includes(spec.style)) throw new ApiError(400, `style must be one of ${STYLES.join(", ")}`);
```

The only place `options` is read at all, `server/src/validate.ts:258-261`:

```ts
  const semantics = isRecord(spec.options) && isRecord(spec.options.semantics)
    ? spec.options.semantics
    : {};
```

`server/src/updatable.ts:12-19` — the coupling that makes this risky:

```ts
export function rebuildStoredPass(record: PassRecord, config: Config): Buffer {
  const validated = validateSpec(JSON.parse(record.specJson));
  return buildPass(validated, config, {
    serialNumber: record.serialNumber,
    webServiceURL: config.publicBaseUrl ?? record.webServiceURL,
    authenticationToken: record.authToken,
  });
}
```

and where a throw from it lands, `server/src/webService.ts:102-111`:

```ts
    let buffer: Buffer;
    try {
      buffer = rebuildStoredPass(record, config);
    } catch (err) {
      console.error(
        `Failed to rebuild pass ${record.serialNumber}:`,
        err instanceof Error ? err.message : err
      );
      throw new ApiError(500, "Failed to rebuild pass");
    }
```

The declared shape of the option objects lives in `server/src/types.ts` — the
`PassOptions`, `EventTicketOptions` and `BoardingPassOptions` interfaces,
roughly lines 140–185, declaring about thirty `*URL`, email and phone members
plus `semantics`, `userInfo`, `maxDistance`, `associatedStoreIdentifiers`,
`voided`, `webServiceURL` and `authenticationToken`. **Read that file before
writing any validator** — it is the authoritative list and this plan does not
reproduce it.

What the app actually sends is assembled in `app/src/app/index.tsx` around
lines 459–471 (`options`) and 505–510 (`eventTicketOptions`). Read those too:
they define the shapes that must keep working.

Repo conventions in `server/`: double quotes, 2-space indent, semicolons.
Validation helpers in `validate.ts` throw `ApiError(400, message)` with a
message naming the offending path (e.g. `` `barcodes[${index}].message is required` ``).
Reuse the existing `assertOptionalString(value, path, maxLength)` helper rather
than writing new string checks.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Typecheck | `cd server && ./node_modules/.bin/tsc --noEmit` | exit 0 |
| Tests | `cd server && bun run test` | all pass |
| Build | `cd server && bun run build` | exit 0 |

## Scope

**In scope**:

- `server/src/validate.ts` (add option validation; add a lenient mode)
- `server/src/passBuilder.ts` (strip server-controlled keys unconditionally)
- `server/src/updatable.ts` (use the lenient mode on the rebuild path)
- `server/src/validate.test.ts` (extend)

**Out of scope** (do NOT touch):

- `server/src/types.ts` — it is the reference for what to allow. Do not change
  the declared types. Note that `app/src/types.ts` is a hand-maintained mirror
  of it (`README.md:87` documents the convention); changing either would put
  you in a two-file lockstep this plan does not scope.
- The image, field, colour, barcode, location, beacon, localization and
  personalization validators. They already work. Do not refactor them.
- Introducing a schema library (zod/valibot). It is arguably the right end
  state, but swapping the validation engine and tightening rules in one change
  makes the blast radius impossible to reason about. Hand-written validators
  matching the existing file's style only.
- `server/src/webService.ts` and `server/src/index.ts` beyond nothing — this
  plan should not need to touch either.

## Git workflow

- Branch: `advisor/006-validate-options`
- Commit style: short imperative subjects. Commit step 1 (lenient rebuild)
  **separately and first** — it is the safety net for everything after it.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Make the rebuild path lenient BEFORE tightening anything

This step must land before any new rule exists, or you risk bricking passes
already installed on devices.

Give `validateSpec` an options parameter:

```ts
export interface ValidateOptions {
  /**
   * Stored specs are revalidated on every device refresh (see updatable.ts).
   * A rule tightened after a pass was issued must not brick it, so rules added
   * for new submissions are skipped here and logged instead.
   */
  lenient?: boolean;
}

export function validateSpec(body: unknown, options: ValidateOptions = {}): ValidatedSpec {
```

Every rule this plan adds — and only the rules this plan adds — must be
skipped when `options.lenient` is true, emitting a `console.warn` naming the
serial-less reason instead:

```ts
function rejectOrWarn(lenient: boolean, message: string): void {
  if (lenient) {
    console.warn(`Stored spec would be rejected by a newer rule: ${message}`);
    return;
  }
  throw new ApiError(400, message);
}
```

Then in `server/src/updatable.ts`, pass it:

```ts
  const validated = validateSpec(JSON.parse(record.specJson), { lenient: true });
```

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run test` →
exit 0, and every test from plan 001 still passes (they call `validateSpec`
with one argument, which must keep working).

**Commit this step on its own.**

### Step 2: Strip server-controlled keys in the pass builder

Independent of validation, `passBuilder.ts` must never let a caller set the
three keys the server owns. In `server/src/passBuilder.ts`, after the
`passJson` literal is constructed, delete them unconditionally, then apply the
identity if present:

```ts
  // These three are the server's to set. A caller-supplied webServiceURL or
  // authenticationToken would point installed passes at another origin, signed
  // with this server's certificate.
  delete passJson.webServiceURL;
  delete passJson.authenticationToken;

  if (identity) {
    passJson.serialNumber = identity.serialNumber;
    passJson.webServiceURL = identity.webServiceURL;
    passJson.authenticationToken = identity.authenticationToken;
  }
```

Note `serialNumber` is deliberately **not** deleted — a caller-chosen serial is
a supported feature (`server/src/index.ts:58` uses `spec.serialNumber` when
present), and the identity overwrites it on the updatable path.

This is a behavior change for non-updatable passes that previously carried a
caller-supplied `webServiceURL`. That combination was never coherent — a
non-updatable pass has no stored spec to serve — so it is safe. Say so in your
report.

**Verify**: add a test asserting that a spec with
`options: { webServiceURL: "https://example.test", authenticationToken: "x" }`
produces a pass whose `pass.json` contains neither key when built without an
identity. Building requires certificates, so instead assert at the unit level:
extract the `passJson` construction into an exported helper if it is not
already testable, **or** assert via `validateSpec` + a direct call to
`buildPass` inside a `try/catch` that tolerates a signing failure while still
letting you inspect the JSON. If neither is clean, state in your report that
this step is covered only by the `delete` statements' presence and add a
`grep`-style done criterion instead. Do not invent a fake certificate.

### Step 3: Validate the option objects

Add a validator for each of the three objects, driven by the member lists in
`server/src/types.ts`. The shape to produce, in the existing file's style:

```ts
const URL_OPTION_KEYS = [/* every *URL member from types.ts */] as const;

function assertHttpsUrl(value: unknown, path: string): void {
  if (value === undefined) return;
  if (typeof value !== "string") throw new ApiError(400, `${path} must be a string`);
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new ApiError(400, `${path} must be an absolute URL`);
  }
  if (parsed.protocol !== "https:") {
    throw new ApiError(400, `${path} must use https`);
  }
}
```

Rules to apply, each routed through `rejectOrWarn` from step 1:

- **Unknown keys are rejected.** Build an allowlist per object from
  `types.ts`'s declared members and reject anything else, naming the key. This
  is the rule that actually closes the passthrough, and it is also the one most
  likely to reject something the app sends today — which is exactly what the
  test in step 4 is for.
- Every `*URL` member must parse as an absolute `https:` URL.
- Email members must contain an `@` and no whitespace; phone members must be
  non-empty strings. Keep these loose — over-strict email validation causes
  more problems than it solves.
- `maxDistance`, if present, must be a finite number greater than 0.
- `associatedStoreIdentifiers`, if present, must be an array of positive
  integers.
- `voided`, if present, must be a boolean.
- `userInfo`, if present, must be a plain object; cap its serialized size (use
  `JSON.stringify(value).length` against a limit such as 4096) — it is
  free-form by design, so bound it rather than typing it.
- `semantics`, if present, must be a plain object. Do **not** validate its
  members: `validateModernStyleRequirements` already asserts the specific keys
  the modern styles need, and Apple's semantic-tag vocabulary is large and
  versioned. Bound its serialized size the same way.
- Every remaining string member goes through the existing
  `assertOptionalString(value, path, 2_000)`.

Call the three validators from `validateSpec`, after `validateAdvanced(spec)`
and before `validateFields`.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 4: Prove the app's real payloads still validate

This is the step that decides whether this plan is safe to ship.

Read `app/src/app/index.tsx:459-471` and `:505-510` and construct, as test
fixtures, the **maximal** `options` and `eventTicketOptions` objects the app can
produce — every field populated with a plausible value. Do the same for
`boardingPassOptions` from `BOARDING_OPTION_FIELDS` in the same file, and for
the option shapes baked into `app/src/lib/templates.ts` (all 11 templates).

Add tests asserting each of these validates without throwing.

If any of them fails, the allowlist is wrong — widen the allowlist to match
what the app sends. **Do not** change the app to match the validator; the app
is the existing client and this plan must not break it.

Then add rejection tests for the new rules: an unknown key, an `http:` URL, a
`javascript:` URL, a negative `maxDistance`, a non-array
`associatedStoreIdentifiers`, an oversized `userInfo`.

And one lenient-mode test: a spec that the strict path rejects must be
**accepted** by `validateSpec(spec, { lenient: true })`. That test is the proof
that installed passes keep refreshing.

**Verify**: `cd server && bun run test` → all pass, including every plan 001
test unchanged.

### Step 5: Add a stored-spec audit so drift is found before a device finds it

Add a startup sweep, called once from the `require.main` block in
`server/src/index.ts` (or from `createApp` if plan 005 has landed), that runs
every stored spec through the **strict** validator and logs which serials would
now be rejected and why. Do not throw and do not modify anything — this is a
report, not an enforcement.

```ts
export function auditStoredSpecs(): void {
  for (const summary of listPassSummaries()) {
    const record = getPassRecord(summary.serialNumber);
    if (!record) continue;
    try {
      validateSpec(JSON.parse(record.specJson));
    } catch (err) {
      console.warn(
        `Stored pass ${summary.serialNumber} no longer passes strict validation:`,
        err instanceof Error ? err.message : err
      );
    }
  }
}
```

Without this, the only way to discover that a rule change stranded a pass is a
user reporting that their pass stopped updating.

**Verify**: `cd server && ./node_modules/.bin/tsc --noEmit && bun run build` → exit 0.

## Test plan

- Extend `server/src/validate.test.ts` with: the app's maximal real payloads
  (accepted), the new rejection rules (rejected), and lenient-mode acceptance
  of a strictly-invalid spec.
- Every existing test from plan 001 must still pass **unchanged**. If you find
  yourself editing a plan 001 test, stop — that means this plan changed
  behavior it was not supposed to change.
- Verification: `cd server && bun run test` → all pass.

## Done criteria

ALL must hold:

- [ ] `cd server && ./node_modules/.bin/tsc --noEmit` exits 0
- [ ] `cd server && bun run test` exits 0, with no plan 001 test modified
      (`git diff f0dc115..HEAD -- server/src/validate.test.ts` shows additions
      only in the regions you added)
- [ ] `cd server && bun run build` exits 0
- [ ] `grep -n "delete passJson.webServiceURL" server/src/passBuilder.ts` returns a match
- [ ] `grep -n "lenient" server/src/updatable.ts` returns a match
- [ ] Tests exist proving every option shape the app can produce still validates
- [ ] A test exists proving lenient mode accepts a strictly-invalid stored spec
- [ ] `git status --porcelain` shows no files outside the in-scope list
- [ ] `plans/README.md` status row for 006 updated

## STOP conditions

Stop and report back (do not improvise) if:

- Plan 001 has not landed. Without the characterization suite you cannot tell a
  tightened rule from a broken one. Do not proceed.
- Any excerpt in "Current state" does not match the live code.
- A payload the app currently produces is rejected by your allowlist and you
  cannot tell whether it *should* be allowed. Report the specific key rather
  than guessing — a wrong call here either leaves the hole open or breaks the
  app.
- `server/src/types.ts` and `app/src/types.ts` disagree about the option
  members. They are hand-mirrored and were identical at the time of writing; a
  divergence means something changed and the two need reconciling before you
  build an allowlist from either.
- The unknown-key rejection turns out to break one of the 11 templates in
  `app/src/lib/templates.ts`.
- You conclude the change requires touching `server/src/types.ts`.

## Maintenance notes

- **The lenient path is permanent, not temporary.** As long as stored specs are
  revalidated on every device refresh, every future rule addition must go
  through `rejectOrWarn`. Anyone adding a rule to `validate.ts` needs to know
  this — the comment on `ValidateOptions` is the only place it is written down,
  so keep it there.
- **The real fix for the cast** (`body as unknown as PassSpec`) is a schema
  parser whose inferred type *is* `PassSpec`, which would make `types.ts` and
  the validator incapable of drifting. That is deliberately deferred: swapping
  the engine and tightening rules at once is unreviewable. Once this plan's
  tests exist, the swap becomes a safe mechanical follow-up.
- **`upcomingPassInformation`** is still only checked for "array of objects"
  (`server/src/validate.ts:252`) and is spread into `pass.json`. It is
  deliberately left alone here — its iOS 26 schema is owned by the installed
  `passkit-generator` version, per the comment at `passBuilder.ts:92-93`.
- **What a reviewer should scrutinize**: the allowlist. Every key on it is a
  key the operator's signing certificate will vouch for. And check that step 1
  landed in its own commit before anything else.
