import sharp from "sharp";
import { SCALES, type SlotSize } from "./slots";

// Source image → center crop to the slot's aspect → PNG at 1x/2x/3x of the
// slot's point size, which is exactly what Wallet expects to find in the
// .pkpass.

/** Decoded-size cap: a 4 MB PNG can expand to gigabytes of pixels. */
const MAX_SOURCE_PIXELS = 50_000_000;

const INPUT_OPTIONS = { autoOrient: true, limitInputPixels: MAX_SOURCE_PIXELS };

export interface Region {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Oriented pixel dimensions of a decodable image. Throws when sharp cannot read it. */
export async function probeImage(buffer: Buffer): Promise<SlotSize> {
  const { autoOrient } = await sharp(buffer, INPUT_OPTIONS).metadata();
  const { width, height } = autoOrient;
  if (!width || !height) throw new Error("image has no dimensions");
  if (width * height > MAX_SOURCE_PIXELS) {
    throw new Error(`image exceeds ${MAX_SOURCE_PIXELS / 1_000_000} megapixels`);
  }
  return { width, height };
}

/** The largest rect with the target aspect that fits centered in the source. */
export function centeredCrop(size: SlotSize, targetAspect: number): Region {
  const sourceAspect = size.width / size.height;
  let width: number;
  let height: number;
  if (sourceAspect > targetAspect) {
    height = size.height;
    width = Math.round(height * targetAspect);
  } else {
    width = size.width;
    height = Math.round(width / targetAspect);
  }
  width = Math.max(1, Math.min(width, size.width));
  height = Math.max(1, Math.min(height, size.height));
  return {
    left: Math.round((size.width - width) / 2),
    top: Math.round((size.height - height) / 2),
    width,
    height,
  };
}

/** PNG renditions of `source` for one slot, ordered 1x, 2x, 3x. */
export async function renderSlot(source: Buffer, slot: SlotSize): Promise<Buffer[]> {
  const crop = centeredCrop(await probeImage(source), slot.width / slot.height);
  return Promise.all(
    SCALES.map((scale) =>
      sharp(source, INPUT_OPTIONS)
        .extract(crop)
        .resize(slot.width * scale, slot.height * scale, { fit: "fill" })
        .png()
        .toBuffer()
    )
  );
}
