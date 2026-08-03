import type {
  BarcodeFormat,
  FieldCategory,
  PassField,
  PassSpec,
  PassStyle,
  TransitType,
} from "./types";

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const STYLES: PassStyle[] = [
  "generic",
  "storeCard",
  "coupon",
  "eventTicket",
  "boardingPass",
];

const BARCODE_FORMATS: BarcodeFormat[] = [
  "PKBarcodeFormatQR",
  "PKBarcodeFormatPDF417",
  "PKBarcodeFormatAztec",
  "PKBarcodeFormatCode128",
];

const TRANSIT_TYPES: TransitType[] = [
  "PKTransitTypeAir",
  "PKTransitTypeBoat",
  "PKTransitTypeBus",
  "PKTransitTypeTrain",
  "PKTransitTypeGeneric",
];

const FIELD_CATEGORIES: FieldCategory[] = [
  "header",
  "primary",
  "secondary",
  "auxiliary",
  "back",
];

// Only names Wallet actually reads, so a spec can't smuggle arbitrary files
// into the archive.
const IMAGE_BASENAMES = [
  "icon",
  "logo",
  "strip",
  "thumbnail",
  "background",
  "footer",
];
const IMAGE_NAMES = new Set(
  IMAGE_BASENAMES.flatMap((n) => [n, `${n}@2x`, `${n}@3x`])
);

const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 12 * 1024 * 1024;

const HEX_COLOR = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR = /^rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)$/;

/** Normalize "#RGB" / "#RRGGBB" / "rgb(r, g, b)" to the rgb() string pass.json wants. */
export function toRgbString(color: string): string {
  const trimmed = color.trim();
  if (RGB_COLOR.test(trimmed)) return trimmed;
  const match = HEX_COLOR.exec(trimmed);
  if (!match) {
    throw new ApiError(
      400,
      `Invalid color "${color}" — use #RRGGBB or rgb(r, g, b)`
    );
  }
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((c) => c + c).join("");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgb(${r}, ${g}, ${b})`;
}

function validateFields(
  fields: unknown
): Partial<Record<FieldCategory, PassField[]>> {
  if (fields === undefined) return {};
  if (typeof fields !== "object" || fields === null || Array.isArray(fields)) {
    throw new ApiError(400, "fields must be an object keyed by category");
  }
  const out: Partial<Record<FieldCategory, PassField[]>> = {};
  for (const [category, list] of Object.entries(fields)) {
    if (!FIELD_CATEGORIES.includes(category as FieldCategory)) {
      throw new ApiError(
        400,
        `Unknown field category "${category}" — expected one of ${FIELD_CATEGORIES.join(", ")}`
      );
    }
    if (!Array.isArray(list)) {
      throw new ApiError(400, `fields.${category} must be an array`);
    }
    const max = category === "back" ? 20 : 10;
    if (list.length > max) {
      throw new ApiError(400, `fields.${category} allows at most ${max} fields`);
    }
    const cleaned: PassField[] = [];
    list.forEach((field, i) => {
      if (typeof field !== "object" || field === null) {
        throw new ApiError(400, `fields.${category}[${i}] must be an object`);
      }
      const { key, label, value } = field as Record<string, unknown>;
      if (typeof value !== "string" || value.length === 0) {
        throw new ApiError(
          400,
          `fields.${category}[${i}].value must be a non-empty string`
        );
      }
      if (label !== undefined && typeof label !== "string") {
        throw new ApiError(400, `fields.${category}[${i}].label must be a string`);
      }
      cleaned.push({
        key:
          typeof key === "string" && key.length > 0
            ? key
            : `${category}-${i + 1}`,
        ...(typeof label === "string" && label.length > 0 ? { label } : {}),
        value,
      });
    });
    if (cleaned.length > 0) out[category as FieldCategory] = cleaned;
  }
  return out;
}

function validateImages(images: unknown): Record<string, Buffer> {
  if (
    typeof images !== "object" ||
    images === null ||
    Array.isArray(images) ||
    Object.keys(images).length === 0
  ) {
    throw new ApiError(
      400,
      "images must be an object mapping image names to base64 PNG data"
    );
  }
  const out: Record<string, Buffer> = {};
  let total = 0;
  for (const [name, data] of Object.entries(images)) {
    if (!IMAGE_NAMES.has(name)) {
      throw new ApiError(
        400,
        `Unknown image "${name}" — expected one of ${IMAGE_BASENAMES.join(", ")} (optionally @2x/@3x)`
      );
    }
    if (typeof data !== "string" || data.length === 0) {
      throw new ApiError(400, `images.${name} must be a base64 string`);
    }
    const buf = Buffer.from(data, "base64");
    if (buf.length < PNG_MAGIC.length || !buf.subarray(0, 8).equals(PNG_MAGIC)) {
      throw new ApiError(
        400,
        `images.${name} is not a PNG — convert before uploading`
      );
    }
    if (buf.length > MAX_IMAGE_BYTES) {
      throw new ApiError(
        400,
        `images.${name} is ${Math.round(buf.length / 1024)} KB — max is ${MAX_IMAGE_BYTES / 1024} KB`
      );
    }
    total += buf.length;
    out[name] = buf;
  }
  if (total > MAX_TOTAL_IMAGE_BYTES) {
    throw new ApiError(400, "Combined image size is too large");
  }
  if (!out["icon"] && !out["icon@2x"]) {
    throw new ApiError(
      400,
      'images must include "icon" (29×29 pt) — Wallet rejects passes without one'
    );
  }
  return out;
}

export interface ValidatedSpec {
  spec: PassSpec;
  fields: Partial<Record<FieldCategory, PassField[]>>;
  images: Record<string, Buffer>;
}

export function validateSpec(body: unknown): ValidatedSpec {
  if (typeof body !== "object" || body === null) {
    throw new ApiError(400, "Request body must be a JSON object");
  }
  const spec = body as PassSpec;

  if (!STYLES.includes(spec.style)) {
    throw new ApiError(
      400,
      `style must be one of ${STYLES.join(", ")} (got ${JSON.stringify(spec.style)})`
    );
  }
  if (typeof spec.description !== "string" || spec.description.trim() === "") {
    throw new ApiError(400, "description is required");
  }
  if (spec.description.length > 200) {
    throw new ApiError(400, "description must be 200 characters or fewer");
  }
  for (const key of ["organizationName", "logoText"] as const) {
    const value = spec[key];
    if (value !== undefined && (typeof value !== "string" || value.length > 100)) {
      throw new ApiError(400, `${key} must be a string of at most 100 characters`);
    }
  }

  if (spec.colors !== undefined) {
    if (typeof spec.colors !== "object" || spec.colors === null) {
      throw new ApiError(400, "colors must be an object");
    }
    for (const key of ["backgroundColor", "foregroundColor", "labelColor"] as const) {
      const value = spec.colors[key];
      if (value !== undefined) {
        if (typeof value !== "string") {
          throw new ApiError(400, `colors.${key} must be a string`);
        }
        toRgbString(value); // throws with a helpful message if malformed
      }
    }
  }

  if (spec.barcode !== undefined) {
    if (typeof spec.barcode !== "object" || spec.barcode === null) {
      throw new ApiError(400, "barcode must be an object");
    }
    if (!BARCODE_FORMATS.includes(spec.barcode.format)) {
      throw new ApiError(
        400,
        `barcode.format must be one of ${BARCODE_FORMATS.join(", ")}`
      );
    }
    if (
      typeof spec.barcode.message !== "string" ||
      spec.barcode.message.length === 0
    ) {
      throw new ApiError(400, "barcode.message is required");
    }
    if (
      spec.barcode.altText !== undefined &&
      typeof spec.barcode.altText !== "string"
    ) {
      throw new ApiError(400, "barcode.altText must be a string");
    }
  }

  if (
    spec.transitType !== undefined &&
    !TRANSIT_TYPES.includes(spec.transitType)
  ) {
    throw new ApiError(
      400,
      `transitType must be one of ${TRANSIT_TYPES.join(", ")}`
    );
  }

  return {
    spec,
    fields: validateFields(spec.fields),
    images: validateImages(spec.images),
  };
}
