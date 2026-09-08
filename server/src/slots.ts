import type { PassStyle } from "./types";

// Wallet artwork slots in points at 1x. The pkpass carries a PNG at 1x, 2x
// and 3x of each slot's point size.

export const SLOT_NAMES = [
  "icon",
  "logo",
  "primaryLogo",
  "secondaryLogo",
  "artwork",
  "strip",
  "thumbnail",
  "background",
  "footer",
  "personalizationLogo",
] as const;

export type SlotName = (typeof SLOT_NAMES)[number];

export interface SlotSize {
  width: number;
  height: number;
}

export const SCALES = [1, 2, 3] as const;

const SLOTS: Record<SlotName, SlotSize & { note: string }> = {
  icon: { width: 29, height: 29, note: "required; Lock Screen and pass list icon" },
  logo: { width: 160, height: 50, note: "top-left artwork on every style" },
  primaryLogo: { width: 126, height: 30, note: "poster identity on posterGeneric and posterEventTicket" },
  secondaryLogo: { width: 135, height: 12, note: "issuer or venue logo on posterEventTicket" },
  artwork: { width: 358, height: 448, note: "full-art face, required by posterEventTicket" },
  strip: { width: 375, height: 144, note: "behind the fields on storeCard, coupon and eventTicket; 375×98 when the style is eventTicket" },
  thumbnail: { width: 90, height: 90, note: "beside the fields on generic and eventTicket" },
  background: { width: 180, height: 220, note: "full-pass background on eventTicket; full-bleed face on posterGeneric, required there" },
  footer: { width: 286, height: 15, note: "above the barcode on boardingPass" },
  personalizationLogo: { width: 150, height: 40, note: "shown while Wallet collects personalization details" },
};

export function isSlotName(name: string): name is SlotName {
  return (SLOT_NAMES as readonly string[]).includes(name);
}

/** The strip sits behind the fields, so its height follows the style's field layout. */
export function slotSize(name: SlotName, style: PassStyle): SlotSize {
  if (name === "strip" && style === "eventTicket") return { width: 375, height: 98 };
  const { width, height } = SLOTS[name];
  return { width, height };
}

/** One entry per slot with its 1x point size, for agent-facing documentation. */
export function slotGuide(): string {
  return SLOT_NAMES.map((name) => {
    const { width, height, note } = SLOTS[name];
    return `${name} ${width}×${height} (${note})`;
  }).join("; ");
}
