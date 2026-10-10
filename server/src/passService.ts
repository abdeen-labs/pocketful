import { randomBytes, randomUUID } from "node:crypto";
import { pushPassUpdate, type PushResult } from "./apns";
import type { Config } from "./config";
import {
  deletePassRecord,
  getPassImages,
  getPassRecord,
  insertPass,
  listPassSummaries,
  updatePassSpec,
  type PassSummary,
} from "./db";
import { deliverPass, type HarkDelivery } from "./hark";
import { reserveUpload, resolveImages } from "./imageSources";
import { probeImage } from "./images";
import { buildPass, passFilename } from "./passBuilder";
import { deletePassesForSerial, putPass } from "./store";
import { rebuildStoredPass } from "./updatable";
import { ApiError, MAX_IMAGE_BYTES, validateSpec } from "./validate";

export interface DownloadLink {
  id: string;
  url: string;
  expiresAt: string;
  /** Present only when HARK_URL/HARK_TOKEN are configured. */
  hark?: HarkDelivery;
}

export interface CreatedPass extends DownloadLink {
  serialNumber?: string;
  updatable?: true;
}

export interface MintedDownload extends DownloadLink {
  serialNumber: string;
}

export interface UpdatedPass {
  serialNumber: string;
  updatedAt: string;
  revision: number;
  push: PushResult;
}

export interface StoredImage {
  width: number;
  height: number;
  bytes: number;
}

export interface StoredSpec {
  serialNumber: string;
  updatedAt: string;
  /** The last spec sent, without images. */
  spec: unknown;
  /** The artwork the server holds for the pass, per slot path. */
  images: Record<string, StoredImage>;
}

export interface PreparedUpload {
  /** Use as a slot value in spec.images once the file is uploaded. */
  ref: string;
  /** PUT the raw image file here, once. */
  uploadUrl: string;
  expiresAt: string;
  maxBytes: number;
}

/**
 * Pass operations shared by the REST routes and the MCP tools. `origin` is
 * the scheme and host the caller reached the server on: download links use it
 * so they resolve on whatever domain the client is already talking to, while
 * webServiceURL prefers PUBLIC_BASE_URL because Wallet keeps calling it for
 * the life of the pass.
 */
export interface PassService {
  create(body: unknown, origin: string): Promise<CreatedPass>;
  list(): { passes: PassSummary[] };
  update(serialNumber: string, body: unknown): Promise<UpdatedPass>;
  remove(serialNumber: string): { ok: true };
  getSpec(serialNumber: string): Promise<StoredSpec>;
  mintDownload(serialNumber: string, origin: string): Promise<MintedDownload>;
  prepareUpload(origin: string): PreparedUpload;
}

async function signOrThrow(build: () => Promise<Buffer>): Promise<Buffer> {
  try {
    return await build();
  } catch (err) {
    if (err instanceof ApiError) throw err;
    // Signing/serialization failures are almost always a spec or cert problem;
    // surface the library's message so the caller can show it.
    throw new ApiError(
      422,
      `Failed to build pass: ${err instanceof Error ? err.message : String(err)}`
    );
  }
}

function notFound(): ApiError {
  return new ApiError(404, "No updatable pass with that serial number");
}

function imageRefs(body: unknown): unknown {
  return typeof body === "object" && body !== null && !Array.isArray(body)
    ? (body as Record<string, unknown>).images
    : undefined;
}

/** What gets stored: the spec as sent, minus refs that are only meaningful once. */
function storedSpecJson(body: unknown): string {
  const { images: _refs, ...rest } = body as Record<string, unknown>;
  return JSON.stringify(rest);
}

export function createPassService(config: Config): PassService {
  /** Store the signed pass and, when Hark is configured, send the link to the iPhone. */
  async function storeDownload(
    buffer: Buffer,
    description: string,
    origin: string,
    serialNumber?: string
  ): Promise<DownloadLink> {
    const { id, expiresAt } = putPass(
      buffer,
      passFilename(description),
      config.passTtlSeconds,
      config.passStoreMaxBytes,
      serialNumber
    );
    const link: DownloadLink = {
      id,
      url: `${origin}/api/passes/${id}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
    const hark = await deliverPass(config.hark, description, link.url);
    return hark ? { ...link, hark } : link;
  }

  return {
    async create(body, origin) {
      const { images } = await resolveImages(imageRefs(body));
      const validated = await validateSpec(body, images);
      const { spec } = validated;

      if (!spec.updatable) {
        const buffer = await signOrThrow(() => buildPass(validated, config));
        return storeDownload(buffer, spec.description, origin);
      }

      const serialNumber = spec.serialNumber || randomUUID();
      if (getPassRecord(serialNumber)) {
        throw new ApiError(
          409,
          `An updatable pass with serial "${serialNumber}" already exists — ` +
            "update it instead of creating it again"
        );
      }
      const identity = {
        serialNumber,
        webServiceURL: config.publicBaseUrl ?? origin,
        authenticationToken: randomBytes(16).toString("hex"),
      };
      const buffer = await signOrThrow(() => buildPass(validated, config, identity));
      insertPass(
        {
          serialNumber,
          authToken: identity.authenticationToken,
          webServiceURL: identity.webServiceURL,
          specJson: storedSpecJson(body),
          description: spec.description,
        },
        images
      );
      return {
        ...(await storeDownload(buffer, spec.description, origin, serialNumber)),
        serialNumber,
        updatable: true,
      };
    },

    list() {
      return { passes: listPassSummaries() };
    },

    async update(serialNumber, body) {
      const record = getPassRecord(serialNumber);
      if (!record) throw notFound();
      // Slots the body names replace the stored ones; null removes a slot.
      const incoming = await resolveImages(imageRefs(body), { allowRemoval: true });
      const images = { ...getPassImages(record.serialNumber), ...incoming.images };
      for (const slot of incoming.removed) delete images[slot];
      const validated = await validateSpec(body, images);
      if (
        validated.spec.serialNumber &&
        validated.spec.serialNumber !== record.serialNumber
      ) {
        throw new ApiError(400, "serialNumber cannot change on update");
      }

      const webServiceURL = config.publicBaseUrl ?? record.webServiceURL;
      await signOrThrow(() =>
        buildPass(validated, config, {
          serialNumber: record.serialNumber,
          webServiceURL,
          authenticationToken: record.authToken,
        })
      );

      const result = updatePassSpec(
        record.serialNumber,
        storedSpecJson(body),
        validated.spec.description,
        webServiceURL,
        images
      );
      if (!result) throw notFound();

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
      return {
        serialNumber: record.serialNumber,
        updatedAt: new Date(result.updatedAt).toISOString(),
        revision: result.revision,
        push,
      };
    },

    remove(serialNumber) {
      if (!deletePassRecord(serialNumber)) throw notFound();
      // A minted download link must die with the pass, not linger for its TTL.
      deletePassesForSerial(serialNumber);
      return { ok: true };
    },

    async getSpec(serialNumber) {
      const record = getPassRecord(serialNumber);
      if (!record) throw notFound();
      const images: Record<string, StoredImage> = {};
      for (const [slot, bytes] of Object.entries(getPassImages(record.serialNumber))) {
        images[slot] = { ...(await probeImage(bytes)), bytes: bytes.byteLength };
      }
      return {
        serialNumber: record.serialNumber,
        updatedAt: new Date(record.updatedAt).toISOString(),
        spec: JSON.parse(record.specJson) as unknown,
        images,
      };
    },

    async mintDownload(serialNumber, origin) {
      const record = getPassRecord(serialNumber);
      if (!record) throw notFound();
      const buffer = await signOrThrow(() => rebuildStoredPass(record, config));
      const current = getPassRecord(serialNumber);
      if (!current || current.authToken !== record.authToken) throw notFound();
      return {
        ...(await storeDownload(buffer, record.description, origin, record.serialNumber)),
        serialNumber: record.serialNumber,
      };
    },

    prepareUpload(origin) {
      const { id, ref, expiresAt } = reserveUpload();
      return {
        ref,
        uploadUrl: `${origin}/api/uploads/${id}`,
        expiresAt: new Date(expiresAt).toISOString(),
        maxBytes: MAX_IMAGE_BYTES,
      };
    },
  };
}
