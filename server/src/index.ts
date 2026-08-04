import { randomBytes, randomUUID } from "node:crypto";
import express from "express";
import { pushPassUpdate, type PushResult } from "./apns";
import { loadConfig, type Config } from "./config";
import {
  deletePassRecord,
  getPassRecord,
  initDb,
  insertPass,
  listPassSummaries,
  updatePassSpec,
} from "./db";
import { buildPass, passFilename } from "./passBuilder";
import { getPass, putPass } from "./store";
import { rebuildStoredPass } from "./updatable";
import { ApiError, validateSpec } from "./validate";
import { walletWebServiceRouter } from "./webService";

/** The full app minus startup: importable by tests without a listener or env. */
export function createApp(config: Config): express.Express {
  const app = express();
  // Railway terminates TLS at its proxy; trust it so req.protocol is https.
  app.set("trust proxy", true);
  // 24 MB of decoded PNG data expands to roughly 32 MB when base64 encoded.
  app.use(express.json({ limit: "40mb" }));

  function requireApiToken(req: express.Request): void {
    const auth = req.get("authorization");
    if (auth !== `Bearer ${config.apiToken}`) {
      throw new ApiError(401, "Missing or invalid API token");
    }
  }

  function requestOrigin(req: express.Request): string {
    return config.publicBaseUrl ?? `${req.protocol}://${req.get("host")}`;
  }

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/passes", (req, res) => {
    requireApiToken(req);
    const validated = validateSpec(req.body);
    const { spec } = validated;

    let buffer: Buffer;
    let serialNumber: string | undefined;

    if (spec.updatable) {
      serialNumber = spec.serialNumber || randomUUID();
      if (getPassRecord(serialNumber)) {
        throw new ApiError(
          409,
          `An updatable pass with serial "${serialNumber}" already exists — ` +
            `use PUT /api/passes/${serialNumber} to update it`
        );
      }
      const identity = {
        serialNumber,
        webServiceURL: requestOrigin(req),
        authenticationToken: randomBytes(16).toString("hex"),
      };
      try {
        buffer = buildPass(validated, config, identity);
      } catch (err) {
        throw new ApiError(
          422,
          `Failed to build pass: ${err instanceof Error ? err.message : String(err)}`
        );
      }
      insertPass({
        serialNumber,
        authToken: identity.authenticationToken,
        webServiceURL: identity.webServiceURL,
        specJson: JSON.stringify(req.body),
        description: spec.description,
      });
    } else {
      try {
        buffer = buildPass(validated, config);
      } catch (err) {
        // Signing/serialization failures are almost always a spec or cert problem;
        // surface the library's message so the app can show it.
        throw new ApiError(
          422,
          `Failed to build pass: ${err instanceof Error ? err.message : String(err)}`
        );
      }
    }

    const filename = passFilename(spec.description);
    const { id, expiresAt } = putPass(buffer, filename, config.passTtlSeconds);

    res.status(201).json({
      id,
      url: `${req.protocol}://${req.get("host")}/api/passes/${id}`,
      expiresAt: new Date(expiresAt).toISOString(),
      ...(serialNumber ? { serialNumber, updatable: true } : {}),
    });
  });

  /** Registered (updatable) passes. The :id download route below serves ephemeral ids. */
  app.get("/api/passes", (req, res) => {
    requireApiToken(req);
    res.json({ passes: listPassSummaries() });
  });

  app.put("/api/passes/:serialNumber", async (req, res, next) => {
    try {
      requireApiToken(req);
      const record = getPassRecord(req.params.serialNumber);
      if (!record) {
        throw new ApiError(404, "No updatable pass with that serial number");
      }
      const validated = validateSpec(req.body);
      if (
        validated.spec.serialNumber &&
        validated.spec.serialNumber !== record.serialNumber
      ) {
        throw new ApiError(400, "serialNumber cannot change on update");
      }

      const webServiceURL = config.publicBaseUrl ?? record.webServiceURL;
      try {
        buildPass(validated, config, {
          serialNumber: record.serialNumber,
          webServiceURL,
          authenticationToken: record.authToken,
        });
      } catch (err) {
        throw new ApiError(
          422,
          `Failed to build pass: ${err instanceof Error ? err.message : String(err)}`
        );
      }

      const result = updatePassSpec(
        record.serialNumber,
        JSON.stringify(req.body),
        validated.spec.description,
        webServiceURL
      );
      if (!result) {
        throw new ApiError(404, "No updatable pass with that serial number");
      }
      let push: PushResult;
      try {
        push = await pushPassUpdate(config, record.serialNumber);
      } catch (err) {
        // The spec is already committed; a push failure must not read as a
        // failed update. Surface it in the response instead.
        console.error(
          `APNs push failed for ${record.serialNumber}:`,
          err instanceof Error ? err.message : err
        );
        push = {
          sent: 0,
          failed: 0,
          pruned: 0,
          error:
            "Push failed — the pass was updated but devices were not notified",
        };
      }
      res.json({
        serialNumber: record.serialNumber,
        updatedAt: new Date(result.updatedAt).toISOString(),
        revision: result.revision,
        push,
      });
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/passes/:serialNumber", (req, res) => {
    requireApiToken(req);
    if (!deletePassRecord(req.params.serialNumber)) {
      throw new ApiError(404, "No updatable pass with that serial number");
    }
    res.json({ ok: true });
  });

  /** The stored spec for an updatable pass, for read-modify-write updates. */
  app.get("/api/passes/:serialNumber/spec", (req, res) => {
    requireApiToken(req);
    const record = getPassRecord(req.params.serialNumber);
    if (!record) {
      throw new ApiError(404, "No updatable pass with that serial number");
    }
    res.json({
      serialNumber: record.serialNumber,
      updatedAt: new Date(record.updatedAt).toISOString(),
      spec: JSON.parse(record.specJson),
    });
  });

  /** Mint a fresh short-lived download link for a stored updatable pass. */
  app.post("/api/passes/:serialNumber/download", (req, res) => {
    requireApiToken(req);
    const record = getPassRecord(req.params.serialNumber);
    if (!record) {
      throw new ApiError(404, "No updatable pass with that serial number");
    }
    let buffer: Buffer;
    try {
      buffer = rebuildStoredPass(record, config);
    } catch (err) {
      throw new ApiError(
        422,
        `Failed to build pass: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const filename = passFilename(record.description);
    const { id, expiresAt } = putPass(buffer, filename, config.passTtlSeconds);
    res.status(201).json({
      id,
      url: `${req.protocol}://${req.get("host")}/api/passes/${id}`,
      expiresAt: new Date(expiresAt).toISOString(),
      serialNumber: record.serialNumber,
    });
  });

  app.get("/api/passes/:id", (req, res) => {
    const entry = getPass(req.params.id);
    if (!entry) {
      throw new ApiError(
        404,
        "Pass not found or expired — create it again from the app"
      );
    }
    res
      .set({
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="${entry.filename}"`,
        "Cache-Control": "no-store",
      })
      .send(entry.buffer);
  });

  app.use(walletWebServiceRouter(config));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use(
    (
      err: unknown,
      _req: express.Request,
      res: express.Response,
      _next: express.NextFunction
    ) => {
      if (err instanceof ApiError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      if (err instanceof SyntaxError && "body" in err) {
        res.status(400).json({ error: "Request body is not valid JSON" });
        return;
      }
      console.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  );

  return app;
}

if (require.main === module) {
  const config = loadConfig();
  initDb(config.dataDir);
  if (!config.apns) {
    console.warn(
      "APNs is not configured (APNS_KEY_ID/APNS_KEY_BASE64) — updatable passes " +
        "will update only when iOS refreshes them on its own."
    );
  }
  const app = createApp(config);
  app.listen(config.port, () => {
    console.log(`pocketful server listening on :${config.port}`);
  });
}
