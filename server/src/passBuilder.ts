import { randomUUID } from "node:crypto";
import { PKPass } from "passkit-generator";
import type { Config } from "./config";
import type { FieldCategory, PassField, PassStyle, TransitType } from "./types";
import { toRgbString, type ValidatedSpec } from "./validate";

/**
 * Identity of a server-managed updatable pass. Wins over anything in the
 * spec so devices always call back to this server with the stored token.
 */
export interface UpdatableIdentity {
  serialNumber: string;
  webServiceURL: string;
  authenticationToken: string;
}

/** The dictionary Apple expects under a pass style key. */
function styleDictionary(
  style: PassStyle,
  fields: Partial<Record<FieldCategory, PassField[]>>,
  transitType: TransitType | undefined
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    headerFields: fields.header ?? [],
    primaryFields: fields.primary ?? [],
    secondaryFields: fields.secondary ?? [],
    auxiliaryFields: fields.auxiliary ?? [],
    backFields: fields.back ?? [],
  };
  if (style === "eventTicket") {
    body.additionalInfoFields = fields.additionalInfo ?? [];
  }
  if (style === "boardingPass") {
    body.transitType = transitType ?? "PKTransitTypeGeneric";
  }
  if (style === "posterGeneric") {
    body.footerFields = fields.footer ?? [];
  }
  return body;
}

/**
 * The unsigned pass.json for a validated spec. Every style in the spec gets
 * its own dictionary; Wallet renders the newest one it understands.
 */
export function buildPassJson(
  { spec, fields, additionalStyles }: ValidatedSpec,
  config: Config,
  identity?: UpdatableIdentity
): Record<string, unknown> {
  const styles = new Set<PassStyle>([
    spec.style,
    ...additionalStyles.map((entry) => entry.style),
  ]);

  const passJson: Record<string, unknown> = {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    teamIdentifier: config.teamIdentifier,
    organizationName: spec.organizationName || config.organizationName,
    serialNumber: spec.serialNumber || randomUUID(),
    description: spec.description,
    ...(spec.options ?? {}),
    ...(styles.has("eventTicket") ? spec.eventTicketOptions ?? {} : {}),
    ...(styles.has("boardingPass") ? spec.boardingPassOptions ?? {} : {}),
    ...(styles.has("posterGeneric") ? spec.posterGenericOptions ?? {} : {}),
    ...(spec.upcomingPassInformation
      ? { upcomingPassInformation: spec.upcomingPassInformation }
      : {}),
    ...(spec.featuredActions?.length
      ? { featuredActions: spec.featuredActions }
      : {}),
    [spec.style]: styleDictionary(spec.style, fields, spec.transitType),
  };
  for (const entry of additionalStyles) {
    passJson[entry.style] = styleDictionary(entry.style, entry.fields, entry.transitType);
  }

  if (identity) {
    passJson.serialNumber = identity.serialNumber;
    passJson.webServiceURL = identity.webServiceURL;
    passJson.authenticationToken = identity.authenticationToken;
  }

  if (spec.logoText) passJson.logoText = spec.logoText;
  for (const key of [
    "backgroundColor",
    "foregroundColor",
    "labelColor",
    "stripColor",
    "footerBackgroundColor",
  ] as const) {
    const value = spec.colors?.[key];
    if (value) passJson[key] = toRgbString(value);
  }

  return passJson;
}

/** Build and sign a .pkpass entirely in memory. */
export function buildPass(
  validated: ValidatedSpec,
  config: Config,
  identity?: UpdatableIdentity
): Buffer {
  const { spec, images } = validated;
  const files: Record<string, Buffer> = {
    "pass.json": Buffer.from(JSON.stringify(buildPassJson(validated, config, identity))),
  };
  for (const [name, buffer] of Object.entries(images)) {
    files[`${name}.png`] = buffer;
  }
  if (spec.personalization) {
    files["personalization.json"] = Buffer.from(
      JSON.stringify(spec.personalization)
    );
  }

  const pass = new PKPass(files, {
    wwdr: config.certs.wwdr,
    signerCert: config.certs.signerCert,
    signerKey: config.certs.signerKey,
    signerKeyPassphrase: config.certs.signerKeyPassphrase,
  });

  if (spec.preferredStyleSchemes?.length) {
    pass.preferredStyleSchemes = spec.preferredStyleSchemes;
  }
  // Upcoming pass entries are imported from pass.json above so the installed
  // passkit-generator version remains the source of truth for their iOS 26 schema.
  if (spec.expirationDate) pass.setExpirationDate(new Date(spec.expirationDate));
  if (spec.relevantDate) pass.setRelevantDate(new Date(spec.relevantDate));
  if (spec.relevantDates?.length) pass.setRelevantDates(spec.relevantDates);
  if (spec.locations?.length) pass.setLocations(...spec.locations);
  if (spec.beacons?.length) pass.setBeacons(...spec.beacons);
  if (spec.barcodes?.length) pass.setBarcodes(...spec.barcodes);
  if (spec.nfc) pass.setNFC(spec.nfc);
  for (const localization of spec.localizations ?? []) {
    pass.localize(localization.language, localization.translations);
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
