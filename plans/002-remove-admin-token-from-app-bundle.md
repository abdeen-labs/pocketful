# Plan 002: Stop shipping the server's admin API token inside the app bundle

> **Executor instructions**: Follow this plan step by step. Run every
> verification command and confirm the expected result before moving to the
> next step. If anything in the "STOP conditions" section occurs, stop and
> report — do not improvise. When done, update the status row for this plan
> in `plans/README.md`.
>
> **Drift check (run first)**: `git diff --stat f0dc115..HEAD -- app/src app/.env.example INSTRUCTIONS.md`
> If any in-scope file changed since this plan was written, compare the
> "Current state" excerpts against the live code before proceeding; on a
> mismatch, treat it as a STOP condition.

## Status

- **Priority**: P1
- **Effort**: M
- **Risk**: MED
- **Depends on**: none
- **Category**: security
- **Planned at**: commit `f0dc115`, 2026-08-04

## Why this matters

The signing server has exactly one credential: `API_TOKEN`. It is a single
shared bearer token that gates the entire management API — creating passes,
reading any stored pass spec, replacing any pass, pushing over-the-air updates
to passes already in people's Wallets, and deleting passes.

The app currently seeds that token from `process.env.EXPO_PUBLIC_PASS_API_TOKEN`.
Expo inlines every `EXPO_PUBLIC_*` variable into the JavaScript bundle at build
time. Any build made with that variable set therefore ships an extractable
admin credential for the signing server inside the IPA. `app/.env.example`
documents this as the supported setup, so it is the default path a developer
follows.

The token is an *administrative* credential being handed to a *client*. This
plan removes the build-time inlining, moves the runtime-entered token into the
iOS Keychain so it is not held in plain component state, and corrects the docs.
It also requires rotating the existing token, because any build produced so far
has already burned it.

**This plan does not fix the underlying design** — a single global token shared
by every client is still the model afterwards. Scoped per-client tokens are a
larger change, recorded in the Maintenance notes.

## Current state

Relevant files:

- `app/src/app/index.tsx` — the single editor screen (945 lines). Line 237
  seeds the token; line 788 renders the input; line 362 sends it.
- `app/src/lib/api.ts` — the only network call in the app; attaches the token.
- `app/.env.example` — tracked in git; documents the variable.
- `INSTRUCTIONS.md` — the setup guide; documents the variable around line 308.
- `app/package.json` — dependency list; `expo-secure-store` is **not** present.

`app/src/app/index.tsx:236-237` as it exists today:

```tsx
  const [serverUrl, setServerUrl] = useState(process.env.EXPO_PUBLIC_PASS_SERVER_URL ?? 'https://pass.abdeen.dev');
  const [apiToken, setApiToken] = useState(process.env.EXPO_PUBLIC_PASS_API_TOKEN ?? '');
```

`app/.env.example` in full today:

```
# Copy to .env and fill in. EXPO_PUBLIC_ vars are inlined at build time.
# Optional — the app already defaults to https://pass.abdeen.dev
EXPO_PUBLIC_PASS_SERVER_URL=https://pass.abdeen.dev
# Must match the server's required API_TOKEN
EXPO_PUBLIC_PASS_API_TOKEN=
```

`app/src/lib/api.ts:12-31` — how the token is used (note there is no timeout
and no URL scheme check; both are plan 007's concern, not this one):

```ts
export async function createPass(
  serverUrl: string,
  spec: PassSpec,
  token?: string
): Promise<CreatePassResponse> {
  const base = serverUrl.trim().replace(/\/+$/, '');

  let response: Response;
  try {
    response = await fetch(`${base}/api/passes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(spec),
    });
```

The token input already exists in the Server section and is already masked
(`app/src/app/index.tsx:788` uses `secureTextEntry`), so the UI affordance is
in place — only the persistence and the build-time default need to change.

Repo conventions to match in `app/`:

- Single quotes, 2-space indent, semicolons.
- Path alias `@/` maps to `app/src/` (see existing imports like
  `import type { PassSpec } from '@/types';`).
- Async work in this screen is wrapped in `try`/`catch` with
  `Alert.alert(title, message)` for user-facing errors — see
  `app/src/app/index.tsx:250-260` (`handlePick`) for the established shape.
- Reusable inputs/buttons come from `app/src/components/ui.tsx`.

## Commands you will need

| Purpose | Command | Expected on success |
|---|---|---|
| Install (app) | `cd app && bun install` | exit 0 |
| Add dependency | `cd app && bunx expo install expo-secure-store` | exit 0, package.json updated |
| Typecheck (app) | `cd app && ./node_modules/.bin/tsc --noEmit` | exit 0, no errors |
| Lint (app) | `cd app && bun run lint` | exit 0 |

**You cannot build or run the iOS app.** Building requires Xcode on the
operator's machine and a physical device for the full Wallet flow. Your
verification is typecheck + lint + the grep assertions in "Done criteria". Do
not attempt `expo run:ios`, `expo prebuild`, or `xcodebuild`.

## Scope

**In scope** (the only files you should modify):

- `app/src/app/index.tsx` (token seeding, load/save wiring)
- `app/src/lib/secureToken.ts` (create)
- `app/package.json` and `app/bun.lock` (adding `expo-secure-store`)
- `app/.env.example`
- `INSTRUCTIONS.md` (the app environment-variable section only)

**Out of scope** (do NOT touch, even though they look related):

- `server/src/config.ts` and `server/src/index.ts` — the server keeps requiring
  `API_TOKEN` exactly as it does now. Do not weaken or change server auth.
- `app/src/lib/api.ts` — its missing timeout and missing URL scheme check are
  real, but they belong to plan 007. Changing it here widens the diff and the
  review.
- `mcp/src/index.ts` — the MCP server reads `POCKETFUL_API_TOKEN` from a real
  process environment on the operator's machine. That is a legitimate use of an
  admin token by an operator-run tool and is **not** the same problem. Leave it.
- `EXPO_PUBLIC_PASS_SERVER_URL` — the server *URL* is not a secret. Keep it.

## Git workflow

- Branch: `advisor/002-app-token`
- Commit style: short imperative subjects, matching e.g.
  `Require API_TOKEN — the management API is never open`.
- Do NOT push or open a PR unless the operator instructed it.

## Steps

### Step 1: Add `expo-secure-store`

```bash
cd app && bunx expo install expo-secure-store
```

Use `expo install` (not `bun add`) so the version Expo SDK 57 expects is
selected. This package stores values in the iOS Keychain.

**Verify**: `grep '"expo-secure-store"' app/package.json` → one match.

### Step 2: Add a small token store module

Create `app/src/lib/secureToken.ts`. Keep it tiny and total — every function
resolves rather than throwing, because a Keychain failure must never block the
editor from loading.

```ts
import * as SecureStore from 'expo-secure-store';

const API_TOKEN_KEY = 'pocketful.apiToken';

/** Returns the saved token, or '' when absent or unreadable. */
export async function loadApiToken(): Promise<string> {
  try {
    return (await SecureStore.getItemAsync(API_TOKEN_KEY)) ?? '';
  } catch {
    return '';
  }
}

/** Persists the token, or clears it when empty. Never throws. */
export async function saveApiToken(token: string): Promise<void> {
  try {
    if (token) await SecureStore.setItemAsync(API_TOKEN_KEY, token);
    else await SecureStore.deleteItemAsync(API_TOKEN_KEY);
  } catch {
    // A Keychain failure must not block pass creation; the in-memory
    // token still works for this session.
  }
}
```

**Verify**: `cd app && ./node_modules/.bin/tsc --noEmit` → exit 0.

### Step 3: Remove the build-time token default and load from the Keychain

In `app/src/app/index.tsx`, change line 237 from:

```tsx
  const [apiToken, setApiToken] = useState(process.env.EXPO_PUBLIC_PASS_API_TOKEN ?? '');
```

to:

```tsx
  const [apiToken, setApiToken] = useState('');
```

Leave line 236 (`serverUrl`) exactly as it is.

Then add a load-on-mount effect near the other hooks in this component. Place
it immediately after the `useMemo` block around lines 242–247 so it sits with
the other hook declarations rather than inside the render body:

```tsx
  useEffect(() => {
    let active = true;
    loadApiToken().then((saved) => {
      if (active && saved) setApiToken(saved);
    });
    return () => {
      active = false;
    };
  }, []);
```

Add the imports at the top of the file, following the existing import style:

```tsx
import { loadApiToken, saveApiToken } from '@/lib/secureToken';
```

`useEffect` must be added to the existing `react` import if it is not already
there — check the current import line rather than assuming.

The `active` flag is not optional: without it, a resolve after unmount sets
state on a dead component.

### Step 4: Persist the token when the user edits it

Find the token `Input` in the Server section (around `app/src/app/index.tsx:788`,
the one with `secureTextEntry`). It currently passes `setApiToken` directly as
`onChangeText`. Replace that with a handler that updates state *and* persists:

```tsx
  const handleApiTokenChange = (value: string) => {
    setApiToken(value);
    void saveApiToken(value.trim());
  };
```

Declare it alongside the other handlers in this component (near `handlePick`
at line 251), and pass `onChangeText={handleApiTokenChange}` to that Input.

Do not persist on every keystroke if the existing UI has an explicit save
affordance — check the Server section first. If there is no save button (there
is not, at the time of writing), per-keystroke persistence to the Keychain is
acceptable here: the values are short and writes are cheap.

**Verify**: `cd app && ./node_modules/.bin/tsc --noEmit && bun run lint` → both exit 0.

### Step 5: Correct `app/.env.example`

Replace the file's contents with:

```
# Copy to .env and fill in. EXPO_PUBLIC_ vars are inlined into the JS bundle at
# build time — never put a secret here.
# Optional — the app already defaults to https://pass.abdeen.dev
EXPO_PUBLIC_PASS_SERVER_URL=https://pass.abdeen.dev

# The server's API_TOKEN is NOT configured here. It is an admin credential for
# the whole management API; inlining it would ship it inside the IPA. Enter it
# once in the app's Server section — it is stored in the iOS Keychain.
```

### Step 6: Correct `INSTRUCTIONS.md`

Find the section documenting `EXPO_PUBLIC_PASS_API_TOKEN` (near line 308 —
locate it with `grep -n EXPO_PUBLIC_PASS_API_TOKEN INSTRUCTIONS.md`). Replace
the instruction to set it in `app/.env` with an instruction to enter the token
in the app's Server section on first run, and state plainly that it is stored
in the Keychain and that `EXPO_PUBLIC_*` variables are inlined into the bundle.

Keep the surrounding document's voice and formatting. Do not restructure other
sections.

**Verify**: `grep -rn "EXPO_PUBLIC_PASS_API_TOKEN" app/ INSTRUCTIONS.md --exclude-dir=node_modules`
→ matches only in the explanatory comment you wrote in `app/.env.example`, and
in `INSTRUCTIONS.md` only where it explains that the variable is no longer used.
No match in `app/src/`.

### Step 7: Write the rotation note into your final report

You cannot rotate the credential — it lives in the operator's Railway
environment. Your report must state, prominently:

> The existing `API_TOKEN` must be rotated. Any app build produced while
> `EXPO_PUBLIC_PASS_API_TOKEN` was set has that token embedded in its bundle.
> Rotation means: generate a new token, set `API_TOKEN` in the server's Railway
> environment, redeploy, and re-enter the new token in the app's Server section.

Do not attempt to read, print, or store any token value at any point in this
plan.

## Test plan

There is no app-side test infrastructure and this plan deliberately does not
create one (see plan 001's Maintenance notes for why).

Verification is static:

- `cd app && ./node_modules/.bin/tsc --noEmit` → exit 0
- `cd app && bun run lint` → exit 0
- The grep assertions in "Done criteria" below

Manual verification the **operator** must do after this lands (include this in
your report; you cannot do it):

1. Build the app from Xcode with no `EXPO_PUBLIC_PASS_API_TOKEN` in `app/.env`.
2. On first launch, the Server section's token field is empty.
3. Enter the rotated token, create a pass — it succeeds.
4. Force-quit and relaunch the app — the token field is populated again from
   the Keychain and pass creation still succeeds.

## Done criteria

ALL must hold:

- [ ] `grep -rn "EXPO_PUBLIC_PASS_API_TOKEN" app/src/` returns **no matches**
- [ ] `grep -n "expo-secure-store" app/package.json` returns a match
- [ ] `app/src/lib/secureToken.ts` exists and exports `loadApiToken` and `saveApiToken`
- [ ] `cd app && ./node_modules/.bin/tsc --noEmit` exits 0
- [ ] `cd app && bun run lint` exits 0
- [ ] `grep -n "EXPO_PUBLIC_PASS_SERVER_URL" app/src/app/index.tsx` still returns a match
      (the server URL default is intentionally kept)
- [ ] `git diff --name-only` lists only the in-scope files
- [ ] Your report contains the rotation instruction from step 7
- [ ] `plans/README.md` status row for 002 updated

## STOP conditions

Stop and report back (do not improvise) if:

- `bunx expo install expo-secure-store` reports a version conflict with Expo
  SDK 57, or requires a config-plugin entry in `app/app.json`. Adding native
  configuration is a bigger change than this plan scopes, and the operator
  builds from Xcode — a native config change needs their involvement.
- The `apiToken` state at `app/src/app/index.tsx:237` is not what the "Current
  state" excerpt shows.
- You discover the token is read anywhere else in `app/src/` beyond line 237
  and the `createPass` call at line 362 — that would mean a second path this
  plan does not cover.
- Removing the build-time default appears to break a flow that has no runtime
  entry point (i.e. you cannot find the Server-section token input).

## Maintenance notes

- **What this does not fix**: the server still has exactly one shared bearer
  token for all clients (`server/src/config.ts:54`,
  `server/src/index.ts:34-39`). A phone holding it can delete every pass on the
  server, not just its own. The real fix is scoped per-client credentials — a
  create-only token for the app, an admin token for operators — which needs a
  server-side token model and is a much larger piece of work. Consider it the
  natural follow-up if the app is ever distributed beyond the maintainer.
- **Interacts with**: plan 007 also touches the app's network path
  (`app/src/lib/api.ts`) to add a timeout and require HTTPS. The HTTPS check
  matters *because* of the token — a mistyped `http://` host currently receives
  the bearer token in cleartext. If both plans land, 007's scheme check is what
  keeps this one honest.
- **What a reviewer should scrutinize**: that no code path reintroduces a
  build-time default, and that `saveApiToken` failures are genuinely swallowed
  rather than surfacing a Keychain error dialog during normal editing.
- The Keychain entry persists across app reinstalls on iOS by default. If that
  is undesirable, `SecureStore` accepts options to change the accessibility
  class — deliberately not configured here.
