<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lockup-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/lockup-light.svg">
  <img src="docs/assets/lockup-dark.svg" alt="Abdeen Labs" width="205" height="40">
</picture>

`AXIS//OPEN`

</div>

# Pocketful

<p align="center">
  <img src="docs/assets/pocketful-icon.png" width="112" alt="Pocketful app icon">
</p>

Pocketful is a self-hosted Apple Wallet pass designer for iPhone. Build a pass visually, sign it with your own server, and open Apple's native add-to-Wallet sheet. The only service involved is the signing server you deploy yourself.

Pocketful is an Abdeen Labs internal tool. The source is public.

## What you can build

- Generic passes, store cards, coupons, event tickets, and boarding passes
- Passes from 11 curated templates or a blank design
- Custom colors, artwork, rich fields, multiple barcode formats, and live previews
- Location, beacon, relevant-date, localization, personalization, and NFC metadata
- Modern poster event tickets, enhanced boarding passes, semantics, and pass actions
- Short-lived signed passes produced by a server that keeps your Apple certificates private
- Updatable passes: the server implements Apple's Wallet web service protocol and pushes new versions over the air to passes already in Wallet
- Agent-made passes: an MCP server lets an AI agent (Claude, etc.) create and update passes from a prompt

## How it works

1. The app turns your design and on-device artwork into a JSON pass specification.
2. The Express service validates the specification, builds and signs a `.pkpass` in memory, and returns a short-lived download URL.
3. The app downloads the signed pass and presents it with PassKit's native Wallet sheet.

Signing stays on the server because [`passkit-generator`](https://github.com/alexandercerutti/passkit-generator) runs on Node.js and because signing credentials should never ship inside the app.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`app/`](app/) | Native SwiftUI pass designer — an Xcode project with no third-party dependencies |
| [`server/`](server/) | Node.js, Express, and TypeScript API that validates, signs, serves, and OTA-updates passes |
| [`mcp/`](mcp/) | MCP server exposing pass creation and updates as tools for AI agents |
| [`docs/`](docs/) | Abdeen Labs brand assets used by this README |
| [`INSTRUCTIONS.md`](INSTRUCTIONS.md) | Complete certificate, deployment, and iPhone build guide |

## Getting started

You will need macOS with Xcode 27 or newer, an iPhone running iOS 27 for the complete Wallet flow, a paid Apple Developer account, and Bun for the server tooling.

Start with the [complete setup guide](INSTRUCTIONS.md). It walks through creating a Pass Type ID, exporting the required Apple certificates, deploying the signing service, and building the app locally.

Once the signing environment is configured, run the server:

```bash
cd server
bun install
bun run dev
```

Then build the app for your iPhone: open `app/Pocketful/Pocketful.xcodeproj` in Xcode, select your signing team under Signing & Capabilities, and run on your device.

The app defaults to `https://pass.abdeen.dev`. Point it at your own deployment in **Advanced → Server** inside the app — the URL and API token persist on the device.

## Development

| Area | Command | Description |
| --- | --- | --- |
| App | `open app/Pocketful/Pocketful.xcodeproj` | Open the app in Xcode; build and run from there |
| Server | `bun run dev` | Run the API with TypeScript watch mode |
| Server | `bun run build` | Compile the API to `server/dist` |
| Server | `bun run start` | Run the compiled API |

The pass specification is defined in [`server/src/types.ts`](server/src/types.ts) and mirrored by hand in the app's [`PassSpec.swift`](app/Pocketful/Pocketful/Models/PassSpec.swift) — update them together.

## API at a glance

- `GET /healthz` checks service health.
- `POST /api/passes` validates and signs a pass specification, then returns its ID, download URL, and expiration time. With `"updatable": true` the server also keeps the spec and returns a stable `serialNumber`.
- `GET /api/passes/:id` returns the signed `.pkpass` until it expires.
- `PUT /api/passes/:serial` replaces an updatable pass's spec, re-signs it, and pushes the change to registered devices via APNs.
- `GET /api/passes`, `GET /api/passes/:serial/spec`, `POST /api/passes/:serial/download`, and `DELETE /api/passes/:serial` manage updatable passes.
- `POST|DELETE /v1/devices/…`, `GET /v1/devices/…`, `GET /v1/passes/…`, and `POST /v1/log` implement [Apple's Wallet web service protocol](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes) — iOS calls these on its own; you never do.

One-shot passes are held only in memory and expire after 15 minutes by default. Updatable passes persist in SQLite (`DATA_DIR`, a mounted volume on Railway). The management API always requires an `API_TOKEN` bearer token. See [`INSTRUCTIONS.md`](INSTRUCTIONS.md) for the environment variables and troubleshooting notes.

## Privacy

No account is required. Designs and artwork stay on your device while you edit. Creating a pass sends the specification to one place — the signing server you configure — where it is signed in memory and dropped after the download window. Passes you mark as updatable are the exception: the server keeps their specification so it can re-sign and push new versions. Signing certificates stay on the server and never enter the app.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/seal-roundel-chalk.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/seal-roundel-carbon.svg">
  <img src="docs/assets/seal-roundel-chalk.svg" alt="Abdeen Labs roundel seal" width="72" height="72">
</picture>

`AXIS//OPEN`

</div>
