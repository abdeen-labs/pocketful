import { EventEmitter } from "node:events";
import https from "node:https";
import { Readable } from "node:stream";
import type { TestContext } from "node:test";
import { crc32, deflateSync } from "node:zlib";
import { validateSpec } from "./validate";

// Shared by the test files; excluded from the build in tsconfig.json.

function pngChunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A solid-color RGB PNG, encoded synchronously so fixtures can be module constants. */
export function solidPng(width: number, height: number, rgb: [number, number, number] = [20, 40, 90]): Buffer {
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x += 1) row.set(rgb, 1 + x * 3);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.concat(Array.from({ length: height }, () => row)))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

/**
 * Big enough for every slot's @3x render after the center crop (artwork needs
 * 1074×1344, strip 1125 wide), so fixtures clear the no-upscaling rule.
 */
export const SOURCE_PNG = solidPng(1200, 1500);

/** validateSpec with the spec's images given as source buffers, as the service resolves them. */
export function validate(spec: unknown): ReturnType<typeof validateSpec> {
  if (typeof spec !== "object" || spec === null || Array.isArray(spec)) return validateSpec(spec, {});
  const { images, ...rest } = spec as Record<string, unknown>;
  return validateSpec(rest, (images ?? {}) as Record<string, Buffer>);
}

export interface FakeResponse {
  status: number;
  headers?: Record<string, string>;
  body?: Buffer | string;
}

/**
 * Answer https.request — the image downloader's transport — from canned
 * responses keyed by URL. Returns the URLs requested, in order.
 */
export function serveHttps(t: TestContext, routes: Record<string, FakeResponse>): string[] {
  const requested: string[] = [];
  t.mock.method(https, "request", (url: URL) => {
    requested.push(url.href);
    const req = Object.assign(new EventEmitter(), {
      end() {
        setImmediate(() => {
          const route = routes[url.href];
          if (!route) {
            req.emit("error", new Error(`no fake route for ${url.href}`));
            return;
          }
          const body = route.body === undefined ? [] : [Buffer.from(route.body)];
          req.emit(
            "response",
            Object.assign(Readable.from(body), { statusCode: route.status, headers: route.headers ?? {} })
          );
        });
      },
    });
    return req;
  });
  return requested;
}
