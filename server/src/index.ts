import path from "node:path";
import express from "express";
import rateLimit from "express-rate-limit";
import { loadConfig, type Config } from "./config";
import { initDb } from "./db";
import { handleMcpRequest } from "./mcp";
import { createPassService } from "./passService";
import { getPass } from "./store";
import { secretsMatch } from "./updatable";
import { ApiError, MAX_TOTAL_IMAGE_BYTES } from "./validate";
import { walletWebServiceRouter } from "./webService";

/** The full app minus startup: importable by tests without a listener or env. */
export function createApp(config: Config): express.Express {
  const app = express();
  app.disable("x-powered-by");
  const passes = createPassService(config);
  const docsPath = path.join(__dirname, "../public/index.html");
  // Railway terminates TLS at its proxy; trust it so req.protocol is https.
  // NOTE: `trust proxy: true` means req.ip comes from X-Forwarded-For, which a
  // client can spoof. Tightening that to a hop count is plan 007.
  app.set("trust proxy", true);

  function requireApiToken(req: express.Request): void {
    const match = /^Bearer\s+(.+)$/i.exec(req.get("authorization") ?? "");
    if (!match || !secretsMatch(match[1], config.apiToken)) {
      throw new ApiError(401, "Missing or invalid API token");
    }
  }

  /** Scheme and host the caller used; download links are built from it. */
  function requestOrigin(req: express.Request): string {
    return `${req.protocol}://${req.get("host")}`;
  }

  // Not on /healthz — the Docker HEALTHCHECK polls it every 30 seconds and
  // Railway may poll it too.
  const limiter = rateLimit({
    windowMs: 60_000,
    limit: 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
  });
  app.use("/v1", limiter);
  app.use("/api", limiter);
  app.use("/mcp", limiter);

  // Authenticate before any body is buffered: /api/passes and /mcp accept
  // megabytes.
  app.use("/api", (req, _res, next) => {
    // The signed-pass download link is authenticated by its unguessable id —
    // exactly one path segment after /passes. The bare list route and the
    // two-segment /spec route must stay behind the token.
    if (req.method === "GET" && /^\/passes\/[^/]+$/.test(req.path)) {
      return next();
    }
    requireApiToken(req);
    next();
  });
  app.use("/mcp", (req, _res, next) => {
    requireApiToken(req);
    next();
  });

  // Only the pass-authoring routes and the MCP endpoint carry base64 artwork;
  // everything else (device registration, log callbacks, health) sends a few
  // hundred bytes.
  const smallJson = express.json({ limit: "100kb" });
  // 24 MB of decoded PNG data expands to roughly 32 MB when base64 encoded;
  // deriving the limit from the validator's cap means the two cannot drift.
  const passJson = express.json({
    limit: Math.ceil((MAX_TOTAL_IMAGE_BYTES * 4) / 3) + 1024 * 1024,
  });
  app.use((req, res, next) => {
    if (
      req.method === "POST" &&
      (req.path === "/api/passes" || req.path === "/mcp")
    ) {
      return next();
    }
    if (req.method === "PUT" && req.path.startsWith("/api/passes/")) {
      return next();
    }
    return smallJson(req, res, next);
  });

  app.get("/healthz", (_req, res) => {
    res.json({ ok: true });
  });

  app.get(["/", "/docs", "/docs/"], (_req, res) => {
    res
      .set({
        "Cache-Control": "public, max-age=300",
        "Content-Security-Policy":
          "default-src 'none'; style-src 'unsafe-inline'; img-src data:; " +
          "base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "X-Content-Type-Options": "nosniff",
      })
      .sendFile(docsPath);
  });

  app.post("/api/passes", passJson, (req, res) => {
    requireApiToken(req);
    res.status(201).json(passes.create(req.body, requestOrigin(req)));
  });

  /** Registered (updatable) passes. The :id download route below serves ephemeral ids. */
  app.get("/api/passes", (req, res) => {
    requireApiToken(req);
    res.json(passes.list());
  });

  app.put("/api/passes/:serialNumber", passJson, async (req, res, next) => {
    try {
      requireApiToken(req);
      res.json(await passes.update(req.params.serialNumber, req.body));
    } catch (err) {
      next(err);
    }
  });

  app.delete("/api/passes/:serialNumber", (req, res) => {
    requireApiToken(req);
    res.json(passes.remove(req.params.serialNumber));
  });

  /** The stored spec for an updatable pass, for read-modify-write updates. */
  app.get("/api/passes/:serialNumber/spec", (req, res) => {
    requireApiToken(req);
    res.json(passes.getSpec(req.params.serialNumber));
  });

  /** Mint a fresh short-lived download link for a stored updatable pass. */
  app.post("/api/passes/:serialNumber/download", (req, res) => {
    requireApiToken(req);
    res
      .status(201)
      .json(passes.mintDownload(req.params.serialNumber, requestOrigin(req)));
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

  // MCP over Streamable HTTP, stateless: the same operations as the routes
  // above, behind the same token. GET (server-initiated stream) and DELETE
  // (session teardown) have no meaning without sessions.
  app.post("/mcp", passJson, (req, res, next) => {
    handleMcpRequest(passes, requestOrigin(req), req, res).catch((err) => {
      if (res.headersSent) {
        res.end();
        return;
      }
      next(err);
    });
  });
  const methodNotAllowed = (_req: express.Request, res: express.Response) => {
    res.status(405).json({
      jsonrpc: "2.0",
      error: { code: -32000, message: "Method not allowed." },
      id: null,
    });
  };
  app.get("/mcp", methodNotAllowed);
  app.delete("/mcp", methodNotAllowed);

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
      // body-parser signals rejections (413 too large, 415 bad type) as
      // http-errors with a 4xx statusCode; pass those through instead of
      // collapsing them into a 500.
      if (
        err instanceof Error &&
        "statusCode" in err &&
        typeof err.statusCode === "number" &&
        err.statusCode >= 400 &&
        err.statusCode < 500
      ) {
        res.status(err.statusCode).json({ error: err.message });
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
