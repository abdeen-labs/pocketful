import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import sharp from "sharp";
import { centeredCrop, probeImage, renderSlot } from "./images";
import { SCALES, slotSize } from "./slots";

type Rgb = [number, number, number];
const RED: Rgb = [255, 0, 0];
const GREEN: Rgb = [0, 255, 0];
const BLUE: Rgb = [0, 0, 255];

/** A `width`×`height` RGB image split into three vertical bands: red, green, blue. */
function bands(width: number, height: number): Buffer {
  const raw = Buffer.alloc(width * height * 3);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const color = x < width / 3 ? RED : x < (2 * width) / 3 ? GREEN : BLUE;
      raw.set(color, (y * width + x) * 3);
    }
  }
  return raw;
}

function encode(raw: Buffer, width: number, height: number): sharp.Sharp {
  return sharp(raw, { raw: { width, height, channels: 3 } });
}

async function pixel(png: Buffer, x: number, y: number): Promise<Rgb> {
  const { data, info } = await sharp(png)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const offset = (y * info.width + x) * info.channels;
  return [data[offset], data[offset + 1], data[offset + 2]];
}

function near(actual: Rgb, expected: Rgb, tolerance = 8): void {
  actual.forEach((channel, index) => {
    assert.ok(
      Math.abs(channel - expected[index]) <= tolerance,
      `expected ${expected} got ${actual}`
    );
  });
}

async function dimensions(png: Buffer): Promise<[number, number, string]> {
  const meta = await sharp(png).metadata();
  return [meta.width, meta.height, meta.format];
}

test("centeredCrop keeps the full height of a wide source and centers horizontally", () => {
  assert.deepEqual(centeredCrop({ width: 400, height: 100 }, 1), {
    left: 150,
    top: 0,
    width: 100,
    height: 100,
  });
});

test("centeredCrop keeps the full width of a tall source and rounds the rest", () => {
  assert.deepEqual(centeredCrop({ width: 100, height: 400 }, 160 / 50), {
    left: 0,
    top: 185,
    width: 100,
    height: 31,
  });
});

test("centeredCrop returns the whole source when the aspect already matches", () => {
  assert.deepEqual(centeredCrop({ width: 358, height: 448 }, 358 / 448), {
    left: 0,
    top: 0,
    width: 358,
    height: 448,
  });
});

test("centeredCrop never collapses below one pixel", () => {
  const crop = centeredCrop({ width: 1, height: 1000 }, 286 / 15);
  assert.equal(crop.width, 1);
  assert.equal(crop.height, 1);
});

test("renderSlot crops to the slot's aspect from the center", async () => {
  const source = await encode(bands(300, 100), 300, 100).png().toBuffer();
  const [oneX] = await renderSlot(source, slotSize("thumbnail", "generic"));
  near(await pixel(oneX, 2, 45), GREEN);
  near(await pixel(oneX, 87, 45), GREEN);
  near(await pixel(oneX, 45, 2), GREEN);
});

test("renderSlot keeps the full height of a source wider than the slot", async () => {
  const source = await encode(bands(300, 100), 300, 100).png().toBuffer();
  const [oneX] = await renderSlot(source, slotSize("strip", "generic"));
  assert.deepEqual(await dimensions(oneX), [375, 144, "png"]);
  near(await pixel(oneX, 2, 72), RED);
  near(await pixel(oneX, 187, 72), GREEN);
  near(await pixel(oneX, 372, 72), BLUE);
});

test("renderSlot emits 1x, 2x and 3x PNGs at the slot's point size", async () => {
  const source = await encode(bands(300, 300), 300, 300).png().toBuffer();
  const renditions = await renderSlot(source, slotSize("logo", "generic"));
  assert.equal(renditions.length, SCALES.length);
  for (const [index, scale] of SCALES.entries()) {
    assert.deepEqual(await dimensions(renditions[index]), [160 * scale, 50 * scale, "png"]);
  }
});

test("the strip follows the event ticket layout", () => {
  assert.deepEqual(slotSize("strip", "eventTicket"), { width: 375, height: 98 });
  assert.deepEqual(slotSize("strip", "storeCard"), { width: 375, height: 144 });
  assert.deepEqual(slotSize("strip", "coupon"), { width: 375, height: 144 });
});

test("renderSlot converts JPEG and WebP sources to PNG", async () => {
  for (const format of ["jpeg", "webp"] as const) {
    const source = await encode(bands(120, 120), 120, 120)[format]().toBuffer();
    const [oneX, , threeX] = await renderSlot(source, slotSize("icon", "generic"));
    assert.deepEqual(await dimensions(oneX), [29, 29, "png"]);
    assert.deepEqual(await dimensions(threeX), [87, 87, "png"]);
  }
});

test("renderSlot honours EXIF orientation before cropping", async () => {
  // 100×50 with red on the left and blue on the right; orientation 6 rotates
  // it 90° clockwise so red ends up on top of blue in a 50×100 frame.
  const raw = Buffer.alloc(100 * 50 * 3);
  for (let y = 0; y < 50; y += 1) {
    for (let x = 0; x < 100; x += 1) {
      raw.set(x < 50 ? RED : BLUE, (y * 100 + x) * 3);
    }
  }
  const source = await encode(raw, 100, 50)
    .jpeg({ quality: 100 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  assert.deepEqual(await probeImage(source), { width: 50, height: 100 });
  const [oneX] = await renderSlot(source, slotSize("thumbnail", "generic"));
  near(await pixel(oneX, 45, 2), RED);
  near(await pixel(oneX, 45, 87), BLUE);
});

test("renderSlot preserves transparency", async () => {
  const source = await sharp({
    create: { width: 60, height: 60, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();
  const [oneX] = await renderSlot(source, slotSize("icon", "generic"));
  const meta = await sharp(oneX).metadata();
  assert.equal(meta.hasAlpha, true);
  const { data } = await sharp(oneX).raw().toBuffer({ resolveWithObject: true });
  assert.equal(data[3], 0);
});

test("the bundled icon source renders through the same pipeline", async () => {
  const svg = readFileSync(path.join(__dirname, "../assets/icon.svg"));
  const renditions = await renderSlot(svg, slotSize("icon", "generic"));
  assert.deepEqual(await dimensions(renditions[0]), [29, 29, "png"]);
  assert.deepEqual(await dimensions(renditions[1]), [58, 58, "png"]);
  assert.deepEqual(await dimensions(renditions[2]), [87, 87, "png"]);
});

test("probeImage rejects data that is not an image", async () => {
  await assert.rejects(probeImage(Buffer.from("definitely not an image")));
  await assert.rejects(
    probeImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  );
});
