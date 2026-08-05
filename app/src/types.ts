// Pass spec accepted by the server. Mirrored in server/src/types.ts — keep in
// sync by hand, there is deliberately no shared package.

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonValue[];
export interface JsonObject { [key: string]: JsonValue }

export type PassStyle = 'generic' | 'storeCard' | 'coupon' | 'eventTicket' | 'boardingPass';
export type BarcodeFormat = 'PKBarcodeFormatQR' | 'PKBarcodeFormatPDF417' | 'PKBarcodeFormatAztec' | 'PKBarcodeFormatCode128' | 'PKBarcodeFormatEAN13' | 'PKBarcodeFormatCode39' | 'PKBarcodeFormatCodabar' | 'PKBarcodeFormatI2of5';
export type TransitType = 'PKTransitTypeAir' | 'PKTransitTypeBoat' | 'PKTransitTypeBus' | 'PKTransitTypeTrain' | 'PKTransitTypeGeneric';
export type FieldCategory = 'header' | 'primary' | 'secondary' | 'auxiliary' | 'back' | 'additionalInfo';
export type FieldValue = string | number;
export type TextAlignment = 'PKTextAlignmentLeft' | 'PKTextAlignmentCenter' | 'PKTextAlignmentRight' | 'PKTextAlignmentNatural';
export type DateStyle = 'PKDateStyleNone' | 'PKDateStyleShort' | 'PKDateStyleMedium' | 'PKDateStyleLong' | 'PKDateStyleFull';
export type NumberStyle = 'PKNumberStyleDecimal' | 'PKNumberStylePercent' | 'PKNumberStyleScientific' | 'PKNumberStyleSpellOut';
export type DataDetectorType = 'PKDataDetectorTypePhoneNumber' | 'PKDataDetectorTypeLink' | 'PKDataDetectorTypeAddress' | 'PKDataDetectorTypeCalendarEvent';

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
  row?: 0 | 1;
}

export interface BarcodeSpec { format: BarcodeFormat; message: string; altText?: string; messageEncoding?: string }
export interface LocationSpec { latitude: number; longitude: number; altitude?: number; relevantText?: string }
export interface BeaconSpec { proximityUUID: string; major?: number; minor?: number; relevantText?: string }
export type RelevantDateSpec = { date: string } | { startDate: string; endDate: string };
export interface NFCSpec { message: string; encryptionPublicKey: string; requiresAuthentication?: boolean }

export type PersonalizationField = 'PKPassPersonalizationFieldName' | 'PKPassPersonalizationFieldPostalCode' | 'PKPassPersonalizationFieldEmailAddress' | 'PKPassPersonalizationFieldPhoneNumber';
export interface PersonalizationSpec { description: string; requiredPersonalizationFields: PersonalizationField[]; termsAndConditions?: string }
export interface LocalizationSpec { language: string; translations: Record<string, string> }
export type PreferredStyleScheme = 'posterEventTicket' | 'eventTicket' | 'boardingPass' | 'semanticBoardingPass';

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
  colors?: { backgroundColor?: string; foregroundColor?: string; labelColor?: string; stripColor?: string; footerBackgroundColor?: string };
  options?: PassOptions;
  eventTicketOptions?: EventTicketOptions;
  boardingPassOptions?: BoardingPassOptions;
  fields?: Partial<Record<FieldCategory, PassField[]>>;
  barcodes?: BarcodeSpec[];
  transitType?: TransitType;
  preferredStyleSchemes?: PreferredStyleScheme[];
  expirationDate?: string;
  relevantDate?: string;
  relevantDates?: RelevantDateSpec[];
  locations?: LocationSpec[];
  beacons?: BeaconSpec[];
  nfc?: NFCSpec;
  localizations?: LocalizationSpec[];
  personalization?: PersonalizationSpec;
  upcomingPassInformation?: JsonObject[];
  images: Record<string, string>;
}
