import assert from "node:assert/strict";
import { test } from "node:test";
import sharp from "sharp";
import type { Config } from "./config";
import { buildPassFiles, buildPassJson } from "./passBuilder";
import { validateSpec } from "./validate";

const PNG_1X1 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
const icon = () => PNG_1X1;

const config = {
  passTypeIdentifier: "pass.test.pocketful",
  teamIdentifier: "TESTTEAM01",
  organizationName: "Pocketful",
} as Config;

function styleKeys(json: Record<string, unknown>): string[] {
  return ["generic", "storeCard", "coupon", "eventTicket", "boardingPass", "posterGeneric"].filter(
    (key) => key in json
  );
}

test("emits one dictionary per style, each carrying only what its style owns", async () => {
  const json = buildPassJson(
    await validateSpec({
      style: "posterGeneric",
      description: "Membership",
      images: { icon: icon(), background: icon() },
      fields: {
        primary: [{ key: "name", value: "Jane" }],
        footer: [{ key: "tier", value: "Gold" }],
      },
      additionalStyles: [
        {
          style: "storeCard",
          fields: {
            primary: [{ key: "name", value: "Jane" }],
            back: [{ key: "terms", value: "Members only" }],
          },
        },
        {
          style: "boardingPass",
          transitType: "PKTransitTypeTrain",
          fields: { header: [{ key: "gate", value: "4" }] },
        },
      ],
    }),
    config
  );

  assert.deepEqual(styleKeys(json), ["storeCard", "boardingPass", "posterGeneric"]);
  assert.deepEqual(json.posterGeneric, {
    headerFields: [],
    primaryFields: [{ key: "name", value: "Jane" }],
    secondaryFields: [],
    auxiliaryFields: [],
    backFields: [],
    footerFields: [{ key: "tier", value: "Gold" }],
  });
  assert.deepEqual(json.storeCard, {
    headerFields: [],
    primaryFields: [{ key: "name", value: "Jane" }],
    secondaryFields: [],
    auxiliaryFields: [],
    backFields: [{ key: "terms", value: "Members only" }],
  });
  assert.deepEqual(json.boardingPass, {
    headerFields: [{ key: "gate", value: "4" }],
    primaryFields: [],
    secondaryFields: [],
    auxiliaryFields: [],
    backFields: [],
    transitType: "PKTransitTypeTrain",
  });
});

test("a boardingPass additional style without transitType defaults to generic transit", async () => {
  const json = buildPassJson(
    await validateSpec({
      style: "generic",
      description: "Shuttle",
      images: { icon: icon() },
      additionalStyles: [{ style: "boardingPass" }],
    }),
    config
  );
  assert.equal((json.boardingPass as Record<string, unknown>).transitType, "PKTransitTypeGeneric");
});

test("style-specific options apply when their style is only an additional style", async () => {
  const json = buildPassJson(
    await validateSpec({
      style: "generic",
      description: "Show",
      images: { icon: icon() },
      eventTicketOptions: { merchandiseURL: "https://tickets.example/merch" },
      additionalStyles: [{ style: "eventTicket", fields: { additionalInfo: [{ value: "Doors 7pm" }] } }],
    }),
    config
  );
  assert.equal(json.merchandiseURL, "https://tickets.example/merch");
  assert.deepEqual((json.eventTicket as Record<string, unknown>).additionalInfoFields, [
    { key: "additionalInfo-1", value: "Doors 7pm" },
  ]);
});

test("style-specific options stay out of pass.json when no present style uses them", async () => {
  const json = buildPassJson(
    await validateSpec({
      style: "generic",
      description: "Card",
      images: { icon: icon() },
      eventTicketOptions: { merchandiseURL: "https://tickets.example/merch" },
    }),
    config
  );
  assert.equal("merchandiseURL" in json, false);
  assert.deepEqual(styleKeys(json), ["generic"]);
});

test("an updatable identity overrides the serial number and web service credentials", async () => {
  const json = buildPassJson(
    await validateSpec({
      style: "coupon",
      description: "Deal",
      serialNumber: "from-spec",
      images: { icon: icon() },
    }),
    config,
    {
      serialNumber: "server-serial",
      webServiceURL: "https://pass.example/v1",
      authenticationToken: "0123456789abcdef",
    }
  );
  assert.equal(json.serialNumber, "server-serial");
  assert.equal(json.webServiceURL, "https://pass.example/v1");
  assert.equal(json.authenticationToken, "0123456789abcdef");
});

test("the bundle carries 1x/2x/3x PNGs of every slot, localized paths included", async () => {
  const files = await buildPassFiles(
    await validateSpec({
      style: "eventTicket",
      description: "Show",
      images: { icon: icon(), strip: icon(), "de.lproj/logo": icon() },
    }),
    config
  );
  assert.deepEqual(Object.keys(files).sort(), [
    "de.lproj/logo.png",
    "de.lproj/logo@2x.png",
    "de.lproj/logo@3x.png",
    "icon.png",
    "icon@2x.png",
    "icon@3x.png",
    "pass.json",
    "strip.png",
    "strip@2x.png",
    "strip@3x.png",
  ]);
  const size = async (name: string) => {
    const meta = await sharp(files[name]).metadata();
    return [meta.width, meta.height, meta.format];
  };
  assert.deepEqual(await size("icon.png"), [29, 29, "png"]);
  assert.deepEqual(await size("icon@3x.png"), [87, 87, "png"]);
  assert.deepEqual(await size("strip.png"), [375, 98, "png"]);
  assert.deepEqual(await size("de.lproj/logo@2x.png"), [320, 100, "png"]);
});

test("personalization.json rides along with the personalization logo", async () => {
  const files = await buildPassFiles(
    await validateSpec({
      style: "storeCard",
      description: "Club",
      images: { icon: icon(), personalizationLogo: icon() },
      nfc: { message: "m", encryptionPublicKey: "key" },
      personalization: {
        description: "Join the club",
        requiredPersonalizationFields: ["PKPassPersonalizationFieldName"],
      },
    }),
    config
  );
  assert.ok(files["personalization.json"]);
  assert.ok(files["personalizationLogo@3x.png"]);
});
