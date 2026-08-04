import { randomUUID } from "node:crypto";
import { ApiError } from "./validate";

interface StoredPass {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
  /** Set for updatable passes so a DELETE can purge minted links. */
  serialNumber?: string;
}

const passes = new Map<string, StoredPass>();

// Every passes.set/.delete below must be paired with a totalBytes adjustment;
// an unpaired mutation is a slow accounting leak that shrinks the budget.
let totalBytes = 0;

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of passes) {
    if (entry.expiresAt <= now) {
      passes.delete(id);
      totalBytes -= entry.buffer.byteLength;
    }
  }
}, 60_000).unref();

/**
 * Store a signed pass for later download, evicting oldest entries first when
 * the byte budget would be exceeded. A Map iterates in insertion order, so the
 * first key is always the oldest entry — for 15-minute single-download links
 * that is a good enough LRU.
 */
export function putPass(
  buffer: Buffer,
  filename: string,
  ttlSeconds: number,
  maxBytes: number,
  serialNumber?: string
): { id: string; expiresAt: number } {
  if (buffer.byteLength > maxBytes) {
    throw new ApiError(503, "Pass is too large to serve");
  }
  while (totalBytes + buffer.byteLength > maxBytes && passes.size > 0) {
    const oldestId = passes.keys().next().value as string;
    const oldest = passes.get(oldestId)!;
    passes.delete(oldestId);
    totalBytes -= oldest.buffer.byteLength;
  }
  const id = randomUUID();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  passes.set(id, { buffer, filename, expiresAt, serialNumber });
  totalBytes += buffer.byteLength;
  return { id, expiresAt };
}

/** Fetch a stored pass, deleting it if its TTL has lapsed. */
export function getPass(id: string): StoredPass | undefined {
  const entry = passes.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    passes.delete(id);
    totalBytes -= entry.buffer.byteLength;
    return undefined;
  }
  return entry;
}

/**
 * Purge every minted link for a serial so a deleted updatable pass stops
 * being downloadable immediately. Returns how many entries were removed.
 */
export function deletePassesForSerial(serialNumber: string): number {
  let count = 0;
  for (const [id, entry] of passes) {
    if (entry.serialNumber === serialNumber) {
      passes.delete(id);
      totalBytes -= entry.buffer.byteLength;
      count += 1;
    }
  }
  return count;
}

/** Current store occupancy, exposed for tests. */
export function storeStats(): { entries: number; bytes: number } {
  return { entries: passes.size, bytes: totalBytes };
}
