`AXIS//OPEN`

# Pocketful setup guide

Design an Apple Wallet pass on your phone, get it signed by your own server, add it
to Wallet. Entirely self-hosted: the app is a local Xcode build, and the only
service involved is the signing server you deploy.

```
app/      Native SwiftUI iPhone app — the pass designer UI
server/   Node + Express — signs .pkpass files with passkit-generator, deployed on Railway
mcp/      MCP server — exposes pass creation and updates to AI agents (Part 5)
```

**How it works**

1. You design a pass in the app: style, modern layouts, colors, rich fields,
   barcodes, relevance, semantics, NFC, localization, personalization, actions,
   and artwork picked from your photo library (converted on-device to Wallet PNG sizes).
2. The app `POST`s the pass spec as JSON to the server, which builds and signs a
   `.pkpass` **in memory** and stores it under a short-lived random id (15 min).
3. The app downloads the returned `GET` URL and presents Wallet's native add-pass
   sheet in-app with PassKit. (Two steps because the server must first sign and store
   the pass before iOS can load it.)

Signing happens server-side because [passkit-generator](https://github.com/alexandercerutti/passkit-generator)
is Node-only — it can never run inside the app.

Follow the first three parts below **in order**. Parts 4 and 5 are optional:
over-the-air pass updates and letting an AI agent make passes for you.

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
   | `ORGANIZATION_NAME` | optional — default org name on passes |
   | `API_TOKEN` | the bearer token required by the pass management API — generate a long random one, e.g. `openssl rand -hex 32` |
   | `PASS_TTL_SECONDS` | optional — how long a created pass stays downloadable (default 900) |
   | `PASS_STORE_MAX_BYTES` | optional — byte ceiling for the in-memory store of downloadable passes; oldest entries evict first (default 134217728, i.e. 128 MB) |
   | `PUBLIC_BASE_URL` | optional — public origin stamped into updatable passes as `webServiceURL`, e.g. `https://pass.abdeen.dev`; defaults to the request's own host |
   | `DATA_DIR` | optional — where the SQLite database for updatable passes lives (default `./data`); point it at a mounted volume |
   | `APNS_KEY_ID` | optional — key ID of an APNs auth key, enables update pushes (Part 4) |
   | `APNS_KEY_BASE64` | optional — base64 of the whole `AuthKey_XXXXXXXXXX.p8` file |

5. Under **Settings → Networking**, add the custom domain `pass.abdeen.dev` and
   create the CNAME record Railway shows at your DNS provider. (Or click
   **Generate Domain** for a quick `….up.railway.app` URL first — the server
   works on any domain; the app defaults to `https://pass.abdeen.dev`.)
6. Verify:

```bash
curl https://pass.abdeen.dev/healthz
```

Expected: `{"ok":true}`. The server fails fast at boot with a clear message if a
cert variable is missing or isn't valid base64-of-PEM — check the deploy logs.

### API

- `POST /api/passes` — body is a pass spec (see `server/src/types.ts`). Signs the
  pass immediately; returns `{ id, url, expiresAt }` or a `4xx` with
  `{ error: "..." }` explaining what's wrong with the spec. With
  `"updatable": true` the response also carries a stable `serialNumber` and the
  server keeps the spec for OTA updates (Part 4).
- `GET /api/passes/:id` — the signed bytes, `Content-Type: application/vnd.apple.pkpass`.
  404 after expiry.
- `PUT /api/passes/:serial` — full replacement spec for an updatable pass;
  re-signs, bumps the update tag, and pushes to registered devices.
- `GET /api/passes` — list updatable passes with registration counts.
- `GET /api/passes/:serial/spec` — the stored spec, for read-modify-write updates.
- `POST /api/passes/:serial/download` — mint a fresh short-lived download URL.
- `DELETE /api/passes/:serial` — forget an updatable pass and its registrations.
- `/v1/…` — Apple's Wallet web service protocol (device registration, change
  polling, latest-pass fetch, logging). iOS calls these itself.

The pass spec mirrors the pass-building surface of the installed
`passkit-generator` version: formatted/date/number fields, multiple barcode
fallbacks, locations, beacons, old and new relevant dates, expiration, NFC,
pass and field semantics, app and web-service behavior, localized strings and
media, personalization, poster event and enhanced boarding actions, and iOS 26
upcoming-pass information. Signing identity and certificates intentionally stay
server-owned rather than being accepted from the app.

### Run the server locally (optional)

```bash
cd server && bun install && bun run dev
```

with the same variables in the environment. A quick way to test without real certs
is self-signed ones (Wallet will refuse the result, but the API works end-to-end).

---

## Part 3 — Build the app locally

The app is a native SwiftUI Xcode project with zero third-party dependencies —
there is nothing to install first.

1. Open `app/Pocketful/Pocketful.xcodeproj` in Xcode 27 or newer.

2. Under **Signing & Capabilities**, select your team. If you use a different
   bundle identifier, change it there too (currently `dev.abdeen.pocketful`).

3. Select your iPhone (iOS 27 or newer) as the run destination and hit Run.
   The complete Wallet flow needs a physical device.

4. In the app, work through the Design, Content, Smart, and Advanced tabs,
   choose an icon image (required — Wallet rejects passes without one), then hit
   **Create pass & add to Wallet**. Wallet's add sheet appears directly in Pocketful.

   The app points at `https://pass.abdeen.dev` out of the box. To use your own
   deployment, set the URL (and API token, if the server has one configured) in
   **Advanced → Server** — both persist on the device.

---

## Part 4 — OTA pass updates (optional)

Passes created with the **Updatable (OTA)** toggle (or `"updatable": true` in
the spec) can be changed after they are in Wallet. The server stores the spec,
stamps `webServiceURL` and a per-pass `authenticationToken` into the pass, and
implements [Apple's Wallet web service protocol](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes):
iOS registers the device, the server pushes an empty APNs notification on
update, and the device fetches the freshly signed pass.

### 4.1 Persist the database

Updatable passes and device registrations live in SQLite. On Railway, add a
**volume** to the service (Settings → Volumes), mount it at `/data`, and set
`DATA_DIR=/data`. Without a volume the database is wiped on every deploy and
installed passes stop updating.

Also set `PUBLIC_BASE_URL` (e.g. `https://pass.abdeen.dev`) so passes carry
your canonical domain. Wallet requires HTTPS in production — Railway domains
already are.

### 4.2 Create an APNs auth key

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

### 4.3 Update a pass

Fields with a `changeMessage` containing `%@` show a notification on the
iPhone when they change. Update via the API (or the MCP tools in Part 5):

```bash
curl -X PUT https://pass.abdeen.dev/api/passes/<serial> \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  --data @new-spec.json
```

The response reports how many devices were pushed. `GET /api/passes/:serial/spec`
returns the stored spec if you want to modify rather than rebuild it.

---

## Part 5 — Let an AI agent make passes (optional)

`mcp/` is an [MCP](https://modelcontextprotocol.io) server that exposes the
signing server to AI agents as tools: `create_pass`, `update_pass`,
`get_pass_spec`, `list_passes`, `mint_pass_download`, and `delete_pass`. It
runs anywhere Bun runs and needs no build step:

```bash
cd mcp && bun install
```

Register it with Claude Code:

```bash
claude mcp add pocketful \
  --env POCKETFUL_SERVER_URL=https://pass.abdeen.dev \
  --env POCKETFUL_API_TOKEN=<your API_TOKEN> \
  -- bun /path/to/pocketful/mcp/src/index.ts
```

(Or add the same command/env to any other MCP client.) Then ask the agent for
a pass — "make me an updatable loyalty card, 100 points, dark blue" — and open
the returned URL on your iPhone. If the agent supplies no icon, a bundled
default is used; agents can also pass local PNG paths via `image_files`.
Because the pass is updatable, "set my loyalty card to 450 points" later
pushes the change straight to Wallet.

---

## Troubleshooting

- **Wallet cannot read the signed pass** — the pass id may have expired (default
  15 min) or the server URL may be wrong. Create the pass again.
- **Wallet says "Pass cannot be installed"** — almost always a certificate
  mismatch: the signing cert must belong to the exact `PASS_TYPE_IDENTIFIER` and
  `TEAM_IDENTIFIER` the server is configured with. Also confirm you used WWDR
  **G4** and that all three base64 vars decode to PEM files (`-----BEGIN …`).
- **`images.icon is not a PNG`** — the picked photo failed conversion; try another
  image. The app converts everything to PNG on-device before upload.
- **Server 401** — the API token in the app's **Advanced → Server** section
  doesn't match the `API_TOKEN` configured on Railway.
- **A poster event ticket renders as a plain pass** — Wallet falls back silently
  when a poster requirement is missing; a poster needs at least a barcode (or
  NFC). To see the exact reason, connect the iPhone, open Console.app, and
  filter for the `passd` process while adding the pass.

## Notes

- The pass spec is defined in `server/src/types.ts` and mirrored by hand in the
  app's `Pocketful/Models/PassSpec.swift` — keep them in sync.
- The server keeps one-shot signed passes only in memory. A redeploy or restart
  drops pending ids; that's fine, just create the pass again. Updatable passes
  persist in SQLite under `DATA_DIR` — on Railway, keep that on a volume.
- The server and MCP use Bun locally. Railway builds `server/` from its
  `Dockerfile`, so the deploy does not depend on lockfile-based builder
  detection.

---

`AXIS//OPEN`
