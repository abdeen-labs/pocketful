<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/lockup-dark.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/lockup-light.svg">
  <img src="docs/assets/lockup-dark.svg" alt="Abdeen Labs" width="205" height="40">
</picture>

`NIGHTFIELD//OPEN`

</div>

# Pocketful

<p align="center">
  <img src="docs/assets/pocketful-icon.png" width="112" alt="Pocketful icon">
</p>

Pocketful is a self-hosted Apple Wallet pass signing server for one person. Describe a pass to an AI agent — Claude Code, Claude Desktop, anything that speaks MCP — and the server validates the spec, sizes the artwork, signs a `.pkpass` with your own certificates, and hands back a short-lived download URL. With Hark configured, the pass reaches your iPhone as a notification; tap it and Wallet's add sheet opens. The only service involved is the one you deploy yourself.

Pocketful is an Abdeen Labs internal tool. The source is public.

## What you can build

- Generic passes, store cards, coupons, event tickets, boarding passes, and iOS 27 poster layouts
- Agent-made passes: an AI agent turns a prompt into a spec and calls the server's MCP endpoint from any machine
- Custom colors, rich fields, multiple barcode formats, semantics, featured actions, and additional style dictionaries for older iOS
- Location, beacon, relevant-date, localization, personalization, and NFC metadata
- Server-side artwork sizing: one source image per slot, center-cropped and rendered at 1x, 2x, and 3x by the server
- Short-lived signed passes produced by a server that keeps your Apple certificates private
- Hark delivery: every minted pass lands on your iPhone as a notification whose tap opens Add to Wallet
- Updatable passes: the server implements Apple's Wallet web service protocol and pushes revised versions over the air to passes already in Wallet

## How it works

1. An agent (or a script) sends a JSON pass specification to the server — over MCP at `/mcp`, or REST at `POST /api/passes`. Artwork travels inline as base64 source images.
2. The Express service validates the specification, crops and renders each image at every Wallet scale, builds and signs a `.pkpass` in memory, and returns a short-lived download URL.
3. With Hark configured, the server pushes that URL to your iPhone as a notification; tapping it opens Hark's Add to Wallet sheet. Without Hark, open the URL on the iPhone.

Signing stays on the server because [`passkit-generator`](https://github.com/alexandercerutti/passkit-generator) runs on Node.js and because the signing certificates belong in exactly one place.

## Repository layout

| Path | Purpose |
| --- | --- |
| [`server/`](server/) | Node.js, Express, and TypeScript API that validates, signs, serves, delivers, and OTA-updates passes, and exposes the same operations to AI agents over MCP |
| [`docs/`](docs/) | Abdeen Labs brand assets used by this README |
| [`INSTRUCTIONS.md`](INSTRUCTIONS.md) | Complete certificate, deployment, agent, Hark, and OTA guide |

## Getting started

You will need a paid Apple Developer account, an iPhone to receive passes, Bun for the server tooling, and an MCP client such as Claude Code.

Start with the [complete setup guide](INSTRUCTIONS.md). It walks through creating a Pass Type ID, exporting the required Apple certificates, deploying the signing service, and connecting an agent.

Once the signing environment is configured, run the server:

```bash
cd server
bun install
bun run dev
```

Then register the deployed endpoint with Claude Code:

```bash
claude mcp add --transport http pocketful https://pass.abdeen.dev/mcp \
  --header "Authorization: Bearer <API_TOKEN>"
```

Ask the agent for a pass. It calls `create_pass`, the server signs the result, and the download link arrives on your iPhone through Hark or as a URL to open there.

## Development

| Command | Description |
| --- | --- |
| `bun run dev` | Run the API with TypeScript watch mode |
| `bun run test` | Run the test suite |
| `bun run typecheck` | Type-check without emitting |
| `bun run build` | Compile the API to `server/dist` |
| `bun run start` | Run the compiled API |

The pass specification is defined in [`server/src/types.ts`](server/src/types.ts). The agent-facing summary of it lives in [`server/src/mcp.ts`](server/src/mcp.ts) and the artwork slots in [`server/src/slots.ts`](server/src/slots.ts) — keep the three in agreement.

## API at a glance

- `GET /healthz` checks service health.
- `POST /api/passes` validates and signs a pass specification, then returns `{ id, url, expiresAt }`. With `"updatable": true` the server also keeps the spec and returns a stable `serialNumber`. With Hark configured, the response carries a `hark` delivery result.
- `GET /api/passes/:id` returns the signed `.pkpass` until it expires. It takes no token: the random id is the credential.
- `PUT /api/passes/:serial` replaces an updatable pass's spec, re-signs it, and pushes the change to registered devices via APNs.
- `GET /api/passes`, `GET /api/passes/:serial/spec`, `POST /api/passes/:serial/download`, and `DELETE /api/passes/:serial` manage updatable passes.
- `POST /mcp` serves the same operations to AI agents over MCP (Streamable HTTP), behind the same bearer token.
- `POST|DELETE /v1/devices/…`, `GET /v1/devices/…`, `GET /v1/passes/…`, and `POST /v1/log` implement [Apple's Wallet web service protocol](https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes) — iOS calls these on its own; you never do.

One-shot passes are held only in memory and expire after 15 minutes by default. Updatable passes persist in SQLite (`DATA_DIR`, a mounted volume on Railway). The management API and the MCP endpoint always require the `API_TOKEN` bearer token. See [`INSTRUCTIONS.md`](INSTRUCTIONS.md) for the environment variables and troubleshooting notes.

## Privacy

No account is required. A pass specification goes to one place — the signing server you deploy — where it is signed in memory and dropped after the download window. Passes marked updatable are the exception: the server keeps their specification so it can re-sign and push revised versions. With Hark configured, the download URL also passes through your own Hark deployment and nothing else. Signing certificates stay on the server.

<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="docs/assets/seal-roundel-chalk.svg">
  <source media="(prefers-color-scheme: light)" srcset="docs/assets/seal-roundel-carbon.svg">
  <img src="docs/assets/seal-roundel-chalk.svg" alt="Abdeen Labs roundel seal" width="72" height="72">
</picture>

`NIGHTFIELD//OPEN`

</div>
