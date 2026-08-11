// Pass spec sent by the app. Mirrored in app/src/types.ts — keep in sync by hand,
// there is deliberately no shared package (Railway builds server/ standalone).

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject {
  [key: string]: JsonValue;
}

export type PassStyle =
  | "generic"
  | "storeCard"
  | "coupon"
  | "eventTicket"
  | "boardingPass"
  // iOS 27+; earlier systems cannot install a pass whose only style key is
  // posterGeneric. This server deliberately emits no legacy fallback key.
  | "posterGeneric";

export type BarcodeFormat =
  | "PKBarcodeFormatQR"
  | "PKBarcodeFormatPDF417"
  | "PKBarcodeFormatAztec"
  | "PKBarcodeFormatCode128"
  // iOS 27+; earlier systems render no barcode unless a legacy format follows
  // in the barcodes array.
  | "PKBarcodeFormatEAN13"
  | "PKBarcodeFormatCode39"
  | "PKBarcodeFormatCodabar"
  | "PKBarcodeFormatI2of5";

export type TransitType =
  | "PKTransitTypeAir"
  | "PKTransitTypeBoat"
  | "PKTransitTypeBus"
  | "PKTransitTypeTrain"
  | "PKTransitTypeGeneric";

export type FieldCategory =
  | "header"
  | "primary"
  | "secondary"
  | "auxiliary"
  | "back"
  | "additionalInfo"
  /** posterGeneric only; Wallet renders a single footer field. */
  | "footer";

export type FieldValue = string | number;
export type TextAlignment =
  | "PKTextAlignmentLeft"
  | "PKTextAlignmentCenter"
  | "PKTextAlignmentRight"
  | "PKTextAlignmentNatural";
export type DateStyle =
  | "PKDateStyleNone"
  | "PKDateStyleShort"
  | "PKDateStyleMedium"
  | "PKDateStyleLong"
  | "PKDateStyleFull";
export type NumberStyle =
  | "PKNumberStyleDecimal"
  | "PKNumberStylePercent"
  | "PKNumberStyleScientific"
  | "PKNumberStyleSpellOut";
export type DataDetectorType =
  | "PKDataDetectorTypePhoneNumber"
  | "PKDataDetectorTypeLink"
  | "PKDataDetectorTypeAddress"
  | "PKDataDetectorTypeCalendarEvent";

export interface PassField {
  key: string;
  label?: string;
  value: FieldValue;
  attributedValue?: FieldValue;
  changeMessage?: string;
  dataDetectorTypes?: DataDetectorType[];
  textAlignment?: TextAlignment;
  semantics?: JsonObject;
  dateStyle?: DateStyle;
  ignoresTimeZone?: boolean;
  isRelative?: boolean;
  timeStyle?: DateStyle;
  currencyCode?: string;
  numberStyle?: NumberStyle;
  /** Only valid for event-ticket auxiliary fields. */
  row?: 0 | 1;
}

export interface BarcodeSpec {
  format: BarcodeFormat;
  message: string;
  altText?: string;
  messageEncoding?: string;
}

export interface LocationSpec {
  latitude: number;
  longitude: number;
  altitude?: number;
  relevantText?: string;
}

export interface BeaconSpec {
  proximityUUID: string;
  major?: number;
  minor?: number;
  relevantText?: string;
}

export type RelevantDateSpec =
  | { date: string }
  | { startDate: string; endDate: string };

export interface NFCSpec {
  message: string;
  encryptionPublicKey: string;
  requiresAuthentication?: boolean;
}

export type PersonalizationField =
  | "PKPassPersonalizationFieldName"
  | "PKPassPersonalizationFieldPostalCode"
  | "PKPassPersonalizationFieldEmailAddress"
  | "PKPassPersonalizationFieldPhoneNumber";

export interface PersonalizationSpec {
  description: string;
  requiredPersonalizationFields: PersonalizationField[];
  termsAndConditions?: string;
}

export interface LocalizationSpec {
  language: string;
  translations: Record<string, string>;
}

export type PreferredStyleScheme =
  | "posterEventTicket"
  | "eventTicket"
  | "boardingPass"
  | "semanticBoardingPass";

export interface PassOptions {
  appLaunchURL?: string;
  voided?: boolean;
  userInfo?: JsonObject;
  sharingProhibited?: boolean;
  groupingIdentifier?: string;
  suppressStripShine?: boolean;
  maxDistance?: number;
  semantics?: JsonObject;
  webServiceURL?: string;
  associatedStoreIdentifiers?: number[];
  authenticationToken?: string;
}

export interface EventTicketOptions {
  bagPolicyURL?: string;
  orderFoodURL?: string;
  parkingInformationURL?: string;
  directionsInformationURL?: string;
  purchaseParkingURL?: string;
  merchandiseURL?: string;
  transitInformationURL?: string;
  accessibilityURL?: string;
  addOnURL?: string;
  contactVenueEmail?: string;
  contactVenuePhoneNumber?: string;
  contactVenueWebsite?: string;
  transferURL?: string;
  sellURL?: string;
  suppressHeaderDarkening?: boolean;
  useAutomaticColors?: boolean;
  auxiliaryStoreIdentifiers?: number[];
  eventLogoText?: string;
}

/**
 * iOS 27 featured actions — up to two tappable actions rendered beneath the
 * pass. Valid on every layout except posterEventTicket and semanticBoardingPass.
 */
export type FeaturedActionType =
  | "viewSchedule"
  | "watchTrailer"
  | "listenToMusic"
  | "call"
  | "place"
  | "addToBalance"
  | "order"
  | "shop"
  | "membershipBenefits"
  | "bookAppointment"
  | "bookCar"
  | "bookFlight"
  | "bookStay"
  | "viewOffersRewards";

export interface FeaturedAction {
  identifier: string;
  type: FeaturedActionType;
  url: string;
}

export interface PosterGenericOptions {
  /** Removes the automatic darkening gradient behind the header. */
  suppressHeaderDarkening?: boolean;
}

export interface BoardingPassOptions {
  changeSeatURL?: string;
  entertainmentURL?: string;
  purchaseAdditionalBaggageURL?: string;
  purchaseLoungeAccessURL?: string;
  purchaseWifiURL?: string;
  upgradeURL?: string;
  managementURL?: string;
  registerServiceAnimalURL?: string;
  reportLostBagURL?: string;
  requestWheelchairURL?: string;
  transitProviderEmail?: string;
  transitProviderPhoneNumber?: string;
  transitProviderWebsiteURL?: string;
}

export interface PassSpec {
  style: PassStyle;
  description: string;
  /**
   * When true, the server keeps the spec, stamps webServiceURL and a
   * per-pass authenticationToken into the pass, and serves OTA updates
   * for it via the Apple Wallet web service protocol.
   */
  updatable?: boolean;
  serialNumber?: string;
  organizationName?: string;
  logoText?: string;
  colors?: {
    backgroundColor?: string;
    foregroundColor?: string;
    labelColor?: string;
    stripColor?: string;
    footerBackgroundColor?: string;
  };
  options?: PassOptions;
  eventTicketOptions?: EventTicketOptions;
  boardingPassOptions?: BoardingPassOptions;
  posterGenericOptions?: PosterGenericOptions;
  /** iOS 27+; at most two, ignored by older systems. */
  featuredActions?: FeaturedAction[];
  fields?: Partial<Record<FieldCategory, PassField[]>>;
  barcodes?: BarcodeSpec[];
  transitType?: TransitType;
  preferredStyleSchemes?: PreferredStyleScheme[];
  expirationDate?: string;
  /** Deprecated by Apple, retained because passkit-generator still exposes it. */
  relevantDate?: string;
  relevantDates?: RelevantDateSpec[];
  locations?: LocationSpec[];
  beacons?: BeaconSpec[];
  nfc?: NFCSpec;
  localizations?: LocalizationSpec[];
  personalization?: PersonalizationSpec;
  /** iOS 26 poster-event entries; validated by passkit-generator. */
  upcomingPassInformation?: JsonObject[];
  /** image path without .png -> base64 PNG. Paths may include an xx.lproj folder. */
  images: Record<string, string>;
}
