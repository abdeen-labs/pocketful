import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError, validateSpec } from "./validate";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const icon = () => PNG_HEADER.toString("base64");

function validSpec(): Record<string, unknown> {
  return {
    style: "generic",
    description: "Test pass",
    images: { icon: icon(), "icon@2x": icon() },
  };
}

function rejects(spec: unknown, status: number, messageFragment: string): void {
  try {
    validateSpec(spec);
    assert.fail(`expected validateSpec to throw for: ${messageFragment}`);
  } catch (err) {
    assert.ok(err instanceof ApiError, `expected ApiError, got ${String(err)}`);
    assert.equal(err.status, status);
    assert.match(err.message, new RegExp(messageFragment, "i"));
  }
}

// These specs are accepted today and are already installed on real devices.
// server/src/updatable.ts re-runs validateSpec on every stored spec when a
// device refreshes a pass, so a rule that rejects any of these would brick
// passes already in the field. Do not "fix" a failure here by changing the
// test — see plans/006.
const STYLES = ["generic", "storeCard", "coupon", "eventTicket", "boardingPass"] as const;
for (const style of STYLES) {
  test(`accepts a minimal ${style} spec`, () => {
    const result = validateSpec({ ...validSpec(), style });
    assert.equal(result.spec.style, style);
    assert.ok(result.images.icon instanceof Buffer);
  });
}

test("accepts the baseline valid spec and returns its parts", () => {
  const result = validateSpec(validSpec());
  assert.equal(result.spec.description, "Test pass");
  assert.deepEqual(result.fields, {});
  assert.deepEqual(Object.keys(result.images).sort(), ["icon", "icon@2x"]);
});

// All three colour forms are currently valid — the app's local colour regex
// rejects the rgb() form, so this pins the server as the wider contract.
const COLOR_FORMS = ["#abc", "#aabbcc", "rgb(1, 2, 3)"] as const;
for (const color of COLOR_FORMS) {
  test(`accepts backgroundColor in the ${color} form`, () => {
    validateSpec({ ...validSpec(), colors: { backgroundColor: color } });
  });
}

test("assigns default keys to fields that omit one", () => {
  const result = validateSpec({
    ...validSpec(),
    fields: { primary: [{ value: "hello" }] },
  });
  assert.equal(result.fields.primary?.[0].key, "primary-1");
});

interface Rejection {
  name: string;
  spec: unknown;
  status: number;
  fragment: string;
}

const field = (value: unknown) => ({ value });

const REJECTIONS: Rejection[] = [
  {
    name: "non-object body",
    spec: null,
    status: 400,
    fragment: "must be a JSON object",
  },
  {
    name: "array body",
    spec: [validSpec()],
    status: 400,
    fragment: "must be a JSON object",
  },
  {
    name: "unknown style",
    spec: { ...validSpec(), style: "membership" },
    status: 400,
    fragment: "style must be one of",
  },
  {
    name: "missing description",
    spec: { ...validSpec(), description: undefined },
    status: 400,
    fragment: "description is required",
  },
  {
    name: "blank description",
    spec: { ...validSpec(), description: "   " },
    status: 400,
    fragment: "description is required",
  },
  {
    name: "description over 200 characters",
    spec: { ...validSpec(), description: "x".repeat(201) },
    status: 400,
    fragment: "200 characters or fewer",
  },
  {
    name: "non-boolean updatable",
    spec: { ...validSpec(), updatable: "yes" },
    status: 400,
    fragment: "updatable must be a boolean",
  },
  {
    name: "serialNumber over 200 characters",
    spec: { ...validSpec(), serialNumber: "x".repeat(201) },
    status: 400,
    fragment: "at most 200 characters",
  },
  {
    name: "organizationName over 200 characters",
    spec: { ...validSpec(), organizationName: "x".repeat(201) },
    status: 400,
    fragment: "at most 200 characters",
  },
  {
    name: "logoText over 200 characters",
    spec: { ...validSpec(), logoText: "x".repeat(201) },
    status: 400,
    fragment: "at most 200 characters",
  },
  {
    name: "unknown field category",
    spec: { ...validSpec(), fields: { bonus: [field("x")] } },
    status: 400,
    fragment: "Unknown field category",
  },
  {
    name: "11 fields in a non-back category",
    spec: {
      ...validSpec(),
      fields: { primary: Array.from({ length: 11 }, (_, i) => field(`v${i}`)) },
    },
    status: 400,
    fragment: "at most 10 fields",
  },
  {
    name: "21 fields in back",
    spec: {
      ...validSpec(),
      fields: { back: Array.from({ length: 21 }, (_, i) => field(`v${i}`)) },
    },
    status: 400,
    fragment: "at most 20 fields",
  },
  {
    name: "field with an empty-string value",
    spec: { ...validSpec(), fields: { primary: [field("")] } },
    status: 400,
    fragment: "must be text or a finite number",
  },
  {
    name: "field with a non-finite number value",
    spec: { ...validSpec(), fields: { primary: [field(Infinity)] } },
    status: 400,
    fragment: "must be text or a finite number",
  },
  {
    name: "field label over 500 characters",
    spec: {
      ...validSpec(),
      fields: { primary: [{ value: "v", label: "x".repeat(501) }] },
    },
    status: 400,
    fragment: "at most 500 characters",
  },
  {
    name: "five barcodes",
    spec: {
      ...validSpec(),
      barcodes: Array.from({ length: 5 }, () => ({
        format: "PKBarcodeFormatQR",
        message: "m",
      })),
    },
    status: 400,
    fragment: "at most four",
  },
  {
    name: "unknown barcode format",
    spec: {
      ...validSpec(),
      barcodes: [{ format: "PKBarcodeFormatUPC", message: "m" }],
    },
    status: 400,
    fragment: "format is invalid",
  },
  {
    name: "barcode with an empty message",
    spec: {
      ...validSpec(),
      barcodes: [{ format: "PKBarcodeFormatQR", message: "" }],
    },
    status: 400,
    fragment: "message is required",
  },
  {
    name: "21 localizations",
    spec: {
      ...validSpec(),
      localizations: Array.from({ length: 21 }, (_, i) => ({
        language: `a${String.fromCharCode(97 + i)}`,
        translations: {},
      })),
    },
    status: 400,
    fragment: "at most twenty",
  },
  {
    name: "duplicate localization languages",
    spec: {
      ...validSpec(),
      localizations: [
        { language: "en", translations: { hello: "Hello" } },
        { language: "en", translations: { hello: "Howdy" } },
      ],
    },
    status: 400,
    fragment: "Duplicate localization language",
  },
  {
    name: "invalid language tag",
    spec: {
      ...validSpec(),
      localizations: [{ language: "not a language tag", translations: {} }],
    },
    status: 400,
    fragment: "language is invalid",
  },
  {
    name: "nfc missing encryptionPublicKey",
    spec: { ...validSpec(), nfc: { message: "m" } },
    status: 400,
    fragment: "nfc requires message and encryptionPublicKey",
  },
  {
    name: "personalization without nfc",
    spec: {
      ...validSpec(),
      personalization: {
        description: "Join our program",
        requiredPersonalizationFields: ["PKPassPersonalizationFieldName"],
      },
    },
    status: 400,
    fragment: "requires NFC",
  },
  {
    name: "personalization without personalizationLogo artwork",
    spec: {
      ...validSpec(),
      nfc: { message: "m", encryptionPublicKey: "key" },
      personalization: {
        description: "Join our program",
        requiredPersonalizationFields: ["PKPassPersonalizationFieldName"],
      },
    },
    status: 400,
    fragment: "requires personalizationLogo artwork",
  },
  {
    name: "upcomingPassInformation without the poster event-ticket style",
    spec: { ...validSpec(), upcomingPassInformation: [{}] },
    status: 400,
    fragment: "requires the poster event-ticket style",
  },
  {
    name: "additionalInfo fields on a non-eventTicket style",
    spec: { ...validSpec(), fields: { additionalInfo: [field("x")] } },
    status: 400,
    fragment: "additionalInfo fields require the eventTicket style",
  },
  {
    name: "image whose bytes are not PNG",
    spec: {
      ...validSpec(),
      images: { icon: Buffer.from("not a png at all").toString("base64") },
    },
    status: 400,
    fragment: "is not a PNG",
  },
  {
    name: "image name outside the allowlist",
    spec: { ...validSpec(), images: { icon: icon(), banner: icon() } },
    status: 400,
    fragment: "Unknown image path",
  },
  {
    name: "images without any icon rendition",
    spec: { ...validSpec(), images: { logo: icon() } },
    status: 400,
    fragment: "must include \"icon\"",
  },
];

for (const { name, spec, status, fragment } of REJECTIONS) {
  test(`rejects ${name}`, () => {
    rejects(spec, status, fragment);
  });
}

// Verified on-device (iOS 27, Console.app `passd`): Wallet refuses the poster
// scheme without an entry credential — "Pass does not contain VAS or Barcode
// information." — and silently renders the legacy layout instead.
function posterSpec(): Record<string, unknown> {
  return {
    ...validSpec(),
    style: "eventTicket",
    preferredStyleSchemes: ["posterEventTicket", "eventTicket"],
    images: { icon: icon(), artwork: icon() },
    barcodes: [{ format: "PKBarcodeFormatQR", message: "SEAT-104-B-12" }],
    options: {
      semantics: {
        eventType: "PKEventTypeLivePerformance",
        performerNames: ["Nova Vale"],
        eventName: "Midnight Live",
        venueName: "The Grand Hall",
        venueRegionName: "New York",
        venueRoom: "Main Arena",
      },
    },
  };
}

test("accepts a poster event ticket with a barcode entry credential", () => {
  const result = validateSpec(posterSpec());
  assert.ok(result.images.artwork instanceof Buffer);
});

test("rejects a poster event ticket with neither barcode nor NFC", () => {
  const spec = posterSpec();
  delete spec.barcodes;
  rejects(spec, 400, "requires a barcode or NFC");
});

// Plan 006: the option objects are validated against allowlists built from
// types.ts. The maximal fixtures below populate every allowlisted key —
// they are supersets of everything app/src/app/index.tsx and all templates
// in app/src/lib/templates.ts can produce, so these passing proves the
// allowlists cannot reject a payload the app sends today.

const MAXIMAL_PASS_OPTIONS = {
  appLaunchURL: "pocketful://open/pass",
  voided: true,
  userInfo: { orderId: "A-1042", tier: "gold" },
  sharingProhibited: true,
  groupingIdentifier: "group-1",
  suppressStripShine: true,
  maxDistance: 500,
  semantics: { eventName: "Test Event", venueName: "Test Hall" },
  webServiceURL: "https://passes.example.test",
  associatedStoreIdentifiers: [123456789],
  authenticationToken: "0123456789abcdef",
};

const MAXIMAL_EVENT_OPTIONS = {
  bagPolicyURL: "https://example.test/bags",
  orderFoodURL: "https://example.test/food",
  parkingInformationURL: "https://example.test/parking",
  directionsInformationURL: "https://maps.apple.com/?q=Test+Hall",
  purchaseParkingURL: "https://example.test/parking/buy",
  merchandiseURL: "https://example.test/merch",
  transitInformationURL: "https://example.test/transit",
  accessibilityURL: "https://example.test/accessibility",
  addOnURL: "https://example.test/addons",
  contactVenueEmail: "venue@example.test",
  contactVenuePhoneNumber: "+1 212 555 0144",
  contactVenueWebsite: "https://example.test",
  transferURL: "https://example.test/transfer",
  sellURL: "https://example.test/sell",
  suppressHeaderDarkening: true,
  useAutomaticColors: true,
  auxiliaryStoreIdentifiers: [987654321],
  eventLogoText: "TEST EVENT",
};

const MAXIMAL_BOARDING_OPTIONS = {
  changeSeatURL: "https://example.test/seat",
  entertainmentURL: "https://example.test/entertainment",
  purchaseAdditionalBaggageURL: "https://example.test/bags",
  purchaseLoungeAccessURL: "https://example.test/lounge",
  purchaseWifiURL: "https://example.test/wifi",
  upgradeURL: "https://example.test/upgrade",
  managementURL: "https://example.test/manage",
  registerServiceAnimalURL: "https://example.test/service-animal",
  reportLostBagURL: "https://example.test/lost-bag",
  requestWheelchairURL: "https://example.test/wheelchair",
  transitProviderEmail: "support@example.test",
  transitProviderPhoneNumber: "+1 800 555 0208",
  transitProviderWebsiteURL: "https://example.test",
};

test("accepts every allowlisted options key at once", () => {
  validateSpec({ ...validSpec(), options: MAXIMAL_PASS_OPTIONS });
});

test("accepts every allowlisted eventTicketOptions key at once", () => {
  validateSpec({
    ...validSpec(),
    style: "eventTicket",
    eventTicketOptions: MAXIMAL_EVENT_OPTIONS,
  });
});

test("accepts every allowlisted boardingPassOptions key at once", () => {
  validateSpec({
    ...validSpec(),
    style: "boardingPass",
    boardingPassOptions: MAXIMAL_BOARDING_OPTIONS,
  });
});

const OPTION_REJECTIONS: { name: string; spec: unknown; fragment: string }[] = [
  {
    name: "an unrecognized options key",
    spec: { ...validSpec(), options: { frobnicate: true } },
    fragment: "options.frobnicate is not a recognized key",
  },
  {
    name: "an http URL where https is required",
    spec: { ...validSpec(), options: { webServiceURL: "http://example.test" } },
    fragment: "options.webServiceURL must use https",
  },
  {
    name: "a javascript appLaunchURL",
    spec: { ...validSpec(), options: { appLaunchURL: "javascript:alert(1)" } },
    fragment: "options.appLaunchURL must not use a script scheme",
  },
  {
    name: "a relative event URL",
    spec: {
      ...validSpec(),
      style: "eventTicket",
      eventTicketOptions: { merchandiseURL: "/merch" },
    },
    fragment: "eventTicketOptions.merchandiseURL must be an absolute URL",
  },
  {
    name: "a negative maxDistance",
    spec: { ...validSpec(), options: { maxDistance: -5 } },
    fragment: "options.maxDistance must be a number greater than 0",
  },
  {
    name: "a non-array associatedStoreIdentifiers",
    spec: { ...validSpec(), options: { associatedStoreIdentifiers: "123" } },
    fragment: "options.associatedStoreIdentifiers must be an array of positive integers",
  },
  {
    name: "an oversized userInfo",
    spec: { ...validSpec(), options: { userInfo: { blob: "x".repeat(5_000) } } },
    fragment: "options.userInfo must serialize to at most 4096 characters",
  },
  {
    name: "a non-boolean voided",
    spec: { ...validSpec(), options: { voided: "yes" } },
    fragment: "options.voided must be a boolean",
  },
  {
    name: "a whitespace-carrying venue email",
    spec: {
      ...validSpec(),
      style: "eventTicket",
      eventTicketOptions: { contactVenueEmail: "not an email" },
    },
    fragment: "eventTicketOptions.contactVenueEmail must be an email address",
  },
];

for (const { name, spec, fragment } of OPTION_REJECTIONS) {
  test(`rejects ${name}`, () => {
    rejects(spec, 400, fragment);
  });
}
