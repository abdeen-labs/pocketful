// Pass spec accepted by the server. Mirrored in server/src/types.ts — keep in
// sync by hand, there is deliberately no shared package.

export type PassStyle =
  | 'generic'
  | 'storeCard'
  | 'coupon'
  | 'eventTicket'
  | 'boardingPass';

export type BarcodeFormat =
  | 'PKBarcodeFormatQR'
  | 'PKBarcodeFormatPDF417'
  | 'PKBarcodeFormatAztec'
  | 'PKBarcodeFormatCode128';

export type TransitType =
  | 'PKTransitTypeAir'
  | 'PKTransitTypeBoat'
  | 'PKTransitTypeBus'
  | 'PKTransitTypeTrain'
  | 'PKTransitTypeGeneric';

export type FieldCategory =
  | 'header'
  | 'primary'
  | 'secondary'
  | 'auxiliary'
  | 'back';

export interface PassField {
  key: string;
  label?: string;
  value: string;
}

export interface PassSpec {
  style: PassStyle;
  description: string;
  organizationName?: string;
  logoText?: string;
  colors?: {
    backgroundColor?: string;
    foregroundColor?: string;
    labelColor?: string;
  };
  fields?: Partial<Record<FieldCategory, PassField[]>>;
  barcode?: {
    format: BarcodeFormat;
    message: string;
    altText?: string;
  };
  transitType?: TransitType;
  /** image name (e.g. "icon", "icon@2x", "logo") -> base64-encoded PNG */
  images: Record<string, string>;
}
