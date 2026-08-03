import type { PassStyle } from '@/types';

// Wallet artwork slots, in points at 1x. The app exports each at 1x/2x/3x.
export interface ImageSlot {
  name: 'icon' | 'logo' | 'strip' | 'thumbnail' | 'footer';
  width: number;
  height: number;
  required: boolean;
  hint: string;
}

const ICON: ImageSlot = {
  name: 'icon',
  width: 29,
  height: 29,
  required: true,
  hint: 'Square, 29×29 pt. Required — shown on the lock screen and in Mail.',
};

const LOGO: ImageSlot = {
  name: 'logo',
  width: 160,
  height: 50,
  required: false,
  hint: '160×50 pt, top-left corner of the pass.',
};

export function slotsForStyle(style: PassStyle): ImageSlot[] {
  switch (style) {
    case 'generic':
      return [
        ICON,
        LOGO,
        {
          name: 'thumbnail',
          width: 90,
          height: 90,
          required: false,
          hint: '90×90 pt, next to the primary field.',
        },
      ];
    case 'storeCard':
    case 'coupon':
      return [
        ICON,
        LOGO,
        {
          name: 'strip',
          width: 375,
          height: 144,
          required: false,
          hint: '375×144 pt banner behind the primary field.',
        },
      ];
    case 'eventTicket':
      return [
        ICON,
        LOGO,
        {
          name: 'strip',
          width: 375,
          height: 98,
          required: false,
          hint: '375×98 pt banner behind the primary field.',
        },
      ];
    case 'boardingPass':
      return [
        ICON,
        LOGO,
        {
          name: 'footer',
          width: 286,
          height: 15,
          required: false,
          hint: '286×15 pt, above the barcode.',
        },
      ];
  }
}
