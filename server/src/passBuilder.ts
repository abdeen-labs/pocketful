import { randomUUID } from "node:crypto";
import { PKPass } from "passkit-generator";
import type { Config } from "./config";
import { toRgbString, type ValidatedSpec } from "./validate";

/** Build and sign a .pkpass entirely in memory. */
export function buildPass(
  { spec, fields, images }: ValidatedSpec,
  config: Config
): Buffer {
  const styleBody: Record<string, unknown> = {
    headerFields: fields.header ?? [],
    primaryFields: fields.primary ?? [],
    secondaryFields: fields.secondary ?? [],
    auxiliaryFields: fields.auxiliary ?? [],
    backFields: fields.back ?? [],
  };
  if (spec.style === "boardingPass") {
    styleBody.transitType = spec.transitType ?? "PKTransitTypeGeneric";
  }

  const passJson: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: spec.organizationName || config.organizationName,
    serialNumber: randomUUID(),
    description: spec.description,
    [spec.style]: styleBody,
  };

  if (spec.logoText) passJson.logoText = spec.logoText;
  if (spec.colors?.backgroundColor) {
    passJson.backgroundColor = toRgbString(spec.colors.backgroundColor);
  }
  if (spec.colors?.foregroundColor) {
    passJson.foregroundColor = toRgbString(spec.colors.foregroundColor);
  }
  if (spec.colors?.labelColor) {
    passJson.labelColor = toRgbString(spec.colors.labelColor);
  }

  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(passJson)),
  };
  for (const [name, buffer] of Object.entries(images)) {
    files[`${name}.png`] = buffer;
  }

  const pass = new PKPass(files, {
    wwdr: config.certs.wwdr,
    signerCert: config.certs.signerCert,
    signerKey: config.certs.signerKey,
    signerKeyPassphrase: config.certs.signerKeyPassphrase,
  });

  if (spec.barcode) {
    pass.setBarcodes({
      format: spec.barcode.format,
      message: spec.barcode.message,
      messageEncoding: "iso-8859-1",
      ...(spec.barcode.altText ? { altText: spec.barcode.altText } : {}),
    });
  }

  return pass.getAsBuffer();
}

export function passFilename(description: string): string {
  const safe = description
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
  return `${safe || "pass"}.pkpass`;
}
