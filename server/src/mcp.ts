import { readFileSync } from "node:fs";
import path from "node:path";
import type express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { HarkDelivery } from "./hark";
import type { PassService } from "./passService";
import { slotGuide } from "./slots";
import { ApiError } from "./validate";

// Agent-facing tools over the same pass operations as the REST API. The
// endpoint is stateless: every POST gets its own McpServer and transport,
// which are torn down when the response closes. Auth and body parsing happen
// in the Express layer before this module sees the request.

type Spec = Record<string, unknown>;

const DEFAULT_ICON = path.join(__dirname, "../assets/icon.svg");

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

/** Wallet rejects passes without an icon; fall back to the bundled one. */
function ensureIcon(spec: Spec): boolean {
  const images = specImages(spec);
  if (images.icon) return false;
  images.icon = readFileSync(DEFAULT_ICON).toString("base64");
  return true;
}

/** Replace base64 image payloads with size notes so they stay out of context. */
function withImageSummaries(spec: Spec): Spec {
  const images = spec.images;
  if (typeof images !== "object" || images === null) return spec;
  const summarized: Record<string, string> = {};
  for (const [name, data] of Object.entries(images as Record<string, string>)) {
    const bytes =
      typeof data === "string" ? Math.floor((data.length * 3) / 4) : 0;
    summarized[name] = `<source image, ~${bytes} bytes — base64 omitted>`;
  }
  return { ...spec, images: summarized };
}

function ok(payload: unknown, note?: string) {
  return {
    content: [
      {
        type: "text" as const,
        text: JSON.stringify(payload, null, 2) + (note ? `\n\n${note}` : ""),
      },
    ],
  };
}

function fail(err: unknown) {
  const text =
    err instanceof ApiError
      ? `Error ${err.status}: ${err.message}`
      : `Error: ${err instanceof Error ? err.message : String(err)}`;
  return { content: [{ type: "text" as const, text }], isError: true };
}

const OPEN_ON_IPHONE =
  "Open the URL on the iPhone before it expires to add the pass to Wallet.";
const SENT_THROUGH_HARK =
  "Sent to your iPhone through Hark. Tap the notification to add the pass to Wallet.";

function deliveryNote(hark: HarkDelivery | undefined): string {
  if (!hark) return OPEN_ON_IPHONE;
  if (hark.sent) return SENT_THROUGH_HARK;
  return `${OPEN_ON_IPHONE} Hark delivery failed: ${hark.error}`;
}

const SPEC_GUIDE = `The spec is a Pocketful PassSpec (mirrors server/src/types.ts):
- Required: style ("generic" | "storeCard" | "coupon" | "eventTicket" | "boardingPass" | "posterGeneric"), description (≤200 chars), images (auto-filled with a default icon when omitted).
- posterGeneric (iOS 27+ poster layout, ideal for membership/loyalty cards): REQUIRES background artwork (full-bleed, Wallet crops to the pass face — keep the subject centered); primaryLogo recommended. The face renders headerFields, primaryFields, ONE footer field (fields.footer, max 1), and the barcode. iOS 26 and earlier cannot install a pass whose only style is posterGeneric — add an additionalStyles entry (generic or storeCard) so older systems get a layout they understand.
- updatable: true — the server keeps the pass and can push OTA updates to Wallet later; the response then includes its serialNumber.
- colors: { backgroundColor, foregroundColor, labelColor, stripColor?, footerBackgroundColor? } as #RRGGBB.
- fields: { header?, primary?, secondary?, auxiliary?, back?, additionalInfo?, footer? } arrays of { key, label?, value, changeMessage? ("...%@..." shows a Wallet notification on update), dateStyle?, currencyCode?, numberStyle?, textAlignment? }. additionalInfo is eventTicket-only (iOS 18+ event layout, up to 20); footer is posterGeneric-only (one field).
- additionalStyles (iOS 27+): extra style dictionaries emitted next to style, e.g. [{ style: "storeCard", fields: { primary: [...] } }, { style: "boardingPass", transitType: "PKTransitTypeAir" }]. Wallet renders the newest style it understands, so this is how a posterGeneric pass stays installable on older iOS. Each entry takes its own fields (same categories and rules as the top-level fields, judged against the entry's style; keys need only be unique within one style) and, for boardingPass, an optional transitType. Every style must differ from the top-level style and from the other entries. eventTicketOptions / boardingPassOptions / posterGenericOptions apply when their style appears anywhere.
- featuredActions (iOS 27+, all styles except posterEventTicket/semanticBoardingPass): up to two of { identifier, type: "viewSchedule"|"watchTrailer"|"listenToMusic"|"call"|"place"|"addToBalance"|"order"|"shop"|"membershipBenefits"|"bookAppointment"|"bookCar"|"bookFlight"|"bookStay"|"viewOffersRewards", url }.
- posterGenericOptions: { suppressHeaderDarkening? } (posterGeneric only).
- barcodes: [{ format: "PKBarcodeFormatQR" | "PKBarcodeFormatPDF417" | "PKBarcodeFormatAztec" | "PKBarcodeFormatCode128" | "PKBarcodeFormatEAN13" | "PKBarcodeFormatCode39" | "PKBarcodeFormatCodabar" | "PKBarcodeFormatI2of5", message, altText? }]. The last four are iOS 27+; list a legacy-format fallback after them or older systems render no barcode. EAN13 messages must be 12 digits, or 13 with a valid check digit.
- images maps artwork slot names to ONE base64-encoded source image each, in any common format (PNG, JPEG, WebP). The server center-crops the image to the slot's aspect ratio and produces the 1x/2x/3x PNGs itself, so never send @2x/@3x keys — they are rejected. Slot point sizes at 1x (send a source at least 3× these pixels; the crop keeps the center): ${slotGuide()}. Localized variants use an "xx.lproj/" prefix, e.g. "de.lproj/logo". Omit images entirely to get the bundled default icon; any other artwork must be inlined as base64 — this server has no access to the caller's files.
- Also supported: organizationName, logoText, serialNumber, expirationDate/relevantDates (ISO-8601), locations, beacons, nfc, localizations, personalization, preferredStyleSchemes (posterEventTicket needs eventTicket style + artwork + eventName/venue semantics + a barcode or NFC — Wallet silently falls back to the legacy layout without an entry credential), transitType (boardingPass), upcomingPassInformation.
- Semantic tags go in options.semantics (NOT the spec root, where they are ignored), e.g. options: { semantics: { eventName, venueName, ... } }. Other options keys: voided, userInfo, groupingIdentifier, suppressStripShine, appLaunchURL, sharingProhibited.
The server validates strictly and returns specific error messages — fix and retry on 400s.`;

const specSchema = z
  .record(z.string(), z.unknown())
  .describe("The PassSpec object (see tool description)");

const serialSchema = z.string().describe("The pass's serial number");

export function createMcpServer(service: PassService, origin: string): McpServer {
  const server = new McpServer({ name: "pocketful", version: "1.0.0" });

  server.registerTool(
    "create_pass",
    {
      title: "Create an Apple Wallet pass",
      description: `Build, sign, and host an Apple Wallet pass from a JSON spec. Returns a short-lived download URL (open it on the iPhone to get the native add-to-Wallet sheet) and, for updatable passes, the serialNumber used for future updates. When the server is configured for Hark, the link is also pushed to the iPhone as a notification and the response carries a "hark" delivery result.\n\n${SPEC_GUIDE}`,
      inputSchema: { spec: specSchema },
    },
    async ({ spec }) => {
      try {
        const body = { ...(spec as Spec) };
        const usedDefaultIcon = ensureIcon(body);
        const result = await service.create(body, origin);
        return ok(
          result,
          (usedDefaultIcon
            ? "Note: no icon was provided, so the bundled Pocketful icon was used.\n"
            : "") + deliveryNote(result.hark)
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
        serial_number: serialSchema,
        spec: z
          .record(z.string(), z.unknown())
          .describe("The full replacement PassSpec"),
      },
    },
    async ({ serial_number, spec }) => {
      try {
        const body = { ...(spec as Spec) };
        if (Object.keys(specImages(body)).length === 0) {
          const stored = service.getSpec(serial_number).spec as Spec;
          body.images = stored.images;
        }
        return ok(await service.update(serial_number, body));
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
        "Fetch the current spec of an updatable pass for read-modify-write updates. Source image contents are replaced with size placeholders; update_pass reuses the stored images automatically when you omit images.",
      inputSchema: { serial_number: serialSchema },
    },
    async ({ serial_number }) => {
      try {
        const result = service.getSpec(serial_number);
        return ok({ ...result, spec: withImageSummaries(result.spec as Spec) });
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
        return ok(service.list());
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
        "Create a new short-lived download URL for an existing updatable pass, e.g. to add it to another iPhone. When the server is configured for Hark, the link is also pushed to the iPhone as a notification.",
      inputSchema: { serial_number: serialSchema },
    },
    async ({ serial_number }) => {
      try {
        const result = await service.mintDownload(serial_number, origin);
        return ok(result, deliveryNote(result.hark));
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
      inputSchema: { serial_number: serialSchema },
      annotations: { destructiveHint: true },
    },
    async ({ serial_number }) => {
      try {
        return ok(service.remove(serial_number));
      } catch (err) {
        return fail(err);
      }
    }
  );

  return server;
}

/** Serve one authenticated, body-parsed MCP POST. */
export async function handleMcpRequest(
  service: PassService,
  origin: string,
  req: express.Request,
  res: express.Response
): Promise<void> {
  const server = createMcpServer(service, origin);
  const transport = new StreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  await server.connect(transport);
  await transport.handleRequest(req, res, req.body);
}
