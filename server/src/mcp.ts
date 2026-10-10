import { readFileSync } from "node:fs";
import path from "node:path";
import type express from "express";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import type { HarkDelivery } from "./hark";
import { stashUpload, UPLOAD_TTL_MS } from "./imageSources";
import type { PassService } from "./passService";
import { slotGuide } from "./slots";
import { ApiError, MAX_IMAGE_MEGABYTES } from "./validate";

// Agent-facing tools over the same pass operations as the REST API. The
// endpoint is stateless: every POST gets its own McpServer and transport,
// which are torn down when the response closes. Auth and body parsing happen
// in the Express layer before this module sees the request.

type Spec = Record<string, unknown>;

const DEFAULT_ICON = path.join(__dirname, "../assets/icon.svg");

/** Wallet rejects passes without an icon; fall back to the bundled one. */
async function ensureIcon(spec: Spec): Promise<boolean> {
  const images =
    typeof spec.images === "object" && spec.images !== null && !Array.isArray(spec.images)
      ? (spec.images as Record<string, unknown>)
      : {};
  if (images.icon) return false;
  spec.images = { ...images, icon: await stashUpload(readFileSync(DEFAULT_ICON)) };
  return true;
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

const UPLOAD_MINUTES = UPLOAD_TTL_MS / 60_000;

// Sent once per session as the server's instructions; clients that surface
// them put this in the agent's system prompt.
const INSTRUCTIONS = `Pocketful builds and signs Apple Wallet passes that land on the owner's iPhone. A pass is only as good as the facts and artwork behind it, so do the legwork before create_pass — the owner would rather wait for a researched pass than get a quick generic one.

1. Read the source exactly. Copy names, dates, times, seats, prices and confirmation numbers from what the owner gave you. Decode barcodes and QR codes from screenshots with a real decoder (e.g. OpenCV's QRCodeDetector or zbar) and put the decoded payload in barcodes — never retype, guess, or invent one.
2. Research what the source leaves out, from official sources: the venue's exact name, street address, coordinates (geocode it) and local time zone — write every date with that zone's offset — plus the event's official title and the organizer. Use these for semantics, locations and relevantDates.
3. Fetch official artwork instead of drawing your own: studio or distributor key art (TMDB serves originals at https://image.tmdb.org/t/p/original/<file>), brand logos (Wikimedia Commons, press kits), venue or team marks. Take the largest original available: the server refuses any source smaller than the slot's @3x render (sizes in the create_pass guide) because it never upscales.
4. Compose for the layout instead of accepting a center crop. Crop so the subject and any title land in the visible area (the poster ticket's safe areas are in the create_pass guide), recolor logos for contrast against the art (usually solid white on a transparent background), and take colors from the artwork.
5. Send images by reference, never as inline data: an https:// URL the server downloads, or a file from your machine uploaded through prepare_image_upload.
6. Make passes updatable and iterate with update_pass, which changes the copy already in Wallet — every create_pass sends the owner another add-to-Wallet link. When you can, download the signed pass from the returned URL and check what you built.`;

const SPEC_GUIDE = `Before calling, do the research the server instructions describe: exact details from the owner's source, official venue/event facts, and official full-resolution artwork composed for the layout.

The spec is a Pocketful PassSpec (mirrors server/src/types.ts):
- Required: style ("generic" | "storeCard" | "coupon" | "eventTicket" | "boardingPass" | "posterGeneric"), description (≤200 chars), images (auto-filled with a default icon when omitted).
- posterGeneric (iOS 27+ poster layout, ideal for membership/loyalty cards): REQUIRES background artwork (full-bleed, Wallet crops to the pass face — keep the subject centered); primaryLogo recommended. The face renders headerFields, primaryFields, ONE footer field (fields.footer, max 1), and the barcode. iOS 26 and earlier cannot install a pass whose only style is posterGeneric — add an additionalStyles entry (generic or storeCard) so older systems get a layout they understand.
- updatable: true — the server keeps the pass and can push OTA updates to Wallet later; the response then includes its serialNumber.
- colors: { backgroundColor, foregroundColor, labelColor, stripColor?, footerBackgroundColor? } as #RRGGBB.
- fields: { header?, primary?, secondary?, auxiliary?, back?, additionalInfo?, footer? } arrays of { key, label?, value, changeMessage? ("...%@..." shows a Wallet notification on update), dateStyle?, currencyCode?, numberStyle?, textAlignment? }. additionalInfo is eventTicket-only (iOS 18+ event layout, up to 20); footer is posterGeneric-only (one field).
- additionalStyles (iOS 27+): extra style dictionaries emitted next to style, e.g. [{ style: "storeCard", fields: { primary: [...] } }, { style: "boardingPass", transitType: "PKTransitTypeAir" }]. Wallet renders the newest style it understands, so this is how a posterGeneric pass stays installable on older iOS. Each entry takes its own fields (same categories and rules as the top-level fields, judged against the entry's style; keys need only be unique within one style) and, for boardingPass, an optional transitType. Every style must differ from the top-level style and from the other entries. eventTicketOptions / boardingPassOptions / posterGenericOptions apply when their style appears anywhere.
- featuredActions (iOS 27+, all styles except posterEventTicket/semanticBoardingPass): up to two of { identifier, type: "viewSchedule"|"watchTrailer"|"listenToMusic"|"call"|"place"|"addToBalance"|"order"|"shop"|"membershipBenefits"|"bookAppointment"|"bookCar"|"bookFlight"|"bookStay"|"viewOffersRewards", url }. A "place" action takes placeIdentifier (an Apple Maps place ID) INSTEAD of url; every other type requires url and rejects placeIdentifier. "call" urls use the tel: scheme.
- posterGenericOptions: { suppressHeaderDarkening? } (posterGeneric only).
- barcodes: [{ format: "PKBarcodeFormatQR" | "PKBarcodeFormatPDF417" | "PKBarcodeFormatAztec" | "PKBarcodeFormatCode128" | "PKBarcodeFormatEAN13" | "PKBarcodeFormatCode39" | "PKBarcodeFormatCodabar" | "PKBarcodeFormatI2of5", message, altText? }]. The last four are iOS 27+; list a legacy-format fallback after them or older systems render no barcode. EAN13 messages must be 12 digits, or 13 with a valid check digit.
- images maps artwork slot names to ONE source image ref each: an https:// URL the server downloads, or an upload:<id> ref from prepare_image_upload for a file on your machine. Inline image data (base64) is rejected. Sources are PNG, JPEG or WebP up to ${MAX_IMAGE_MEGABYTES} MB. The server center-crops each source to the slot's aspect ratio and renders the 1x/2x/3x PNGs itself, so never send @2x/@3x keys — they are rejected. Slot point sizes at 1x: ${slotGuide()}. Every source must still be at least 3× those points after the center crop — the server never upscales and rejects anything smaller. To frame a slot differently than a center crop, crop the source to the slot's aspect yourself and upload it. Localized variants use an "xx.lproj/" prefix, e.g. "de.lproj/logo". Omit icon to get the bundled default icon.
- Also supported: organizationName, logoText, serialNumber, expirationDate/relevantDates (ISO-8601), locations, beacons, nfc, localizations, personalization, preferredStyleSchemes, transitType (boardingPass), upcomingPassInformation.
- posterEventTicket (iOS 26+; preferredStyleSchemes ["posterEventTicket", "eventTicket"]) needs the eventTicket style, artwork, semantics eventName/venueName/venueRegionName/venueRoom, and a barcode or NFC — Wallet silently falls back to the legacy layout without an entry credential. Keep the legacy fields too; older systems render them. How Wallet draws it (measured on iOS 27): the artwork is aspect-filled to the card's full height with about 4% trimmed off each side. The top ~10% carries primaryLogo (top-left, replaces logoText — use a white logo) and the event date and time (top-right). The barcode sits on a white card covering 44–77% of the height and the middle 31–69% of the width. A footer strip in colors.footerBackgroundColor covers the bottom 25% (without it Wallet tints the strip from the art, often muddy). Keep the focal point and any title between ~10% and ~44% of the height. The strip shows semantics.seats[0].seatType (or eventName when there is none) on the left, the seat grid on the right (seatSection labeled "Sec", seatRow "Row", seatNumber "Seat"), venueName below, and secondaryLogo bottom-right. labelColor tints the time, the strip's left text and the seat labels. Put a room or auditorium in seatType so it shows on the face, e.g. "Auditorium 9".
- Semantic tags go in options.semantics (NOT the spec root, where they are ignored), e.g. options: { semantics: { eventName, venueName, ... } }. Other options keys: voided, userInfo, groupingIdentifier, suppressStripShine, appLaunchURL, sharingProhibited.
The server validates strictly and returns specific error messages — fix and retry on 400s.`;

const specSchema = z
  .record(z.string(), z.unknown())
  .describe("The PassSpec object (see tool description)");

const serialSchema = z.string().describe("The pass's serial number");

export function createMcpServer(service: PassService, origin: string): McpServer {
  const server = new McpServer(
    { name: "pocketful", version: "1.0.0" },
    { instructions: INSTRUCTIONS }
  );

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
        const usedDefaultIcon = await ensureIcon(body);
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
        "Replace the spec of an updatable pass and push the change to every Wallet that holds it (OTA). Send the FULL new spec — call get_pass_spec first and modify it. Artwork stays on the server per slot: omit images to keep all of it, put only the slots you are replacing in images (same refs as create_pass), and set a slot to null to remove it. Fields whose changeMessage contains %@ produce a notification on the device.",
      inputSchema: {
        serial_number: serialSchema,
        spec: z
          .record(z.string(), z.unknown())
          .describe("The full replacement PassSpec"),
      },
    },
    async ({ serial_number, spec }) => {
      try {
        return ok(await service.update(serial_number, spec));
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
        "Fetch the current spec of an updatable pass for read-modify-write updates. The spec comes back without images; the artwork the server holds is listed separately with its pixel size per slot, and update_pass keeps it unless you replace a slot.",
      inputSchema: { serial_number: serialSchema },
    },
    async ({ serial_number }) => {
      try {
        return ok(await service.getSpec(serial_number));
      } catch (err) {
        return fail(err);
      }
    }
  );

  server.registerTool(
    "prepare_image_upload",
    {
      title: "Get a one-time image upload URL",
      description: `Get a one-time URL for uploading an image file from your machine — your own crop or composition, a recolored logo, an original you downloaded and edited. PUT the raw file to uploadUrl, e.g. \`curl -sSf -T artwork.png '<uploadUrl>'\`, then use the returned ref (upload:<id>) as the slot's value in images. Each URL takes one PNG, JPEG or WebP up to ${MAX_IMAGE_MEGABYTES} MB and expires after ${UPLOAD_MINUTES} minutes; the ref works until then, so a rejected spec can be retried with it. Call once per image. For an official image already on the web, skip this and put its https URL in images directly.`,
    },
    async () => {
      try {
        return ok(service.prepareUpload(origin));
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
