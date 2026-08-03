import type { PassStyle } from '@/types';

// Wallet artwork slots in points at 1x. The app exports 1x/2x/3x PNGs.
export interface ImageSlot {
  name: string;
  label: string;
  width: number;
  height: number;
  required: boolean;
  recommended: boolean;
  hint: string;
}

function standardSlots(style: PassStyle, posterEvent = false): ImageSlot[] {
  const stripHeight = style === 'eventTicket' ? 98 : 144;
  const hasStrip = style === 'storeCard' || style === 'coupon' || style === 'eventTicket';
  const posterEventSlots: ImageSlot[] = style === 'eventTicket' && posterEvent ? [
    {
      name: 'primaryLogo',
      label: 'Poster primary logo',
      width: 126,
      height: 30,
      required: false,
      recommended: true,
      hint: 'iOS 18+ poster-event identity · up to 126×30 pt',
    },
    {
      name: 'secondaryLogo',
      label: 'Poster secondary logo',
      width: 135,
      height: 12,
      required: false,
      recommended: false,
      hint: 'Ticket issuer or venue logo · up to 135×12 pt',
    },
    {
      name: 'artwork',
      label: 'Poster artwork',
      width: 358,
      height: 448,
      required: false,
      recommended: true,
      hint: 'Full-art iOS 18+ poster background · 358×448 pt',
    },
  ] : [];

  return [
    {
      name: 'icon',
      label: 'Icon',
      width: 29,
      height: 29,
      required: true,
      recommended: true,
      hint: 'Lock Screen and pass list icon · 29×29 pt',
    },
    {
      name: 'logo',
      label: 'Logo',
      width: 160,
      height: 50,
      required: false,
      recommended: true,
      hint: 'Top-left artwork · 160×50 pt',
    },
    ...posterEventSlots,
    {
      name: 'strip',
      label: 'Strip',
      width: 375,
      height: stripHeight,
      required: false,
      recommended: hasStrip,
      hint: `Wide artwork behind fields · 375×${stripHeight} pt`,
    },
    {
      name: 'thumbnail',
      label: 'Thumbnail',
      width: 90,
      height: 90,
      required: false,
      recommended: style === 'generic' || style === 'eventTicket',
      hint: 'Square artwork beside fields · 90×90 pt',
    },
    {
      name: 'background',
      label: 'Background',
      width: 180,
      height: 220,
      required: false,
      recommended: style === 'eventTicket',
      hint: 'Full-pass background artwork · 180×220 pt',
    },
    {
      name: 'footer',
      label: 'Footer',
      width: 286,
      height: 15,
      required: false,
      recommended: style === 'boardingPass',
      hint: 'Artwork above the barcode · 286×15 pt',
    },
  ];
}

export function slotsForStyle(style: PassStyle, posterEvent = false): ImageSlot[] {
  return standardSlots(style, posterEvent);
}

export function localizedSlotsForStyle(style: PassStyle, languages: string[], posterEvent = false): ImageSlot[] {
  return languages.flatMap((language) =>
    standardSlots(style, posterEvent).map((slot) => ({
      ...slot,
      name: `${language}.lproj/${slot.name}`,
      label: `${slot.label} · ${language}`,
      required: false,
      recommended: false,
      hint: `Localized ${slot.hint.toLowerCase()}`,
    }))
  );
}

export const PERSONALIZATION_LOGO_SLOT: ImageSlot = {
  name: 'personalizationLogo',
  label: 'Personalization logo',
  width: 150,
  height: 40,
  required: false,
  recommended: true,
  hint: 'Shown while Wallet collects personalization details · 150×40 pt',
};
