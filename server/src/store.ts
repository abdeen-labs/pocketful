import { randomUUID } from "node:crypto";

interface StoredPass {
  buffer: Buffer;
  filename: string;
  expiresAt: number;
}

const passes = new Map<string, StoredPass>();

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of passes) {
    if (entry.expiresAt <= now) passes.delete(id);
  }
}, 60_000).unref();

export function putPass(
  buffer: Buffer,
  filename: string,
  ttlSeconds: number
): { id: string; expiresAt: number } {
  const id = randomUUID();
  const expiresAt = Date.now() + ttlSeconds * 1000;
  passes.set(id, { buffer, filename, expiresAt });
  return { id, expiresAt };
}

export function getPass(id: string): StoredPass | undefined {
  const entry = passes.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    passes.delete(id);
    return undefined;
  }
  return entry;
}
