import { randomBytes, randomUUID } from "node:crypto";
import { pushPassUpdate, type PushResult } from "./apns";
import type { Config } from "./config";
import {
  deletePassRecord,
  getPassRecord,
  insertPass,
  listPassSummaries,
  updatePassSpec,
  type PassSummary,
} from "./db";
import { buildPass, passFilename } from "./passBuilder";
import { deletePassesForSerial, putPass } from "./store";
import { rebuildStoredPass } from "./updatable";
import { ApiError, validateSpec } from "./validate";

export interface DownloadLink {
  id: string;
  url: string;
  expiresAt: string;
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

export interface StoredSpec {
  serialNumber: string;
  updatedAt: string;
  spec: unknown;
}

/**
 * Pass operations shared by the REST routes and the MCP tools. `origin` is
 * the scheme and host the caller reached the server on: download links use it
 * so they resolve on whatever domain the client is already talking to, while
 * webServiceURL prefers PUBLIC_BASE_URL because Wallet keeps calling it for
 * the life of the pass.
 */
export interface PassService {
  create(body: unknown, origin: string): CreatedPass;
  list(): { passes: PassSummary[] };
  update(serialNumber: string, body: unknown): Promise<UpdatedPass>;
  remove(serialNumber: string): { ok: true };
  getSpec(serialNumber: string): StoredSpec;
  mintDownload(serialNumber: string, origin: string): MintedDownload;
}

function signOrThrow(build: () => Buffer): Buffer {
  try {
    return build();
  } catch (err) {
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

export function createPassService(config: Config): PassService {
  function storeDownload(
    buffer: Buffer,
    description: string,
    origin: string,
    serialNumber?: string
  ): DownloadLink {
    const { id, expiresAt } = putPass(
      buffer,
      passFilename(description),
      config.passTtlSeconds,
      config.passStoreMaxBytes,
      serialNumber
    );
    return {
      id,
      url: `${origin}/api/passes/${id}`,
      expiresAt: new Date(expiresAt).toISOString(),
    };
  }

  return {
    create(body, origin) {
      const validated = validateSpec(body);
      const { spec } = validated;

      if (!spec.updatable) {
        const buffer = signOrThrow(() => buildPass(validated, config));
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
      const buffer = signOrThrow(() => buildPass(validated, config, identity));
      insertPass({
        serialNumber,
        authToken: identity.authenticationToken,
        webServiceURL: identity.webServiceURL,
        specJson: JSON.stringify(body),
        description: spec.description,
      });
      return {
        ...storeDownload(buffer, spec.description, origin, serialNumber),
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
      const validated = validateSpec(body);
      if (
        validated.spec.serialNumber &&
        validated.spec.serialNumber !== record.serialNumber
      ) {
        throw new ApiError(400, "serialNumber cannot change on update");
      }

      const webServiceURL = config.publicBaseUrl ?? record.webServiceURL;
      signOrThrow(() =>
        buildPass(validated, config, {
          serialNumber: record.serialNumber,
          webServiceURL,
          authenticationToken: record.authToken,
        })
      );

      const result = updatePassSpec(
        record.serialNumber,
        JSON.stringify(body),
        validated.spec.description,
        webServiceURL
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

    getSpec(serialNumber) {
      const record = getPassRecord(serialNumber);
      if (!record) throw notFound();
      return {
        serialNumber: record.serialNumber,
        updatedAt: new Date(record.updatedAt).toISOString(),
        spec: JSON.parse(record.specJson) as unknown,
      };
    },

    mintDownload(serialNumber, origin) {
      const record = getPassRecord(serialNumber);
      if (!record) throw notFound();
      const buffer = signOrThrow(() => rebuildStoredPass(record, config));
      return {
        ...storeDownload(buffer, record.description, origin, record.serialNumber),
        serialNumber: record.serialNumber,
      };
    },
  };
}
