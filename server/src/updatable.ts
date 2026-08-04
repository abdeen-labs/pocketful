import { createHash, timingSafeEqual } from "node:crypto";
import type { Config } from "./config";
import type { PassRecord } from "./db";
import { buildPass } from "./passBuilder";
import { validateSpec } from "./validate";

/**
 * Re-sign the latest stored spec for an updatable pass. PUBLIC_BASE_URL wins
 * over the URL stamped at creation so a domain move migrates devices on their
 * next refresh.
 */
export function rebuildStoredPass(record: PassRecord, config: Config): Buffer {
  const validated = validateSpec(JSON.parse(record.specJson));
  return buildPass(validated, config, {
    serialNumber: record.serialNumber,
    webServiceURL: config.publicBaseUrl ?? record.webServiceURL,
    authenticationToken: record.authToken,
  });
}

/** Constant-time comparison of secrets of possibly different lengths. */
export function secretsMatch(a: string, b: string): boolean {
  const digestA = createHash("sha256").update(a).digest();
  const digestB = createHash("sha256").update(b).digest();
  return timingSafeEqual(digestA, digestB);
}
