import { Router, type Request } from "express";
import type { Config } from "./config";
import {
  getPassRecord,
  listUpdatedSerials,
  registerDevice,
  unregisterDevice,
  type PassRecord,
} from "./db";
import { rebuildStoredPass, secretsMatch } from "./updatable";
import { ApiError } from "./validate";

// Apple Wallet web service protocol. Called by iOS itself, not by the app:
// https://developer.apple.com/documentation/walletpasses/adding-a-web-service-to-update-passes
// Every response shape and status code here is dictated by that spec.

function authenticatedPass(req: Request, config: Config): PassRecord {
  const { passTypeIdentifier, serialNumber } = req.params;
  if (passTypeIdentifier !== config.passTypeIdentifier) {
    throw new ApiError(401, "Unknown pass type identifier");
  }
  const match = /^ApplePass\s+(.+)$/i.exec(req.get("authorization") ?? "");
  if (!match) throw new ApiError(401, "Missing ApplePass authorization");
  const record = getPassRecord(serialNumber);
  if (!record || !secretsMatch(match[1], record.authToken)) {
    throw new ApiError(401, "Invalid authentication token");
  }
  return record;
}

export function walletWebServiceRouter(config: Config): Router {
  const router = Router();

  router.post(
    "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber",
    (req, res) => {
      const record = authenticatedPass(req, config);
      const pushToken =
        typeof req.body === "object" && req.body !== null
          ? (req.body as { pushToken?: unknown }).pushToken
          : undefined;
      if (typeof pushToken !== "string" || !pushToken) {
        throw new ApiError(400, "pushToken is required");
      }
      const created = registerDevice(
        req.params.deviceLibraryIdentifier,
        record.serialNumber,
        pushToken
      );
      res.status(created ? 201 : 200).send();
    }
  );

  router.delete(
    "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber",
    (req, res) => {
      const record = authenticatedPass(req, config);
      unregisterDevice(req.params.deviceLibraryIdentifier, record.serialNumber);
      res.status(200).send();
    }
  );

  // No ApplePass header here — the device library identifier is the secret.
  router.get(
    "/v1/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier",
    (req, res) => {
      if (req.params.passTypeIdentifier !== config.passTypeIdentifier) {
        throw new ApiError(401, "Unknown pass type identifier");
      }
      const sinceRaw = req.query.passesUpdatedSince;
      const since =
        typeof sinceRaw === "string" && /^\d+$/.test(sinceRaw)
          ? Number(sinceRaw)
          : undefined;
      const updated = listUpdatedSerials(
        req.params.deviceLibraryIdentifier,
        since
      );
      if (!updated) {
        res.status(204).send();
        return;
      }
      res.json({
        serialNumbers: updated.serialNumbers,
        lastUpdated: String(updated.lastUpdated),
      });
    }
  );

  router.get("/v1/passes/:passTypeIdentifier/:serialNumber", (req, res) => {
    const record = authenticatedPass(req, config);
    // Freshness is keyed on a monotonic revision, not on Last-Modified:
    // HTTP dates carry only second precision, so two updates inside one second
    // would otherwise be indistinguishable and the second would never ship.
    const etag = `"${record.serialNumber}-${record.revision}"`;
    if (req.get("if-none-match") === etag) {
      res.status(304).set({ ETag: etag }).send();
      return;
    }
    // If-Modified-Since is deliberately ignored: every served pass carries an
    // ETag, and HTTP dates only have second precision — a timestamp comparison
    // here is how same-second updates used to get lost as false 304s.
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
    res
      .set({
        "Content-Type": "application/vnd.apple.pkpass",
        ETag: etag,
        "Last-Modified": new Date(record.updatedAt).toUTCString(),
        "Cache-Control": "no-store",
      })
      .send(buffer);
  });

  // Apple's device log callback. Unauthenticated by protocol design, so treat
  // every line as hostile: bounded count, bounded length, control characters
  // stripped so a caller cannot forge log lines.
  const MAX_LOG_LINES = 50;
  const MAX_LOG_LINE_CHARS = 500;

  router.post("/v1/log", (req, res) => {
    const logs =
      typeof req.body === "object" && req.body !== null
        ? (req.body as { logs?: unknown }).logs
        : undefined;
    if (Array.isArray(logs)) {
      const lines = logs
        .slice(0, MAX_LOG_LINES)
        .map((line) =>
          String(line)
            // eslint-disable-next-line no-control-regex
            .replace(/[\u0000-\u001f\u007f]/g, " ")
            .slice(0, MAX_LOG_LINE_CHARS)
        );
      if (lines.length) {
        // One JSON record, not one console.log per line — a caller cannot
        // inject a newline to forge a separate log entry.
        console.log(JSON.stringify({ source: "wallet-device", lines }));
      }
    }
    res.status(200).send();
  });

  return router;
}
