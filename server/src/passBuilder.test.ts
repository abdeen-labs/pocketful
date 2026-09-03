import assert from "node:assert/strict";
import { test } from "node:test";
import type { Config } from "./config";
import { buildPassJson } from "./passBuilder";
import { validateSpec } from "./validate";

const PNG_HEADER = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const icon = () => PNG_HEADER.toString("base64");

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

test("emits one dictionary per style, each carrying only what its style owns", () => {
  const json = buildPassJson(
    validateSpec({
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

test("a boardingPass additional style without transitType defaults to generic transit", () => {
  const json = buildPassJson(
    validateSpec({
      style: "generic",
      description: "Shuttle",
      images: { icon: icon() },
      additionalStyles: [{ style: "boardingPass" }],
    }),
    config
  );
  assert.equal((json.boardingPass as Record<string, unknown>).transitType, "PKTransitTypeGeneric");
});

test("style-specific options apply when their style is only an additional style", () => {
  const json = buildPassJson(
    validateSpec({
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

test("style-specific options stay out of pass.json when no present style uses them", () => {
  const json = buildPassJson(
    validateSpec({
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

test("an updatable identity overrides the serial number and web service credentials", () => {
  const json = buildPassJson(
    validateSpec({
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
