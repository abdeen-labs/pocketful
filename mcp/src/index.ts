#!/usr/bin/env bun
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

// Thin agent-facing wrapper around the Pocketful signing server's HTTP API.
// The server does all validation and signing; this adds the conveniences an
// agent needs: a bundled fallback icon, local-file image loading, and
// image-stripped spec reads so base64 blobs never enter the model context.

const SERVER_URL = (
  process.env.POCKETFUL_SERVER_URL ?? "https://pass.abdeen.dev"
).replace(/\/+$/, "");
const API_TOKEN = process.env.POCKETFUL_API_TOKEN;

const ASSETS_DIR = path.join(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "assets"
);

type Spec = Record<string, unknown>;

async function api(
  method: string,
  route: string,
  body?: unknown
): Promise<unknown> {
  const response = await fetch(`${SERVER_URL}${route}`, {
    method,
    headers: {
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  const text = await response.text();
  if (!response.ok) {
    let message = text;
    try {
      message = (JSON.parse(text) as { error?: string }).error ?? text;
    } catch {
      // non-JSON error body; use as-is
    }
    throw new Error(`${response.status}: ${message || response.statusText}`);
  }
  return text ? JSON.parse(text) : {};
}

function specImages(spec: Spec): Record<string, string> {
  if (
    typeof spec.images !== "object" ||
    spec.images === null ||
    Array.isArray(spec.images)
  ) {
    spec.images = {};
  }
  return spec.images as Record<string, string>;
}

/** Merge local PNG files into spec.images as base64. */
function mergeImageFiles(spec: Spec, imageFiles?: Record<string, string>): void {
  if (!imageFiles) return;
  const images = specImages(spec);
  for (const [name, filePath] of Object.entries(imageFiles)) {
    images[name] = readFileSync(filePath).toString("base64");
  }
}

/** Wallet rejects passes without an icon; fall back to the bundled one. */
function ensureIcon(spec: Spec): boolean {
  const images = specImages(spec);
  if (images.icon || images["icon@2x"] || images["icon@3x"]) return false;
  images.icon = readFileSync(path.join(ASSETS_DIR, "icon-29.png")).toString(
    "base64"
  );
  images["icon@2x"] = readFileSync(
    path.join(ASSETS_DIR, "icon-58.png")
  ).toString("base64");
  images["icon@3x"] = readFileSync(
    path.join(ASSETS_DIR, "icon-87.png")
  ).toString("base64");
  return true;
}

/** Replace base64 image payloads with size notes so they stay out of context. */
function withImageSummaries(spec: Spec): Spec {
  const images = spec.images;
  if (typeof images !== "object" || images === null) return spec;
  const summarized: Record<string, string> = {};
  for (const [name, data] of Object.entries(images as Record<string, string>)) {
    const bytes = typeof data === "string" ? Math.floor((data.length * 3) / 4) : 0;
    summarized[name] = `<PNG, ~${bytes} bytes — base64 omitted>`;
  }
  return { ...spec, images: summarized };
}

function ok(payload: unknown, note?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text:
          JSON.stringify(payload, null, 2) + (note ? `\n\n${note}` : ""),
      },
    ],
  };
}

function fail(err: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: `Error: ${err instanceof Error ? err.message : String(err)}`,
      },
    ],
    isError: true,
  };
}

const SPEC_GUIDE = `The spec is a Pocketful PassSpec (mirrors server/src/types.ts):
- Required: style ("generic" | "storeCard" | "coupon" | "eventTicket" | "boardingPass"), description (≤200 chars), images (auto-filled with a default icon when omitted).
- updatable: true — the server keeps the pass and can push OTA updates to Wallet later; the response then includes its serialNumber.
- colors: { backgroundColor, foregroundColor, labelColor, stripColor?, footerBackgroundColor? } as #RRGGBB.
- fields: { header?, primary?, secondary?, auxiliary?, back? } arrays of { key, label?, value, changeMessage? ("...%@..." shows a Wallet notification on update), dateStyle?, currencyCode?, numberStyle?, textAlignment? }.
- barcodes: [{ format: "PKBarcodeFormatQR" | "PKBarcodeFormatPDF417" | "PKBarcodeFormatAztec" | "PKBarcodeFormatCode128", message, altText? }].
- images maps Wallet asset names (icon, logo, primaryLogo, secondaryLogo, strip, thumbnail, background, footer, artwork — optionally @2x/@3x) to base64 PNG strings; prefer image_files with local paths instead of inlining base64.
- Also supported: organizationName, logoText, serialNumber, expirationDate/relevantDates (ISO-8601), locations, beacons, nfc, localizations, personalization, semantics, preferredStyleSchemes (posterEventTicket needs eventTicket style + artwork + eventName/venue semantics), transitType (boardingPass), upcomingPassInformation.
The server validates strictly and returns specific error messages — fix and retry on 400s.`;

const server = new McpServer({ name: "pocketful", version: "1.0.0" });

server.registerTool(
  "create_pass",
  {
    title: "Create an Apple Wallet pass",
    description:
      `Build, sign, and host an Apple Wallet pass from a JSON spec. Returns a short-lived download URL (open it on the iPhone to get the native add-to-Wallet sheet) and, for updatable passes, the serialNumber used for future updates.\n\n${SPEC_GUIDE}`,
    inputSchema: {
      spec: z
        .record(z.string(), z.unknown())
        .describe("The PassSpec object (see tool description)"),
      image_files: z
        .record(z.string(), z.string())
        .optional()
        .describe(
          "Map of Wallet image names (e.g. icon, logo, strip, artwork, background — optionally @2x/@3x) to local PNG file paths; they are read and inlined for you"
        ),
    },
  },
  async ({ spec, image_files }) => {
    try {
      const body = { ...(spec as Spec) };
      mergeImageFiles(body, image_files);
      const usedDefaultIcon = ensureIcon(body);
      const result = await api("POST", "/api/passes", body);
      return ok(
        result,
        (usedDefaultIcon
          ? "Note: no icon was provided, so the bundled Pocketful icon was used.\n"
          : "") +
          "Open the URL on the iPhone before it expires to add the pass to Wallet."
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "update_pass",
  {
    title: "Update an updatable pass",
    description:
      "Replace the spec of an updatable pass and push the change to every Wallet that holds it (OTA). Send the FULL new spec — call get_pass_spec first and modify it. If you omit images entirely, the stored images are reused. Fields whose changeMessage contains %@ produce a notification on the device.",
    inputSchema: {
      serial_number: z.string().describe("The pass's serial number"),
      spec: z
        .record(z.string(), z.unknown())
        .describe("The full replacement PassSpec"),
      image_files: z
        .record(z.string(), z.string())
        .optional()
        .describe("Local PNG file paths to inline, as in create_pass"),
    },
  },
  async ({ serial_number, spec, image_files }) => {
    try {
      const body = { ...(spec as Spec) };
      mergeImageFiles(body, image_files);
      if (Object.keys(specImages(body)).length === 0) {
        const stored = (await api(
          "GET",
          `/api/passes/${encodeURIComponent(serial_number)}/spec`
        )) as { spec: Spec };
        body.images = stored.spec.images;
      }
      const result = await api(
        "PUT",
        `/api/passes/${encodeURIComponent(serial_number)}`,
        body
      );
      return ok(result);
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "get_pass_spec",
  {
    title: "Get the stored spec of an updatable pass",
    description:
      "Fetch the current spec of an updatable pass for read-modify-write updates. Image contents are replaced with size placeholders; update_pass reuses the stored images automatically when you omit images.",
    inputSchema: {
      serial_number: z.string().describe("The pass's serial number"),
    },
  },
  async ({ serial_number }) => {
    try {
      const result = (await api(
        "GET",
        `/api/passes/${encodeURIComponent(serial_number)}/spec`
      )) as { serialNumber: string; updatedAt: string; spec: Spec };
      return ok({ ...result, spec: withImageSummaries(result.spec) });
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "list_passes",
  {
    title: "List updatable passes",
    description:
      "List every updatable pass the server manages, with serial number, description, timestamps, and how many devices are registered for updates.",
  },
  async () => {
    try {
      return ok(await api("GET", "/api/passes"));
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "mint_pass_download",
  {
    title: "Mint a fresh download link",
    description:
      "Create a new short-lived download URL for an existing updatable pass, e.g. to add it to another iPhone.",
    inputSchema: {
      serial_number: z.string().describe("The pass's serial number"),
    },
  },
  async ({ serial_number }) => {
    try {
      return ok(
        await api(
          "POST",
          `/api/passes/${encodeURIComponent(serial_number)}/download`
        ),
        "Open the URL on the iPhone before it expires to add the pass to Wallet."
      );
    } catch (err) {
      return fail(err);
    }
  }
);

server.registerTool(
  "delete_pass",
  {
    title: "Delete an updatable pass",
    description:
      "Permanently remove an updatable pass and its device registrations from the server. Copies already in Wallet stop receiving updates but are not removed from devices.",
    inputSchema: {
      serial_number: z.string().describe("The pass's serial number"),
    },
    annotations: { destructiveHint: true },
  },
  async ({ serial_number }) => {
    try {
      return ok(
        await api(
          "DELETE",
          `/api/passes/${encodeURIComponent(serial_number)}`
        )
      );
    } catch (err) {
      return fail(err);
    }
  }
);

await server.connect(new StdioServerTransport());
console.error(`pocketful-mcp connected — server: ${SERVER_URL}`);
if (!API_TOKEN) {
  console.error(
    "warning: POCKETFUL_API_TOKEN is not set — the signing server requires it and will reject every request"
  );
}
