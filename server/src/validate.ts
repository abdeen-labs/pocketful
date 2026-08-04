import type {
  BarcodeFormat,
  FieldCategory,
  PassField,
  PassSpec,
  PassStyle,
  PersonalizationField,
  PreferredStyleScheme,
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
  "additionalInfo",
];
const STYLE_SCHEMES: PreferredStyleScheme[] = [
  "posterEventTicket",
  "eventTicket",
  "boardingPass",
  "semanticBoardingPass",
];
const PERSONALIZATION_FIELDS: PersonalizationField[] = [
  "PKPassPersonalizationFieldName",
  "PKPassPersonalizationFieldPostalCode",
  "PKPassPersonalizationFieldEmailAddress",
  "PKPassPersonalizationFieldPhoneNumber",
];

// Wallet's standard PNG assets, optionally inside a localization directory.
const IMAGE_NAME = /^(?:(?:[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?)\.lproj\/)?(?:icon|logo|primaryLogo|secondaryLogo|artwork|strip|thumbnail|background|footer|personalizationLogo)(?:@[23]x)?$/;
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_IMAGE_MEGABYTES = 4;
const MAX_IMAGE_BYTES = MAX_IMAGE_MEGABYTES * 1024 * 1024;
export const MAX_TOTAL_IMAGE_BYTES = 24 * 1024 * 1024;

const HEX_COLOR = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const RGB_COLOR = /^rgb\(\s*(?:\d{1,3})\s*,\s*(?:\d{1,3})\s*,\s*(?:\d{1,3})\s*\)$/;
const LANGUAGE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertOptionalString(
  value: unknown,
  path: string,
  max = 2_000
): asserts value is string | undefined {
  if (value !== undefined && (typeof value !== "string" || value.length > max)) {
    throw new ApiError(400, `${path} must be a string of at most ${max} characters`);
  }
}

function assertFiniteNumber(value: unknown, path: string): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new ApiError(400, `${path} must be a finite number`);
  }
}

function assertDateString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || !value || Number.isNaN(Date.parse(value))) {
    throw new ApiError(400, `${path} must be an ISO-8601 date`);
  }
}

/** Normalize #RGB / #RRGGBB / rgb(r, g, b) to the rgb() string pass.json wants. */
export function toRgbString(color: string): string {
  const trimmed = color.trim();
  if (RGB_COLOR.test(trimmed)) {
    const channels = trimmed.match(/\d+/g)?.map(Number) ?? [];
    if (channels.length === 3 && channels.every((channel) => channel <= 255)) {
      return `rgb(${channels[0]}, ${channels[1]}, ${channels[2]})`;
    }
  }
  const match = HEX_COLOR.exec(trimmed);
  if (!match) {
    throw new ApiError(400, `Invalid color "${color}" — use #RRGGBB or rgb(r, g, b)`);
  }
  let hex = match[1];
  if (hex.length === 3) hex = hex.split("").map((character) => character + character).join("");
  return `rgb(${parseInt(hex.slice(0, 2), 16)}, ${parseInt(hex.slice(2, 4), 16)}, ${parseInt(hex.slice(4, 6), 16)})`;
}

function validateFields(fields: unknown): Partial<Record<FieldCategory, PassField[]>> {
  if (fields === undefined) return {};
  if (!isRecord(fields)) {
    throw new ApiError(400, "fields must be an object keyed by category");
  }
  const out: Partial<Record<FieldCategory, PassField[]>> = {};
  for (const [category, list] of Object.entries(fields)) {
    if (!FIELD_CATEGORIES.includes(category as FieldCategory)) {
      throw new ApiError(400, `Unknown field category "${category}"`);
    }
    if (!Array.isArray(list)) throw new ApiError(400, `fields.${category} must be an array`);
    const max = category === "back" || category === "additionalInfo" ? 20 : 10;
    if (list.length > max) throw new ApiError(400, `fields.${category} allows at most ${max} fields`);
    const cleaned: PassField[] = [];
    list.forEach((candidate, index) => {
      if (!isRecord(candidate)) throw new ApiError(400, `fields.${category}[${index}] must be an object`);
      const value = candidate.value;
      if ((typeof value !== "string" && typeof value !== "number") || value === "" || (typeof value === "number" && !Number.isFinite(value))) {
        throw new ApiError(400, `fields.${category}[${index}].value must be text or a finite number`);
      }
      const key = typeof candidate.key === "string" && candidate.key ? candidate.key : `${category}-${index + 1}`;
      assertOptionalString(candidate.label, `fields.${category}[${index}].label`, 500);
      cleaned.push({ ...candidate, key, value } as PassField);
    });
    if (cleaned.length) out[category as FieldCategory] = cleaned;
  }
  return out;
}

function validateImages(images: unknown): Record<string, Buffer> {
  if (!isRecord(images) || Object.keys(images).length === 0) {
    throw new ApiError(400, "images must map Wallet image names to base64 PNG data");
  }
  const out: Record<string, Buffer> = {};
  let total = 0;
  for (const [name, data] of Object.entries(images)) {
    if (!IMAGE_NAME.test(name)) {
      throw new ApiError(400, `Unknown image path "${name}" — use a standard Wallet PNG asset name`);
    }
    if (typeof data !== "string" || !data) throw new ApiError(400, `images.${name} must be a base64 string`);
    const buffer = Buffer.from(data, "base64");
    if (buffer.length < PNG_MAGIC.length || !buffer.subarray(0, 8).equals(PNG_MAGIC)) {
      throw new ApiError(400, `images.${name} is not a PNG`);
    }
    if (buffer.length > MAX_IMAGE_BYTES) {
      throw new ApiError(400, `images.${name} exceeds ${MAX_IMAGE_MEGABYTES} MB`);
    }
    total += buffer.length;
    out[name] = buffer;
  }
  if (total > MAX_TOTAL_IMAGE_BYTES) throw new ApiError(400, "Combined image size exceeds 24 MB");
  if (!out.icon && !out["icon@2x"] && !out["icon@3x"]) {
    throw new ApiError(400, 'images must include "icon" — Wallet rejects passes without one');
  }
  return out;
}

function validateCollections(spec: PassSpec): void {
  if (spec.barcodes !== undefined) {
    if (!Array.isArray(spec.barcodes) || spec.barcodes.length > 4) throw new ApiError(400, "barcodes must contain at most four entries");
    spec.barcodes.forEach((barcode, index) => {
      if (!isRecord(barcode) || !BARCODE_FORMATS.includes(barcode.format as BarcodeFormat)) throw new ApiError(400, `barcodes[${index}].format is invalid`);
      if (typeof barcode.message !== "string" || !barcode.message) throw new ApiError(400, `barcodes[${index}].message is required`);
      assertOptionalString(barcode.altText, `barcodes[${index}].altText`, 1_000);
      assertOptionalString(barcode.messageEncoding, `barcodes[${index}].messageEncoding`, 100);
    });
  }

  if (spec.locations !== undefined) {
    if (!Array.isArray(spec.locations) || spec.locations.length > 10) throw new ApiError(400, "locations must contain at most ten entries");
    spec.locations.forEach((location, index) => {
      if (!isRecord(location)) throw new ApiError(400, `locations[${index}] must be an object`);
      assertFiniteNumber(location.latitude, `locations[${index}].latitude`);
      assertFiniteNumber(location.longitude, `locations[${index}].longitude`);
      if (location.latitude < -90 || location.latitude > 90 || location.longitude < -180 || location.longitude > 180) throw new ApiError(400, `locations[${index}] coordinates are out of range`);
      if (location.altitude !== undefined) assertFiniteNumber(location.altitude, `locations[${index}].altitude`);
      assertOptionalString(location.relevantText, `locations[${index}].relevantText`, 1_000);
    });
  }

  if (spec.beacons !== undefined) {
    if (!Array.isArray(spec.beacons) || spec.beacons.length > 10) throw new ApiError(400, "beacons must contain at most ten entries");
    spec.beacons.forEach((beacon, index) => {
      if (!isRecord(beacon) || typeof beacon.proximityUUID !== "string" || !beacon.proximityUUID) throw new ApiError(400, `beacons[${index}].proximityUUID is required`);
      for (const key of ["major", "minor"] as const) {
        const value = beacon[key];
        if (value !== undefined && (!Number.isInteger(value) || value < 0 || value > 65_535)) throw new ApiError(400, `beacons[${index}].${key} must be an integer from 0 to 65535`);
      }
      assertOptionalString(beacon.relevantText, `beacons[${index}].relevantText`, 1_000);
    });
  }

  if (spec.relevantDates !== undefined) {
    if (!Array.isArray(spec.relevantDates) || spec.relevantDates.length > 20) throw new ApiError(400, "relevantDates must contain at most twenty entries");
    spec.relevantDates.forEach((entry, index) => {
      if (!isRecord(entry)) throw new ApiError(400, `relevantDates[${index}] must be an object`);
      if ("date" in entry) assertDateString(entry.date, `relevantDates[${index}].date`);
      else {
        assertDateString(entry.startDate, `relevantDates[${index}].startDate`);
        assertDateString(entry.endDate, `relevantDates[${index}].endDate`);
      }
    });
  }
}

function validateAdvanced(spec: PassSpec): void {
  if (spec.expirationDate !== undefined) assertDateString(spec.expirationDate, "expirationDate");
  if (spec.relevantDate !== undefined) assertDateString(spec.relevantDate, "relevantDate");
  if (spec.transitType !== undefined && !TRANSIT_TYPES.includes(spec.transitType)) throw new ApiError(400, "transitType is invalid");
  if (spec.preferredStyleSchemes !== undefined) {
    if (!Array.isArray(spec.preferredStyleSchemes) || spec.preferredStyleSchemes.some((value) => !STYLE_SCHEMES.includes(value))) throw new ApiError(400, "preferredStyleSchemes contains an unsupported value");
    if (spec.style !== "eventTicket" && spec.style !== "boardingPass") throw new ApiError(400, "preferredStyleSchemes requires an event ticket or boarding pass");
  }
  if (spec.nfc !== undefined) {
    if (!isRecord(spec.nfc) || typeof spec.nfc.message !== "string" || !spec.nfc.message || typeof spec.nfc.encryptionPublicKey !== "string" || !spec.nfc.encryptionPublicKey) throw new ApiError(400, "nfc requires message and encryptionPublicKey");
  }
  if (spec.localizations !== undefined) {
    if (!Array.isArray(spec.localizations) || spec.localizations.length > 20) throw new ApiError(400, "localizations must contain at most twenty languages");
    const languages = new Set<string>();
    spec.localizations.forEach((localization, index) => {
      if (!isRecord(localization) || typeof localization.language !== "string" || !LANGUAGE.test(localization.language)) throw new ApiError(400, `localizations[${index}].language is invalid`);
      if (languages.has(localization.language)) throw new ApiError(400, `Duplicate localization language "${localization.language}"`);
      languages.add(localization.language);
      if (!isRecord(localization.translations)) throw new ApiError(400, `localizations[${index}].translations must be an object`);
      for (const [key, value] of Object.entries(localization.translations)) {
        if (!key || typeof value !== "string") throw new ApiError(400, `localizations[${index}] translations must map non-empty keys to strings`);
      }
    });
  }
  if (spec.personalization !== undefined) {
    const personalization = spec.personalization;
    if (!isRecord(personalization) || typeof personalization.description !== "string" || !personalization.description) throw new ApiError(400, "personalization.description is required");
    if (!Array.isArray(personalization.requiredPersonalizationFields) || personalization.requiredPersonalizationFields.some((field) => !PERSONALIZATION_FIELDS.includes(field))) throw new ApiError(400, "personalization.requiredPersonalizationFields is invalid");
    assertOptionalString(personalization.termsAndConditions, "personalization.termsAndConditions", 20_000);
    if (!spec.nfc) throw new ApiError(400, "personalization requires NFC details");
  }
  if (spec.upcomingPassInformation !== undefined) {
    if (spec.style !== "eventTicket" || !spec.preferredStyleSchemes?.includes("posterEventTicket")) throw new ApiError(400, "upcomingPassInformation requires the poster event-ticket style");
    if (!Array.isArray(spec.upcomingPassInformation) || spec.upcomingPassInformation.some((entry) => !isRecord(entry))) throw new ApiError(400, "upcomingPassInformation must be an array of objects");
  }
}

function validateModernStyleRequirements(
  spec: PassSpec,
  images: Record<string, Buffer>
): void {
  const semantics = isRecord(spec.options) && isRecord(spec.options.semantics)
    ? spec.options.semantics
    : {};

  if (spec.preferredStyleSchemes?.includes("posterEventTicket")) {
    if (spec.style !== "eventTicket") {
      throw new ApiError(400, "posterEventTicket requires the eventTicket style");
    }
    if (!hasImageAsset(images, "artwork")) {
      throw new ApiError(400, "posterEventTicket requires artwork PNG assets");
    }
    // Wallet logs `Failed to validate "posterEventTicket" scheme for pass: Pass
    // does not contain VAS or Barcode information.` and silently renders the
    // legacy layout when the pass has no entry credential.
    if (!spec.barcodes?.length && !spec.nfc) {
      throw new ApiError(
        400,
        "posterEventTicket requires a barcode or NFC — Wallet refuses the poster layout without an entry credential"
      );
    }
    assertSemanticKeys(
      semantics,
      ["eventName", "venueName", "venueRegionName", "venueRoom"],
      "posterEventTicket"
    );
    if (semantics.eventType === "PKEventTypeSports") {
      assertSemanticKeys(
        semantics,
        ["awayTeamAbbreviation", "homeTeamAbbreviation"],
        "sports posterEventTicket"
      );
    }
    if (
      semantics.eventType === "PKEventTypeLivePerformance" &&
      (!Array.isArray(semantics.performerNames) || semantics.performerNames.length === 0)
    ) {
      throw new ApiError(
        400,
        "live-performance posterEventTicket requires performerNames semantics"
      );
    }
  }

  if (spec.preferredStyleSchemes?.includes("semanticBoardingPass")) {
    if (spec.style !== "boardingPass" || spec.transitType !== "PKTransitTypeAir") {
      throw new ApiError(
        400,
        "semanticBoardingPass requires an airline boardingPass"
      );
    }
    assertSemanticKeys(
      semantics,
      [
        "airlineCode",
        "flightNumber",
        "departureAirportCode",
        "departureCityName",
        "departureLocationTimeZone",
        "destinationAirportCode",
        "destinationCityName",
        "destinationLocationTimeZone",
        "originalArrivalDate",
        "originalBoardingDate",
        "originalDepartureDate",
        "passengerName",
      ],
      "semanticBoardingPass"
    );
  }
}

function hasImageAsset(images: Record<string, Buffer>, name: string): boolean {
  return Boolean(images[name] || images[`${name}@2x`] || images[`${name}@3x`]);
}

function assertSemanticKeys(
  semantics: Record<string, unknown>,
  keys: string[],
  label: string
): void {
  const missing = keys.filter((key) => {
    const value = semantics[key];
    return value === undefined || value === null || value === "";
  });
  if (missing.length) {
    throw new ApiError(
      400,
      `${label} is missing required semantics: ${missing.join(", ")}`
    );
  }
}

// The option objects are spread verbatim into the signed pass.json, so every
// key here is one the operator's certificate will vouch for. Unknown keys are
// rejected: Wallet silently refuses to install a pass with malformed keys and
// the server would otherwise have no signal that it produced one.
type OptionRule =
  | { kind: "httpsUrl" }
  // App-launch URLs are usually custom schemes (myapp://...), so they only
  // need to be absolute and not a script scheme.
  | { kind: "launchUrl" }
  | { kind: "email" }
  | { kind: "phone" }
  | { kind: "boolean" }
  | { kind: "string"; max?: number }
  | { kind: "storeIds" }
  | { kind: "positiveNumber" }
  | { kind: "boundedObject"; max: number };

const PASS_OPTION_RULES: Record<string, OptionRule> = {
  appLaunchURL: { kind: "launchUrl" },
  voided: { kind: "boolean" },
  userInfo: { kind: "boundedObject", max: 4_096 },
  sharingProhibited: { kind: "boolean" },
  groupingIdentifier: { kind: "string" },
  suppressStripShine: { kind: "boolean" },
  maxDistance: { kind: "positiveNumber" },
  // Semantics stay unvalidated beyond shape and size: Apple's semantic-tag
  // vocabulary is large and versioned, and validateModernStyleRequirements
  // already asserts the keys the modern styles need.
  semantics: { kind: "boundedObject", max: 8_192 },
  webServiceURL: { kind: "httpsUrl" },
  associatedStoreIdentifiers: { kind: "storeIds" },
  authenticationToken: { kind: "string" },
};

const EVENT_TICKET_OPTION_RULES: Record<string, OptionRule> = {
  bagPolicyURL: { kind: "httpsUrl" },
  orderFoodURL: { kind: "httpsUrl" },
  parkingInformationURL: { kind: "httpsUrl" },
  directionsInformationURL: { kind: "httpsUrl" },
  purchaseParkingURL: { kind: "httpsUrl" },
  merchandiseURL: { kind: "httpsUrl" },
  transitInformationURL: { kind: "httpsUrl" },
  accessibilityURL: { kind: "httpsUrl" },
  addOnURL: { kind: "httpsUrl" },
  contactVenueEmail: { kind: "email" },
  contactVenuePhoneNumber: { kind: "phone" },
  contactVenueWebsite: { kind: "httpsUrl" },
  transferURL: { kind: "httpsUrl" },
  sellURL: { kind: "httpsUrl" },
  suppressHeaderDarkening: { kind: "boolean" },
  useAutomaticColors: { kind: "boolean" },
  auxiliaryStoreIdentifiers: { kind: "storeIds" },
  eventLogoText: { kind: "string", max: 200 },
};

const BOARDING_PASS_OPTION_RULES: Record<string, OptionRule> = {
  changeSeatURL: { kind: "httpsUrl" },
  entertainmentURL: { kind: "httpsUrl" },
  purchaseAdditionalBaggageURL: { kind: "httpsUrl" },
  purchaseLoungeAccessURL: { kind: "httpsUrl" },
  purchaseWifiURL: { kind: "httpsUrl" },
  upgradeURL: { kind: "httpsUrl" },
  managementURL: { kind: "httpsUrl" },
  registerServiceAnimalURL: { kind: "httpsUrl" },
  reportLostBagURL: { kind: "httpsUrl" },
  requestWheelchairURL: { kind: "httpsUrl" },
  transitProviderEmail: { kind: "email" },
  transitProviderPhoneNumber: { kind: "phone" },
  transitProviderWebsiteURL: { kind: "httpsUrl" },
};

const SCRIPT_SCHEMES = new Set(["javascript:", "data:", "vbscript:"]);

function optionRuleError(
  value: unknown,
  path: string,
  rule: OptionRule
): string | null {
  switch (rule.kind) {
    case "httpsUrl": {
      if (typeof value !== "string") return `${path} must be a string`;
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        return `${path} must be an absolute URL`;
      }
      if (parsed.protocol !== "https:") return `${path} must use https`;
      return null;
    }
    case "launchUrl": {
      if (typeof value !== "string") return `${path} must be a string`;
      let parsed: URL;
      try {
        parsed = new URL(value);
      } catch {
        return `${path} must be an absolute URL`;
      }
      if (SCRIPT_SCHEMES.has(parsed.protocol)) {
        return `${path} must not use a script scheme`;
      }
      return null;
    }
    case "email":
      if (
        typeof value !== "string" ||
        !value.includes("@") ||
        /\s/.test(value)
      ) {
        return `${path} must be an email address`;
      }
      return null;
    case "phone":
      if (typeof value !== "string" || !value.trim()) {
        return `${path} must be a non-empty string`;
      }
      return null;
    case "boolean":
      if (typeof value !== "boolean") return `${path} must be a boolean`;
      return null;
    case "string": {
      const max = rule.max ?? 2_000;
      if (typeof value !== "string" || value.length > max) {
        return `${path} must be a string of at most ${max} characters`;
      }
      return null;
    }
    case "storeIds":
      if (
        !Array.isArray(value) ||
        value.some((entry) => !Number.isInteger(entry) || entry <= 0)
      ) {
        return `${path} must be an array of positive integers`;
      }
      return null;
    case "positiveNumber":
      if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
        return `${path} must be a number greater than 0`;
      }
      return null;
    case "boundedObject":
      if (!isRecord(value)) return `${path} must be an object`;
      if (JSON.stringify(value).length > rule.max) {
        return `${path} must serialize to at most ${rule.max} characters`;
      }
      return null;
  }
}

function validateOptionObject(
  value: unknown,
  path: string,
  rules: Record<string, OptionRule>
): void {
  if (value === undefined) return;
  if (!isRecord(value)) throw new ApiError(400, `${path} must be an object`);
  for (const [key, entry] of Object.entries(value)) {
    if (entry === undefined) continue;
    const rule = rules[key];
    if (!rule) {
      throw new ApiError(400, `${path}.${key} is not a recognized key`);
    }
    const error = optionRuleError(entry, `${path}.${key}`, rule);
    if (error) throw new ApiError(400, error);
  }
}

export interface ValidatedSpec {
  spec: PassSpec;
  fields: Partial<Record<FieldCategory, PassField[]>>;
  images: Record<string, Buffer>;
}

export function validateSpec(body: unknown): ValidatedSpec {
  if (!isRecord(body)) throw new ApiError(400, "Request body must be a JSON object");
  const spec = body as unknown as PassSpec;
  if (!STYLES.includes(spec.style)) throw new ApiError(400, `style must be one of ${STYLES.join(", ")}`);
  if (typeof spec.description !== "string" || !spec.description.trim()) throw new ApiError(400, "description is required");
  if (spec.description.length > 200) throw new ApiError(400, "description must be 200 characters or fewer");
  if (spec.updatable !== undefined && typeof spec.updatable !== "boolean") throw new ApiError(400, "updatable must be a boolean");
  for (const key of ["serialNumber", "organizationName", "logoText"] as const) assertOptionalString(spec[key], key, 200);

  if (spec.colors !== undefined) {
    if (!isRecord(spec.colors)) throw new ApiError(400, "colors must be an object");
    for (const key of ["backgroundColor", "foregroundColor", "labelColor", "stripColor", "footerBackgroundColor"] as const) {
      const value = spec.colors[key];
      if (value !== undefined) {
        if (typeof value !== "string") throw new ApiError(400, `colors.${key} must be a string`);
        toRgbString(value);
      }
    }
  }

  validateCollections(spec);
  validateAdvanced(spec);
  validateOptionObject(spec.options, "options", PASS_OPTION_RULES);
  validateOptionObject(
    spec.eventTicketOptions,
    "eventTicketOptions",
    EVENT_TICKET_OPTION_RULES
  );
  validateOptionObject(
    spec.boardingPassOptions,
    "boardingPassOptions",
    BOARDING_PASS_OPTION_RULES
  );
  const fields = validateFields(spec.fields);
  if (fields.additionalInfo?.length && spec.style !== "eventTicket") {
    throw new ApiError(400, "additionalInfo fields require the eventTicket style");
  }
  const images = validateImages(spec.images);
  validateModernStyleRequirements(spec, images);
  if (
    spec.personalization &&
    !images["personalizationLogo@2x"] &&
    !images["personalizationLogo@3x"]
  ) {
    throw new ApiError(400, "personalization requires personalizationLogo artwork");
  }
  return { spec, fields, images };
}
