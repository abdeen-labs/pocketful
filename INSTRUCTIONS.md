`NIGHTFIELD//OPEN`

# Pocketful setup guide

Describe an Apple Wallet pass to an AI agent, get it signed by your own server,
add it to Wallet on your iPhone. Entirely self-hosted: the only service involved
is the signing server you deploy.

```
server/   Node + Express — validates pass specs, renders artwork, signs .pkpass
          files with passkit-generator, serves the MCP endpoint for AI agents,
          delivers passes through Hark, and pushes OTA updates; deployed on Railway
```

**How it works**

1. An agent turns your prompt into a JSON pass spec — style, layout, colors,
   fields, barcodes, relevance, semantics, NFC, localization, personalization,
   actions — and inlines any artwork as base64 source images.
2. The agent calls `create_pass` on the server's MCP endpoint (a script can
   `POST` the same spec to the REST API). The server validates the spec, crops
   and renders every image at Wallet's 1x/2x/3x sizes, builds and signs a
   `.pkpass` **in memory**, and stores it under a short-lived random id
   (15 min by default).
3. The download URL reaches your iPhone. With Hark configured, the server
   pushes it as a notification and a tap opens Hark's Add to Wallet sheet.
   Without Hark, open the URL on the iPhone and Wallet's add sheet appears.

Signing happens server-side because [passkit-generator](https://github.com/alexandercerutti/passkit-generator)
is Node-only, and because the signing certificates belong in exactly one place.

Follow the first three parts below **in order**. Parts 4 and 5 are optional:
delivering passes to your iPhone through Hark, and updating passes over the air.

---

## Part 1 — Certificates

You need a paid Apple Developer account. Three things come out of this part: a WWDR
certificate, your pass signing certificate, and its private key.

### 1.1 Create a Pass Type ID

1. Go to [Apple Developer → Identifiers](https://developer.apple.com/account/resources/identifiers/list/passTypeId).
2. Add a new **Pass Type ID**, e.g. `pass.dev.abdeen.pocketful`. Note it — this is
   `PASS_TYPE_IDENTIFIER`.
3. Your 10-character Team ID (top-right of the developer portal, or under
   Membership) is `TEAM_IDENTIFIER`.

### 1.2 Create the signing certificate

1. On the Pass Type ID's page, click **Create Certificate**.
2. It asks for a CSR: open **Keychain Access** → menu **Keychain Access →
   Certificate Assistant → Request a Certificate From a Certificate Authority…**,
   enter your email, select **Saved to disk**, save the `.certSigningRequest`.
3. Upload the CSR, download the resulting `pass.cer`, and double-click it so it
   lands in your login keychain.
4. In Keychain Access, find the certificate (search for your pass type id), expand
   it to show the private key, select **both**, right-click → **Export 2 items…**,
   and save as `Certificates.p12` with a passphrase you'll remember.

### 1.3 Convert everything to PEM

In the folder where you saved the files (certs are gitignored here, but keeping
them outside the repo entirely is even better):

```bash
curl -O https://www.apple.com/certificateauthority/AppleWWDRCAG4.cer
```

```bash
openssl x509 -inform DER -in AppleWWDRCAG4.cer -out wwdr.pem
```

```bash
openssl pkcs12 -in Certificates.p12 -clcerts -nokeys -out signerCert.pem
```

```bash
openssl pkcs12 -in Certificates.p12 -nocerts -out signerKey.pem
```

Notes:

- The two `pkcs12` commands ask for the `.p12` passphrase. The last one also asks
  for a **new** passphrase to encrypt the key — set one; it becomes
  `SIGNER_KEY_PASSPHRASE`.
- If `openssl pkcs12` fails with an algorithm/`unsupported` error, you're on
  OpenSSL 3 with an old-style `.p12` — add `-legacy` to the command.
- If Wallet later rejects your pass, 9 times out of 10 the certificate doesn't
  match the `PASS_TYPE_IDENTIFIER`/`TEAM_IDENTIFIER` you configured.

### 1.4 Base64-encode for env vars

Each env var is the base64 of the **whole PEM file**:

```bash
base64 -i wwdr.pem | pbcopy
```

Repeat for `signerCert.pem` and `signerKey.pem`. Paste each into the matching
Railway variable in Part 2.

---

## Part 2 — Deploy the server to Railway

1. Push this repo to GitHub.
2. In [Railway](https://railway.app): **New Project → Deploy from GitHub repo**,
   pick this repo.
3. In the service settings, set **Root Directory** to `server`. Railway builds
   the service from `server/Dockerfile` automatically.
4. Under **Variables**, set:

   | Variable | Value |
   | --- | --- |
   | `PASS_TYPE_IDENTIFIER` | e.g. `pass.dev.abdeen.pocketful` |
   | `TEAM_IDENTIFIER` | your 10-char Team ID |
   | `WWDR_CERT_BASE64` | base64 of `wwdr.pem` |
   | `SIGNER_CERT_BASE64` | base64 of `signerCert.pem` |
   | `SIGNER_KEY_BASE64` | base64 of `signerKey.pem` |
   | `SIGNER_KEY_PASSPHRASE` | the key passphrase from step 1.3 |
   | `API_TOKEN` | the bearer token required by the pass management API and the MCP endpoint — generate a long random one, e.g. `openssl rand -hex 32` |
   | `ORGANIZATION_NAME` | optional — default org name on passes (default `Pocketful`) |
   | `PORT` | optional — listening port (default 3000; Railway sets it) |
   | `PASS_TTL_SECONDS` | optional — how long a minted download URL stays valid (default 900) |
   | `PASS_STORE_MAX_BYTES` | optional — byte ceiling for the in-memory store of downloadable passes; oldest entries evict first (default 134217728, i.e. 128 MB) |
   | `PUBLIC_BASE_URL` | optional — public origin stamped into updatable passes as `webServiceURL`, e.g. `https://pass.abdeen.dev`; defaults to the request's own host |
   | `DATA_DIR` | optional — where the SQLite database for updatable passes lives (default `./data` locally, `/data` in the Docker image); point it at a mounted volume |
   | `APNS_KEY_ID` | optional — key ID of an APNs auth key, enables update pushes (Part 5); set together with `APNS_KEY_BASE64` |
   | `APNS_KEY_BASE64` | optional — base64 of the whole `AuthKey_XXXXXXXXXX.p8` file |
   | `HARK_URL` | optional — base URL of your Hark deployment, e.g. `https://hark.example.dev`; enables pass delivery to the iPhone (Part 4); set together with `HARK_TOKEN` |
   | `HARK_TOKEN` | optional — a Hark API token with the `notifications:send` scope |

   `APNS_KEY_ID`/`APNS_KEY_BASE64` and `HARK_URL`/`HARK_TOKEN` are pairs: set
   both or neither. The server refuses to boot with half a pair.

5. Under **Settings → Networking**, add the custom domain `pass.abdeen.dev` and
   create the CNAME record Railway shows at your DNS provider. (Or click
   **Generate Domain** for a quick `….up.railway.app` URL first — the server
   works on any domain.)
6. Verify:

```bash
curl https://pass.abdeen.dev/healthz
```

Expected: `{"ok":true}`. The server fails fast at boot with a clear message if a
cert variable is missing or isn't valid base64-of-PEM — check the deploy logs.
The root URL of the deployment serves a short hosted docs page.

### API

- `POST /api/passes` — body is a pass spec (see `server/src/types.ts`). Signs the
  pass immediately; returns `{ id, url, expiresAt }` or a `4xx` with
  `{ error: "..." }` explaining what's wrong with the spec. With
  `"updatable": true` the response also carries a stable `serialNumber` and
  `updatable: true`, and the server keeps the spec for OTA updates (Part 5).
  With Hark configured, the response carries `hark` (Part 4).
- `GET /api/passes/:id` — the signed bytes, `Content-Type: application/vnd.apple.pkpass`.
  No token: the random id is the credential. 404 after expiry.
- `PUT /api/passes/:serial` — full replacement spec for an updatable pass;
  re-signs, bumps the update tag, and pushes to registered devices.
- `GET /api/passes` — list updatable passes with registration counts.
- `GET /api/passes/:serial/spec` — the stored spec, for read-modify-write updates.
- `POST /api/passes/:serial/download` — mint a fresh short-lived download URL;
  returns `{ id, url, expiresAt, serialNumber }` plus `hark` when configured.
- `DELETE /api/passes/:serial` — forget an updatable pass and its registrations.
- `POST /mcp` — the same operations as MCP tools for AI agents (Part 3), behind
  the same bearer token.
- `/v1/…` — Apple's Wallet web service protocol (device registration, change
  polling, latest-pass fetch, logging). iOS calls these itself.

Every route under `/api`, `/mcp`, and `/v1` is rate-limited to 120 requests per
minute per client.

The pass spec mirrors the pass-building surface of the installed
`passkit-generator` version: formatted/date/number fields, multiple barcode
fallbacks, additional style dictionaries so an iOS 27 poster pass still installs
on older systems, locations, beacons, old and new relevant dates, expiration,
NFC, pass and field semantics, app and web-service behavior, localized strings
and media, personalization, poster event and enhanced boarding actions, iOS 27
featured actions, and iOS 26 upcoming-pass information. Signing identity and
certificates are server-owned; the spec cannot supply them.

### Run the server locally (optional)

```bash
cd server && bun install && bun run dev
```

with the same variables in the environment. A quick way to test without real certs
is self-signed ones (Wallet will refuse the result, but the API works end-to-end).

---

## Part 3 — Agents over MCP

The deployed server speaks [MCP](https://modelcontextprotocol.io) over
Streamable HTTP at `https://pass.abdeen.dev/mcp`. There is nothing extra to
deploy or run: the endpoint is part of the Railway service, guarded by the same
`API_TOKEN` bearer token as `/api/*`, and reachable from any machine.

### 3.1 Register the endpoint

With Claude Code:

```bash
claude mcp add --transport http pocketful https://pass.abdeen.dev/mcp \
  --header "Authorization: Bearer <API_TOKEN>"
```

Any other MCP client that supports Streamable HTTP with a custom header works
the same way — Claude Desktop included: point it at `/mcp` and send
`Authorization: Bearer <API_TOKEN>`.

### 3.2 The tools

| Tool | What it does |
| --- | --- |
| `create_pass` | Build, sign, and host a pass from a spec. Returns the download URL and, for updatable passes, the `serialNumber`. |
| `update_pass` | Replace the full spec of an updatable pass and push the change to every Wallet that holds it. Omit `images` to reuse the stored artwork. |
| `get_pass_spec` | Fetch the stored spec of an updatable pass for read-modify-write. Image payloads come back as size placeholders so base64 stays out of the agent's context. |
| `list_passes` | Every updatable pass the server manages, with registration counts. |
| `mint_pass_download` | A fresh short-lived download URL for an existing updatable pass, e.g. to add it to another iPhone. |
| `delete_pass` | Remove an updatable pass and its registrations. Copies already in Wallet stay on the device but stop updating. |

Each tool's description carries the full spec guide — required keys, the
poster layouts, colors, fields, barcodes, semantics, and the artwork slots — so
the agent needs no other reference. Validation is strict and every `400` names
the exact problem; the agent fixes the spec and retries.

### 3.3 The images contract

`images` maps artwork **slot names** to **one** base64-encoded source image
each, in PNG, JPEG, or WebP. The server center-crops the image to the slot's
aspect ratio and produces the 1x, 2x, and 3x PNGs itself, so keys like
`icon@2x` are rejected. Send a source at least 3× the slot's point size; the
crop keeps the center. Localized variants take an `xx.lproj/` prefix, e.g.
`de.lproj/logo`. Combined image data is capped at 24 MB per request.

| Slot | 1x points | Where it appears |
| --- | --- | --- |
| `icon` | 29×29 | Required. Lock Screen and pass list icon |
| `logo` | 160×50 | Top-left artwork on every style |
| `primaryLogo` | 126×30 | Poster identity on posterGeneric and posterEventTicket |
| `secondaryLogo` | 135×12 | Issuer or venue logo on posterEventTicket |
| `artwork` | 358×448 | Full-art face; required by posterEventTicket |
| `strip` | 375×144 | Behind the fields on storeCard, coupon, and eventTicket; 375×98 when the style is eventTicket |
| `thumbnail` | 90×90 | Beside the fields on generic and eventTicket |
| `background` | 180×220 | Full-pass background on eventTicket; full-bleed face on posterGeneric, required there |
| `footer` | 286×15 | Above the barcode on boardingPass |
| `personalizationLogo` | 150×40 | Shown while Wallet collects personalization details; required with `personalization` |

`icon` is mandatory — Wallet rejects passes without one. Over MCP, a spec with
no icon gets the bundled Pocketful icon and the tool result says so; over REST,
`POST /api/passes` returns a `400` instead. Every other slot is optional unless
the style calls for it. The server cannot read files on the agent's machine, so
the agent reads the file itself and inlines it as base64.

### 3.4 A worked example

Ask:

> Make me an updatable loyalty card for Northstar Coffee: dark green
> background, white text, "120 points" as the primary field, a QR code that
> encodes `member_0042`, and use `~/Pictures/northstar-logo.png` as the logo.

The agent reads the PNG, base64-encodes it, and calls `create_pass` with a spec
along these lines:

```json
{
  "style": "storeCard",
  "description": "Northstar Coffee loyalty card",
  "organizationName": "Northstar Coffee",
  "logoText": "NORTHSTAR",
  "updatable": true,
  "colors": {
    "backgroundColor": "#123524",
    "foregroundColor": "#FFFFFF",
    "labelColor": "#CFE8D8"
  },
  "fields": {
    "primary": [
      { "key": "points", "label": "POINTS", "value": "120", "changeMessage": "Balance: %@" }
    ]
  },
  "barcodes": [
    { "format": "PKBarcodeFormatQR", "message": "member_0042" }
  ],
  "images": {
    "logo": "<base64 of northstar-logo.png>"
  }
}
```

The server fills in the bundled icon, renders the logo at every scale, signs the
pass, and answers:

```json
{
  "id": "d4f8…",
  "url": "https://pass.abdeen.dev/api/passes/d4f8…",
  "expiresAt": "2026-09-08T18:15:00.000Z",
  "serialNumber": "3f6c1a2e-…",
  "updatable": true,
  "hark": { "sent": true }
}
```

With Hark configured, a notification titled "Northstar Coffee loyalty card"
appears on your iPhone; tap it and add the pass. Otherwise the agent hands you
the URL to open on the iPhone before it expires.

Later:

> Set my Northstar card to 450 points.

The agent calls `get_pass_spec`, changes the value, and calls `update_pass`
with the full spec (omitting `images`, so the stored logo is reused). The
server re-signs, pushes through APNs, and Wallet shows "Balance: 450".

---

## Part 4 — Hark delivery (optional)

Hark is a self-hosted notification app.
With Hark configured, every minted download link — from `create_pass`,
`mint_pass_download`, `POST /api/passes`, and `POST /api/passes/:serial/download`
— goes straight to your iPhone.

### 4.1 Configure

Set both variables on Railway:

| Variable | Value |
| --- | --- |
| `HARK_URL` | the base URL of your Hark deployment, without a trailing slash |
| `HARK_TOKEN` | a Hark API token that carries the `notifications:send` scope |

The server logs `Hark delivery is enabled` at boot when both are present.

### 4.2 What arrives

The server `POST`s to `HARK_URL/notifications` with the pass description as the
title (trimmed to Hark's 80-character limit), the body **Tap to add to Apple
Wallet**, and the download URL as `pass_url`. On the iPhone that is a single
notification; tapping it opens Hark's Add to Wallet sheet with the signed pass
loaded, and Wallet takes it from there.

### 4.3 The delivery result

Responses that mint a link carry a `hark` field:

- `{ "sent": true }` — APNs accepted at least one notification.
- `{ "sent": false, "error": "…" }` — Hark rejected the request, timed out
  (10 s), returned an invalid result, or reported zero accepted notifications.

A failed delivery does not fail the request: the pass is signed and the URL is
valid for its full TTL. The MCP tools spell this out in the result text — either
"Sent to your iPhone through Hark" or "Open the URL on the iPhone", with the
Hark error appended when delivery failed. The field is absent entirely when
Hark is not configured.

### 4.4 Without Hark

Leave `HARK_URL` and `HARK_TOKEN` unset and the server returns the download URL
alone. Open it on the iPhone — paste it into Safari, AirDrop it, send it to
yourself in Messages — before it expires, and Wallet's add sheet appears.

---

## Part 5 — OTA pass updates (optional)

Passes created with `"updatable": true` can be changed after they are in
Wallet. The server stores the spec, stamps `webServiceURL` and a per-pass
`authenticationToken` into the pass, and implements
[Apple's Wallet web service protocol](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes):
iOS registers the device, the server pushes an empty APNs notification on
update, and the device fetches the freshly signed pass.

### 5.1 Persist the database

Updatable passes and device registrations live in SQLite. On Railway, add a
**volume** to the service (Settings → Volumes), mount it at `/data`, and set
`DATA_DIR=/data`. Without a volume the database is wiped on every deploy and
installed passes stop updating.

Also set `PUBLIC_BASE_URL` (e.g. `https://pass.abdeen.dev`) so passes carry
your canonical domain. Wallet requires HTTPS in production — Railway domains
already are.

### 5.2 Create an APNs auth key

Update pushes authenticate with a team-scoped APNs key, not your pass
certificate:

1. Go to [Apple Developer → Keys](https://developer.apple.com/account/resources/authkeys/list),
   create a key with **Apple Push Notifications service (APNs)** enabled.
2. Download `AuthKey_XXXXXXXXXX.p8` (one-time download) and note the 10-char
   **Key ID**.
3. Set `APNS_KEY_ID` and `APNS_KEY_BASE64` (`base64 -i AuthKey_XXXXXXXXXX.p8`)
   on Railway.

Without the key everything still works, but devices only refresh passes on
their own occasional schedule instead of instantly. Pass pushes go to
production APNs only — there is no sandbox for them.

### 5.3 Update a pass

Fields with a `changeMessage` containing `%@` show a notification on the
iPhone when they change. Ask the agent (Part 3) or call the API:

```bash
curl -X PUT https://pass.abdeen.dev/api/passes/<serial> \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @new-spec.json
```

The response reports how many devices were pushed. `GET /api/passes/:serial/spec`
returns the stored spec if you want to modify rather than rebuild it.

---

## Troubleshooting

- **Wallet cannot read the signed pass** — the pass id may have expired (default
  15 min) or the server URL may be wrong. Create the pass again, or mint a fresh
  link for an updatable one.
- **Wallet says "Pass cannot be installed"** — almost always a certificate
  mismatch: the signing cert must belong to the exact `PASS_TYPE_IDENTIFIER` and
  `TEAM_IDENTIFIER` the server is configured with. Also confirm you used WWDR
  **G4** and that all three base64 vars decode to PEM files (`-----BEGIN …`).
- **`images must include "icon"`** — a REST call without an icon. Add one, or
  create the pass over MCP, where the bundled icon fills in.
- **`images.<slot> could not be decoded`** — the base64 is not a PNG, JPEG, or
  WebP, or it is truncated. Re-encode the source file.
- **`provide one image per slot`** — a scaled key such as `logo@2x` was sent.
  Send the slot name alone; the server renders every scale.
- **Server 401** — the bearer token in the MCP client's header (or the script)
  doesn't match the `API_TOKEN` configured on Railway.
- **`hark: { sent: false }`** — the pass is fine; delivery failed. Check
  `HARK_URL`, that the token carries `notifications:send`, and that the iPhone
  is registered with Hark. Open the returned URL on the iPhone meanwhile.
- **A poster event ticket renders as a plain pass** — Wallet falls back silently
  when a poster requirement is missing; a poster needs at least a barcode (or
  NFC). To see the exact reason, connect the iPhone, open Console.app, and
  filter for the `passd` process while adding the pass.

## Notes

- The pass spec is defined in `server/src/types.ts`; the agent-facing guide in
  `server/src/mcp.ts` and the artwork slots in `server/src/slots.ts` describe
  the same surface — keep them in agreement.
- The server keeps one-shot signed passes only in memory. A redeploy or restart
  drops pending ids; that's fine, just create the pass again. Updatable passes
  persist in SQLite under `DATA_DIR` — on Railway, keep that on a volume.
- The server uses Bun locally. Railway builds `server/` from its
  `Dockerfile`, so the deploy does not depend on lockfile-based builder
  detection.

---

`NIGHTFIELD//OPEN`
