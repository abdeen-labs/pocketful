# Pocketful

Design an Apple Wallet pass on your phone, get it signed by your own server, add it
to Wallet. Entirely self-hosted: no Expo cloud services (no EAS Build/Update/Submit,
no Expo account needed), and the app runs as a local Xcode build.

```
app/      Expo (TypeScript, expo-router) — the pass designer UI
server/   Node + Express — signs .pkpass files with passkit-generator, deployed on Railway
```

**How it works**

1. You design a pass in the app: style, colors, fields, barcode, and images picked
   from your photo library (converted on-device to the exact PNG sizes Wallet wants).
2. The app `POST`s the pass spec as JSON to the server, which builds and signs a
   `.pkpass` **in memory** and stores it under a short-lived random id (15 min).
3. The app opens the returned `GET` URL. Safari sees
   `Content-Type: application/vnd.apple.pkpass` and hands it to Wallet, which shows
   the add-pass sheet. (Two steps because iOS can't open a POST response from a link.)

Signing happens server-side because [passkit-generator](https://github.com/alexandercerutti/passkit-generator)
is Node-only — it can never run inside the app.

Follow the three parts below **in order**.

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
3. In the service settings, set **Root Directory** to `server`. Railway detects a
   Node app (`npm run build` then `npm start`).
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
   | `API_TOKEN` | optional — if set, `POST /api/passes` requires `Authorization: Bearer <token>` |
   | `PASS_TTL_SECONDS` | optional — how long a created pass stays downloadable (default 900) |

5. Under **Settings → Networking**, click **Generate Domain**. That
   `https://….up.railway.app` URL is your pass server URL.
6. Verify:

```bash
curl https://YOUR-DOMAIN.up.railway.app/healthz
```

Expected: `{"ok":true}`. The server fails fast at boot with a clear message if a
cert variable is missing or isn't valid base64-of-PEM — check the deploy logs.

### API

- `POST /api/passes` — body is a pass spec (see `server/src/types.ts`). Signs the
  pass immediately; returns `{ id, url, expiresAt }` or a `4xx` with
  `{ error: "..." }` explaining what's wrong with the spec.
- `GET /api/passes/:id` — the signed bytes, `Content-Type: application/vnd.apple.pkpass`.
  404 after expiry.

### Run the server locally (optional)

```bash
cd server && npm install && npm run dev
```

with the same variables in the environment. A quick way to test without real certs
is self-signed ones (Wallet will refuse the result, but the API works end-to-end).

---

## Part 3 — Build the app locally

No EAS — the app is compiled on your Mac with Xcode.

1. Configure the app:

```bash
cd app && bun install
```

   Create `app/.env` (see `app/.env.example`):

   ```
   EXPO_PUBLIC_PASS_SERVER_URL=https://YOUR-DOMAIN.up.railway.app
   ```

   (The URL is also editable inside the app, in the Server section of the form —
   the env var is just the default.)

2. If you use a different Apple team/bundle id, change `ios.bundleIdentifier` in
   `app/app.json` (currently `dev.abdeen.pocketful`).

3. Build and run on your iPhone:

```bash
npx expo run:ios --device
```

   This generates the native `app/ios/` project (gitignored), compiles with Xcode,
   and starts Metro. First run: pick your device, and approve signing in Xcode if
   prompted (open `app/ios/Pocketful.xcworkspace`, select your team under Signing &
   Capabilities).

   Prefer building from Xcode itself? Run `npx expo prebuild --platform ios` once,
   open the workspace, and hit Run — but keep `npx expo start` running in a
   terminal so the debug build can load JS from Metro.

4. In the app: pick a style, colors, fields, a barcode, choose an icon image
   (required — Wallet rejects passes without one), hit **Create pass & add to
   Wallet**. Safari opens for a moment, then Wallet's add sheet appears.

---

## Troubleshooting

- **Safari opens but shows the URL as text / downloads nothing** — the pass id
  expired (default 15 min) or the server URL is wrong. Create the pass again.
- **Wallet says "Pass cannot be installed"** — almost always a certificate
  mismatch: the signing cert must belong to the exact `PASS_TYPE_IDENTIFIER` and
  `TEAM_IDENTIFIER` the server is configured with. Also confirm you used WWDR
  **G4** and that all three base64 vars decode to PEM files (`-----BEGIN …`).
- **`images.icon is not a PNG`** — the picked photo failed conversion; try another
  image. The app converts everything to PNG on-device before upload.
- **Server 401** — you set `API_TOKEN` on Railway but not in the app's Server
  section (or `EXPO_PUBLIC_PASS_API_TOKEN` in `app/.env`).
- **Build errors after changing `app.json`** — regenerate native code:
  `cd app && npx expo prebuild --platform ios --clean`, then build again.

## Notes

- The pass spec type lives in both `server/src/types.ts` and `app/src/types.ts` —
  they're mirrored by hand; keep them in sync.
- The server keeps signed passes only in memory. A redeploy or restart drops
  pending ids; that's fine, just create the pass again.
- `server/` uses npm (its `package-lock.json` is what makes Railway treat it as a
  Node app); `app/` uses bun.
