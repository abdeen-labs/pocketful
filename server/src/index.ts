import express from "express";
import { loadConfig } from "./config";
import { buildPass, passFilename } from "./passBuilder";
import { getPass, putPass } from "./store";
import { ApiError, validateSpec } from "./validate";

const config = loadConfig();

const app = express();
// Railway terminates TLS at its proxy; trust it so req.protocol is https.
app.set("trust proxy", true);
app.use(express.json({ limit: "25mb" }));

app.get("/healthz", (_req, res) => {
  res.json({ ok: true });
});

app.post("/api/passes", (req, res) => {
  if (config.apiToken) {
    const auth = req.get("authorization");
    if (auth !== `Bearer ${config.apiToken}`) {
      throw new ApiError(401, "Missing or invalid API token");
    }
  }

  const validated = validateSpec(req.body);

  let buffer: Buffer;
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

  const filename = passFilename(validated.spec.description);
  const { id, expiresAt } = putPass(buffer, filename, config.passTtlSeconds);

  res.status(201).json({
    id,
    url: `${req.protocol}://${req.get("host")}/api/passes/${id}`,
    expiresAt: new Date(expiresAt).toISOString(),
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

app.listen(config.port, () => {
  console.log(`pocketful server listening on :${config.port}`);
});
