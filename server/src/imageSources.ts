import { randomUUID } from "node:crypto";
import dns from "node:dns";
import type { IncomingMessage } from "node:http";
import https from "node:https";
import { BlockList, isIP, type LookupFunction } from "node:net";
import { probeImage } from "./images";
import { SLOT_NAMES } from "./slots";
import { ApiError, MAX_IMAGE_BYTES, MAX_IMAGE_MEGABYTES } from "./validate";

// Spec images are references, never inline data: an https URL the server
// downloads, or `upload:<id>` naming bytes PUT to a one-time upload URL. Both
// resolve to raw source buffers before validation sees the spec.

// One source image per Wallet artwork slot, optionally inside a localization directory.
const IMAGE_PATH = new RegExp(
  `^(?:[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?\\.lproj/)?(?:${SLOT_NAMES.join("|")})$`
);
const SCALED_IMAGE_PATH = /^(.*)@\d+x$/;
const UPLOAD_REF = /^upload:([0-9a-f-]{36})$/;

const FETCH_TIMEOUT_MS = 20_000;
const MAX_REDIRECTS = 5;
const USER_AGENT = "Pocketful/1.0 (self-hosted Apple Wallet pass server)";

// Downloads may only reach the public internet: an image URL is chosen by an
// agent that reads web pages, so it must not be a way into Railway's private
// network, the host itself, or a metadata endpoint.
const NON_PUBLIC = new BlockList();
for (const [network, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 4],
  ["240.0.0.0", 4],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv4");
}
for (const [network, prefix] of [
  ["::", 128],
  ["::1", 128],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  NON_PUBLIC.addSubnet(network, prefix, "ipv6");
}

export function isPublicAddress(address: string): boolean {
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address);
  if (mapped) return isPublicAddress(mapped[1]);
  const family = isIP(address);
  if (family === 0) return false;
  return !NON_PUBLIC.check(address, family === 4 ? "ipv4" : "ipv6");
}

/**
 * dns.lookup for image downloads that drops non-public addresses. Every
 * connection resolves through it, so the address checked is the address
 * dialed — a DNS answer cannot change between the check and the connect.
 */
export const publicLookup: LookupFunction = (hostname, options, callback) => {
  dns.lookup(hostname, { ...options, all: true }, (err, addresses) => {
    if (err) return callback(err, "");
    const usable = addresses.filter((entry) => isPublicAddress(entry.address));
    if (usable.length === 0) {
      const blocked: NodeJS.ErrnoException = new Error(
        `${hostname} resolves only to private or local addresses`
      );
      blocked.code = "ENOTPUBLIC";
      return callback(blocked, "");
    }
    if (options.all) return callback(null, usable);
    callback(null, usable[0].address, usable[0].family);
  });
};

export const UPLOAD_TTL_MS = 30 * 60 * 1000;
const MAX_UPLOAD_STORE_BYTES = 128 * 1024 * 1024;

interface Upload {
  /** Undefined until the one PUT to its upload URL lands. */
  bytes?: Buffer;
  expiresAt: number;
}

const uploads = new Map<string, Upload>();
// Paired with every uploads.set/.delete of a filled entry, as in store.ts.
let uploadBytes = 0;

function dropUpload(id: string): void {
  const entry = uploads.get(id);
  if (!entry) return;
  uploads.delete(id);
  uploadBytes -= entry.bytes?.byteLength ?? 0;
}

setInterval(() => {
  const now = Date.now();
  for (const [id, entry] of uploads) {
    if (entry.expiresAt <= now) dropUpload(id);
  }
}, 60_000).unref();

function liveUpload(id: string): Upload | undefined {
  const entry = uploads.get(id);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    dropUpload(id);
    return undefined;
  }
  return entry;
}

/** Reserve an empty upload slot; its id is both the URL capability and the ref. */
export function reserveUpload(): { id: string; ref: string; expiresAt: number } {
  const id = randomUUID();
  const expiresAt = Date.now() + UPLOAD_TTL_MS;
  uploads.set(id, { expiresAt });
  return { id, ref: `upload:${id}`, expiresAt };
}

/** Accept the one PUT for a reserved slot. The bytes must decode as an image. */
export async function fillUpload(
  id: string,
  bytes: Buffer
): Promise<{ ref: string; bytes: number; width: number; height: number }> {
  const entry = liveUpload(id);
  if (!entry) throw new ApiError(404, "Upload URL not found or expired — call prepare_image_upload again");
  if (entry.bytes) throw new ApiError(409, "This upload URL was already used — each one takes a single file");
  if (bytes.byteLength === 0) throw new ApiError(400, "The upload body is empty");
  if (bytes.byteLength > MAX_IMAGE_BYTES) {
    throw new ApiError(413, `Uploads are limited to ${MAX_IMAGE_MEGABYTES} MB`);
  }
  let size: { width: number; height: number };
  try {
    size = await probeImage(bytes);
  } catch (err) {
    throw new ApiError(
      400,
      `The upload is not a decodable image (${err instanceof Error ? err.message : String(err)}) — send a PNG, JPEG, or WebP`
    );
  }
  // Oldest first, like the signed-pass store; an evicted ref fails loudly at use.
  for (const [oldId] of uploads) {
    if (uploadBytes + bytes.byteLength <= MAX_UPLOAD_STORE_BYTES) break;
    if (oldId !== id) dropUpload(oldId);
  }
  entry.bytes = bytes;
  uploadBytes += bytes.byteLength;
  return { ref: `upload:${id}`, bytes: bytes.byteLength, ...size };
}

/** Reserve and fill in one step, for images the server supplies itself. */
export async function stashUpload(bytes: Buffer): Promise<string> {
  const { id } = reserveUpload();
  return (await fillUpload(id, bytes)).ref;
}

/** IP-literal hosts skip DNS, so they are checked here before any connection. */
function assertPublicTarget(url: URL, slot: string, original: URL): void {
  if (url.protocol !== "https:") {
    throw new ApiError(400, `images.${slot}: ${original} must stay on https (it led to ${url})`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (isIP(host) && !isPublicAddress(host)) {
    throw new ApiError(400, `images.${slot}: ${original} points at a private or local address`);
  }
}

function get(url: URL, signal: AbortSignal): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    const req = https.request(url, {
      headers: { "user-agent": USER_AGENT, accept: "image/*" },
      lookup: publicLookup,
      signal,
    });
    req.on("response", resolve);
    req.on("error", reject);
    req.end();
  });
}

async function readCapped(res: IncomingMessage, slot: string, url: URL): Promise<Buffer> {
  const tooLarge = () =>
    new ApiError(400, `images.${slot}: ${url} is larger than ${MAX_IMAGE_MEGABYTES} MB`);
  if (Number(res.headers["content-length"]) > MAX_IMAGE_BYTES) {
    res.destroy();
    throw tooLarge();
  }
  const chunks: Buffer[] = [];
  let total = 0;
  for await (const chunk of res) {
    total += (chunk as Buffer).byteLength;
    if (total > MAX_IMAGE_BYTES) {
      res.destroy();
      throw tooLarge();
    }
    chunks.push(chunk as Buffer);
  }
  return Buffer.concat(chunks);
}

/** Download over https only, following at most MAX_REDIRECTS redirects, each re-checked. */
async function fetchImage(url: URL, slot: string): Promise<Buffer> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let current = url;
  for (let hop = 0; ; hop += 1) {
    assertPublicTarget(current, slot, url);
    let res: IncomingMessage;
    try {
      res = await get(current, signal);
    } catch (err) {
      throw new ApiError(
        400,
        `images.${slot}: could not download ${url} (${err instanceof Error ? err.message : String(err)})`
      );
    }
    const status = res.statusCode ?? 0;
    const location = res.headers.location;
    if (status >= 300 && status < 400 && location) {
      res.resume();
      if (hop === MAX_REDIRECTS) {
        throw new ApiError(400, `images.${slot}: ${url} redirected more than ${MAX_REDIRECTS} times`);
      }
      current = new URL(location, current);
      continue;
    }
    if (status < 200 || status >= 300) {
      res.resume();
      throw new ApiError(400, `images.${slot}: ${url} answered HTTP ${status}`);
    }
    return readCapped(res, slot, url);
  }
}

function sourceFor(slot: string, value: unknown): Promise<Buffer> {
  if (typeof value === "string") {
    const upload = UPLOAD_REF.exec(value);
    if (upload) {
      const bytes = liveUpload(upload[1])?.bytes;
      if (!bytes) {
        throw new ApiError(
          400,
          `images.${slot}: ${value} was never uploaded or has expired — call prepare_image_upload and PUT the file again`
        );
      }
      return Promise.resolve(bytes);
    }
    let url: URL | undefined;
    try {
      url = new URL(value);
    } catch {
      url = undefined;
    }
    if (url?.protocol === "https:") return fetchImage(url, slot);
  }
  throw new ApiError(
    400,
    `images.${slot} must be an https:// URL or an upload:<id> ref from prepare_image_upload — inline image data is not accepted`
  );
}

function assertSlotName(name: string): void {
  const scaled = SCALED_IMAGE_PATH.exec(name);
  if (scaled) {
    throw new ApiError(
      400,
      `images.${name}: provide one image per slot ("${scaled[1]}") — the server produces every scale`
    );
  }
  if (!IMAGE_PATH.test(name)) {
    throw new ApiError(
      400,
      `Unknown image path "${name}" — use a Wallet artwork slot name (${SLOT_NAMES.join(", ")})`
    );
  }
}

/**
 * Resolve `spec.images` to source bytes per slot. With `allowRemoval` (updates),
 * a null value marks a stored slot for removal and comes back in `removed`.
 */
export async function resolveImages(
  refs: unknown,
  { allowRemoval = false } = {}
): Promise<{ images: Record<string, Buffer>; removed: string[] }> {
  if (refs === undefined) return { images: {}, removed: [] };
  if (typeof refs !== "object" || refs === null || Array.isArray(refs)) {
    throw new ApiError(400, "images must map Wallet artwork slot names to image refs");
  }
  const removed: string[] = [];
  const pending: [string, Promise<Buffer>][] = [];
  for (const [name, value] of Object.entries(refs)) {
    assertSlotName(name);
    if (value === null && allowRemoval) {
      removed.push(name);
      continue;
    }
    pending.push([name, sourceFor(name, value)]);
  }
  const images: Record<string, Buffer> = {};
  const settled = await Promise.allSettled(pending.map(([, source]) => source));
  settled.forEach((result, index) => {
    if (result.status === "rejected") throw result.reason;
    images[pending[index][0]] = result.value;
  });
  return { images, removed };
}
