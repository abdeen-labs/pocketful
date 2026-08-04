import React, { useMemo, useState } from 'react';
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BarcodesEditor,
  BeaconsEditor,
  LocalizationsEditor,
  LocationsEditor,
  RelevantDatesEditor,
  newBarcode,
  type EditableBarcode,
  type EditableBeacon,
  type EditableLocalization,
  type EditableLocation,
  type EditableRelevantDate,
} from '@/components/CollectionEditors';
import { FieldsEditor, type EditableField } from '@/components/FieldsEditor';
import { ImagesSection } from '@/components/ImagesSection';
import { PassPreview } from '@/components/PassPreview';
import { TemplateGallery } from '@/components/TemplateGallery';
import {
  Badge,
  Button,
  ChipRow,
  Disclosure,
  Input,
  MultiChipRow,
  Notice,
  Section,
  ToggleRow,
} from '@/components/ui';
import { createPass } from '@/lib/api';
import { pickImageForSlot, type ProcessedImage } from '@/lib/images';
import { loadBundledTemplateImages } from '@/lib/templateArtwork';
import { buildTemplateBarcodes, buildTemplateFields, buildTemplateRelevantDates, type PassTemplate } from '@/lib/templates';
import { presentWalletPass } from '@/lib/walletPass';
import {
  localizedSlotsForStyle,
  PERSONALIZATION_LOGO_SLOT,
  slotsForStyle,
  type ImageSlot,
} from '@/lib/slots';
import { colors, fonts, radii, tracking } from '@/theme';
import type {
  BoardingPassOptions,
  EventTicketOptions,
  FieldCategory,
  JsonObject,
  PassField,
  PassOptions,
  PassSpec,
  PassStyle,
  PersonalizationField,
  PreferredStyleScheme,
  TransitType,
} from '@/types';

type EditorTab = 'design' | 'content' | 'smart' | 'advanced';

const TAB_OPTIONS: { value: EditorTab; label: string }[] = [
  { value: 'design', label: 'Design' },
  { value: 'content', label: 'Content' },
  { value: 'smart', label: 'Smart' },
  { value: 'advanced', label: 'Advanced' },
];
const STYLE_OPTIONS: { value: PassStyle; label: string }[] = [
  { value: 'generic', label: 'Generic' },
  { value: 'storeCard', label: 'Store card' },
  { value: 'coupon', label: 'Coupon' },
  { value: 'eventTicket', label: 'Event ticket' },
  { value: 'boardingPass', label: 'Boarding pass' },
];
const TRANSIT_OPTIONS: { value: TransitType; label: string }[] = [
  { value: 'PKTransitTypeGeneric', label: 'Generic' },
  { value: 'PKTransitTypeAir', label: 'Air' },
  { value: 'PKTransitTypeTrain', label: 'Train' },
  { value: 'PKTransitTypeBus', label: 'Bus' },
  { value: 'PKTransitTypeBoat', label: 'Boat' },
];
const PERSONALIZATION_OPTIONS: { value: PersonalizationField; label: string }[] = [
  { value: 'PKPassPersonalizationFieldName', label: 'Name' },
  { value: 'PKPassPersonalizationFieldPostalCode', label: 'Postal code' },
  { value: 'PKPassPersonalizationFieldEmailAddress', label: 'Email' },
  { value: 'PKPassPersonalizationFieldPhoneNumber', label: 'Phone' },
];
const EVENT_SCHEMES: { value: PreferredStyleScheme; label: string }[] = [
  { value: 'eventTicket', label: 'Classic event' },
  { value: 'posterEventTicket', label: 'Poster event' },
];
const BOARDING_SCHEMES: { value: PreferredStyleScheme; label: string }[] = [
  { value: 'boardingPass', label: 'Classic boarding' },
  { value: 'semanticBoardingPass', label: 'Enhanced boarding' },
];

const EVENT_OPTION_FIELDS: { key: keyof EventTicketOptions; label: string; placeholder: string; keyboard?: 'url' | 'email-address' | 'phone-pad' }[] = [
  { key: 'bagPolicyURL', label: 'Bag policy URL', placeholder: 'https://venue.example/bags', keyboard: 'url' },
  { key: 'orderFoodURL', label: 'Order food URL', placeholder: 'https://venue.example/food', keyboard: 'url' },
  { key: 'parkingInformationURL', label: 'Parking information URL', placeholder: 'https://venue.example/parking', keyboard: 'url' },
  { key: 'directionsInformationURL', label: 'Directions URL', placeholder: 'https://venue.example/directions', keyboard: 'url' },
  { key: 'purchaseParkingURL', label: 'Purchase parking URL', placeholder: 'https://venue.example/buy-parking', keyboard: 'url' },
  { key: 'merchandiseURL', label: 'Merchandise URL', placeholder: 'https://venue.example/merch', keyboard: 'url' },
  { key: 'transitInformationURL', label: 'Transit information URL', placeholder: 'https://venue.example/transit', keyboard: 'url' },
  { key: 'accessibilityURL', label: 'Accessibility URL', placeholder: 'https://venue.example/accessibility', keyboard: 'url' },
  { key: 'addOnURL', label: 'Add-ons URL', placeholder: 'https://venue.example/add-ons', keyboard: 'url' },
  { key: 'contactVenueEmail', label: 'Venue email', placeholder: 'hello@venue.example', keyboard: 'email-address' },
  { key: 'contactVenuePhoneNumber', label: 'Venue phone', placeholder: '+1 212 555 0100', keyboard: 'phone-pad' },
  { key: 'contactVenueWebsite', label: 'Venue website', placeholder: 'https://venue.example', keyboard: 'url' },
  { key: 'transferURL', label: 'Transfer ticket URL', placeholder: 'https://tickets.example/transfer', keyboard: 'url' },
  { key: 'sellURL', label: 'Sell ticket URL', placeholder: 'https://tickets.example/sell', keyboard: 'url' },
];

const BOARDING_OPTION_FIELDS: { key: keyof BoardingPassOptions; label: string; placeholder: string; keyboard?: 'url' | 'email-address' | 'phone-pad' }[] = [
  { key: 'changeSeatURL', label: 'Change seat URL', placeholder: 'https://airline.example/seats', keyboard: 'url' },
  { key: 'entertainmentURL', label: 'Entertainment URL', placeholder: 'https://airline.example/entertainment', keyboard: 'url' },
  { key: 'purchaseAdditionalBaggageURL', label: 'Additional baggage URL', placeholder: 'https://airline.example/bags', keyboard: 'url' },
  { key: 'purchaseLoungeAccessURL', label: 'Lounge access URL', placeholder: 'https://airline.example/lounge', keyboard: 'url' },
  { key: 'purchaseWifiURL', label: 'Wi-Fi purchase URL', placeholder: 'https://airline.example/wifi', keyboard: 'url' },
  { key: 'upgradeURL', label: 'Upgrade URL', placeholder: 'https://airline.example/upgrade', keyboard: 'url' },
  { key: 'managementURL', label: 'Manage trip URL', placeholder: 'https://airline.example/manage', keyboard: 'url' },
  { key: 'registerServiceAnimalURL', label: 'Service animal URL', placeholder: 'https://airline.example/service-animal', keyboard: 'url' },
  { key: 'reportLostBagURL', label: 'Lost bag URL', placeholder: 'https://airline.example/lost-bag', keyboard: 'url' },
  { key: 'requestWheelchairURL', label: 'Wheelchair request URL', placeholder: 'https://airline.example/accessibility', keyboard: 'url' },
  { key: 'transitProviderEmail', label: 'Provider email', placeholder: 'support@airline.example', keyboard: 'email-address' },
  { key: 'transitProviderPhoneNumber', label: 'Provider phone', placeholder: '+1 800 555 0100', keyboard: 'phone-pad' },
  { key: 'transitProviderWebsiteURL', label: 'Provider website', placeholder: 'https://airline.example', keyboard: 'url' },
];

const COMMON_SEMANTICS: Record<PassStyle, { key: string; label: string; placeholder: string }[]> = {
  generic: [
    { key: 'membershipProgramName', label: 'Membership program', placeholder: 'Pocketful Plus' },
    { key: 'membershipProgramNumber', label: 'Membership number', placeholder: 'PFL-2048' },
  ],
  storeCard: [
    { key: 'membershipProgramName', label: 'Loyalty program', placeholder: 'Pocketful Rewards' },
    { key: 'membershipProgramNumber', label: 'Member number', placeholder: '104820' },
  ],
  coupon: [
    { key: 'confirmationNumber', label: 'Confirmation number', placeholder: 'SAVE-2026' },
    { key: 'additionalTicketAttributes', label: 'Offer details', placeholder: 'Single use' },
  ],
  eventTicket: [
    { key: 'eventName', label: 'Event name', placeholder: 'Pocketful Live' },
    { key: 'venueName', label: 'Venue name', placeholder: 'The Grand Hall' },
    { key: 'eventStartDate', label: 'Event start date', placeholder: '2026-09-01T19:30:00-04:00' },
    { key: 'eventEndDate', label: 'Event end date', placeholder: '2026-09-01T22:30:00-04:00' },
    { key: 'venueEntrance', label: 'Entrance', placeholder: 'North Gate' },
    { key: 'attendeeName', label: 'Attendee name', placeholder: 'Jane Appleseed' },
  ],
  boardingPass: [
    { key: 'airlineCode', label: 'Airline code', placeholder: 'PF' },
    { key: 'flightCode', label: 'Flight code', placeholder: 'PF2048' },
    { key: 'departureAirportCode', label: 'Departure airport', placeholder: 'JFK' },
    { key: 'destinationAirportCode', label: 'Destination airport', placeholder: 'LHR' },
    { key: 'departureGate', label: 'Departure gate', placeholder: '12A' },
    { key: 'boardingGroup', label: 'Boarding group', placeholder: '2' },
    { key: 'confirmationNumber', label: 'Confirmation number', placeholder: 'ABC123' },
    { key: 'transitStatus', label: 'Transit status', placeholder: 'On Time' },
  ],
};

const HEX_COLOR = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;
const LANGUAGE = /^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$/;

export default function PassDesigner() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<EditorTab>('design');
  const [templatesCollapsed, setTemplatesCollapsed] = useState(false);
  const [lastAppliedTemplateId, setLastAppliedTemplateId] = useState<string | null>(null);
  const [style, setStyle] = useState<PassStyle>('storeCard');
  const [description, setDescription] = useState('');
  const [organizationName, setOrganizationName] = useState('');
  const [logoText, setLogoText] = useState('');
  const [serialNumber, setSerialNumber] = useState('');

  const [bgColor, setBgColor] = useState('#131822');
  const [fgColor, setFgColor] = useState('#ffffff');
  const [labelColor, setLabelColor] = useState('#a9b2c0');
  const [stripColor, setStripColor] = useState('');
  const [footerColor, setFooterColor] = useState('');
  const [fields, setFields] = useState<EditableField[]>([]);
  const [barcodes, setBarcodes] = useState<EditableBarcode[]>([newBarcode()]);
  const [transitType, setTransitType] = useState<TransitType>('PKTransitTypeGeneric');
  const [preferredStyleSchemes, setPreferredStyleSchemes] = useState<PreferredStyleScheme[]>([]);

  const [images, setImages] = useState<Partial<Record<string, ProcessedImage>>>({});
  const [busySlot, setBusySlot] = useState<string | null>(null);
  const [locations, setLocations] = useState<EditableLocation[]>([]);
  const [beacons, setBeacons] = useState<EditableBeacon[]>([]);
  const [relevantDates, setRelevantDates] = useState<EditableRelevantDate[]>([]);
  const [localizations, setLocalizations] = useState<EditableLocalization[]>([]);

  const [expirationDate, setExpirationDate] = useState('');
  const [legacyRelevantDate, setLegacyRelevantDate] = useState('');
  const [semanticValues, setSemanticValues] = useState<Record<string, string>>({});
  const [semanticsJson, setSemanticsJson] = useState('');
  const [userInfoJson, setUserInfoJson] = useState('');
  const [upcomingPassJson, setUpcomingPassJson] = useState('');

  const [appLaunchURL, setAppLaunchURL] = useState('');
  const [voided, setVoided] = useState(false);
  const [sharingProhibited, setSharingProhibited] = useState(false);
  const [groupingIdentifier, setGroupingIdentifier] = useState('');
  const [suppressStripShine, setSuppressStripShine] = useState(false);
  const [maxDistance, setMaxDistance] = useState('');
  const [updatable, setUpdatable] = useState(false);
  const [webServiceURL, setWebServiceURL] = useState('');
  const [authenticationToken, setAuthenticationToken] = useState('');
  const [associatedStoreIdentifiers, setAssociatedStoreIdentifiers] = useState('');

  const [nfcEnabled, setNfcEnabled] = useState(false);
  const [nfcMessage, setNfcMessage] = useState('');
  const [nfcPublicKey, setNfcPublicKey] = useState('');
  const [nfcRequiresAuthentication, setNfcRequiresAuthentication] = useState(false);
  const [personalizationEnabled, setPersonalizationEnabled] = useState(false);
  const [personalizationDescription, setPersonalizationDescription] = useState('');
  const [personalizationFields, setPersonalizationFields] = useState<PersonalizationField[]>([]);
  const [personalizationTerms, setPersonalizationTerms] = useState('');

  const [eventOptions, setEventOptions] = useState<Record<string, string>>({});
  const [eventAutomaticColors, setEventAutomaticColors] = useState(false);
  const [suppressHeaderDarkening, setSuppressHeaderDarkening] = useState(false);
  const [auxiliaryStoreIdentifiers, setAuxiliaryStoreIdentifiers] = useState('');
  const [eventLogoText, setEventLogoText] = useState('');
  const [boardingOptions, setBoardingOptions] = useState<Record<string, string>>({});

  const [serverUrl, setServerUrl] = useState(process.env.EXPO_PUBLIC_PASS_SERVER_URL ?? 'https://pass.abdeen.dev');
  const [apiToken, setApiToken] = useState(process.env.EXPO_PUBLIC_PASS_API_TOKEN ?? '');
  const [applyingTemplateId, setApplyingTemplateId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const posterEvent = style === 'eventTicket' && preferredStyleSchemes.includes('posterEventTicket');
  const standardSlots = useMemo(() => slotsForStyle(style, posterEvent), [style, posterEvent]);
  const localizationLanguages = useMemo(
    () => localizations.map((entry) => entry.language.trim()).filter((language) => LANGUAGE.test(language)),
    [localizations]
  );
  const localizedSlots = useMemo(() => localizedSlotsForStyle(style, localizationLanguages, posterEvent), [style, localizationLanguages, posterEvent]);
  const recommendedSlots = standardSlots.filter((slot) => slot.recommended || slot.required);
  const optionalSlots = standardSlots.filter((slot) => !slot.recommended && !slot.required);

  const handlePick = async (slot: ImageSlot) => {
    setBusySlot(slot.name);
    try {
      const picked = await pickImageForSlot(slot);
      if (picked) setImages((current) => ({ ...current, [slot.name]: picked }));
    } catch (error) {
      Alert.alert('Artwork error', error instanceof Error ? error.message : String(error));
    } finally {
      setBusySlot(null);
    }
  };

  const handleClear = (slot: ImageSlot) => {
    setImages((current) => {
      const next = { ...current };
      delete next[slot.name];
      return next;
    });
  };

  const applyTemplate = async (template: PassTemplate) => {
    if (applyingTemplateId) return;
    setApplyingTemplateId(template.id);

    let bundledImages: Partial<Record<string, ProcessedImage>>;
    try {
      bundledImages = await loadBundledTemplateImages(template.id);
    } catch (error) {
      Alert.alert('Template artwork error', error instanceof Error ? error.message : String(error));
      setApplyingTemplateId(null);
      return;
    }

    const guidedKeys = new Set(COMMON_SEMANTICS[template.style].map((field) => field.key));
    const guidedSemantics: Record<string, string> = {};
    const advancedSemantics: JsonObject = {};
    for (const [key, value] of Object.entries(template.semantics ?? {})) {
      if (guidedKeys.has(key) && typeof value === 'string') guidedSemantics[key] = value;
      else advancedSemantics[key] = value;
    }

    const eventOptions = template.eventTicketOptions;
    const eventActionValues = Object.fromEntries(
      Object.entries(eventOptions ?? {}).filter(([, value]) => typeof value === 'string')
    ) as Record<string, string>;

    setLastAppliedTemplateId(template.id);
    setTemplatesCollapsed(true);
    setStyle(template.style);
    setDescription(template.description);
    setOrganizationName(template.organizationName);
    setLogoText(template.logoText);
    setBgColor(template.colors.background);
    setFgColor(template.colors.foreground);
    setLabelColor(template.colors.label);
    setStripColor(template.colors.strip ?? '');
    setFooterColor(template.colors.footer ?? '');
    setFields(buildTemplateFields(template));
    setBarcodes(buildTemplateBarcodes(template));
    setRelevantDates(buildTemplateRelevantDates(template));
    setLegacyRelevantDate('');
    setTransitType(template.transitType ?? 'PKTransitTypeGeneric');
    setPreferredStyleSchemes(template.preferredStyleSchemes ?? []);
    setSemanticValues(guidedSemantics);
    setSemanticsJson(Object.keys(advancedSemantics).length ? JSON.stringify(advancedSemantics, null, 2) : '');
    setEventOptions(eventActionValues);
    setEventAutomaticColors(eventOptions?.useAutomaticColors ?? false);
    setSuppressHeaderDarkening(eventOptions?.suppressHeaderDarkening ?? false);
    setAuxiliaryStoreIdentifiers(eventOptions?.auxiliaryStoreIdentifiers?.join(', ') ?? '');
    setEventLogoText(eventOptions?.eventLogoText ?? template.eventLogoText ?? '');
    setBoardingOptions(Object.fromEntries(
      Object.entries(template.boardingPassOptions ?? {}).filter(([, value]) => typeof value === 'string')
    ) as Record<string, string>);
    setUpcomingPassJson('');
    if (Object.keys(bundledImages).length) {
      setImages((current) => {
        const next = { ...current, ...bundledImages };
        // The template's poster artwork is the whole visual identity — legacy strip or
        // background images left over from earlier editing would leak into the pass.
        if (bundledImages.artwork) {
          delete next.strip;
          delete next.background;
        }
        return next;
      });
    }
    setApplyingTemplateId(null);
  };

  const handleTemplate = (template: PassTemplate) => {
    const hasContent = Boolean(description.trim()) || fields.length > 0 || barcodes.some((barcode) => barcode.message.trim());
    if (!hasContent) {
      void applyTemplate(template);
      return;
    }
    Alert.alert(
      `Start from “${template.name}”?`,
      'This replaces the pass format, identity, colors, fields, barcode, relevant dates, semantic data, style-specific actions, and any bundled template artwork. Other artwork, NFC credentials, and server settings stay as they are.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Apply template', onPress: () => { void applyTemplate(template); } },
      ]
    );
  };

  const handleSubmit = async () => {
    if (applyingTemplateId) {
      Alert.alert('Artwork is still loading', 'Wait for the selected template artwork to finish loading, then create the pass.');
      return;
    }

    let spec: PassSpec;
    try {
      spec = createSpec();
    } catch (error) {
      Alert.alert('Check your pass', error instanceof Error ? error.message : String(error));
      return;
    }
    setSubmitting(true);
    try {
      const created = await createPass(serverUrl.trim(), spec, apiToken.trim() || undefined);
      await presentWalletPass(created.url);
      if (created.serialNumber) {
        Alert.alert(
          'Updatable pass created',
          `Serial number:\n${created.serialNumber}\n\nUse it with PUT /api/passes/<serial> (or the MCP update_pass tool) to push changes to Wallet.`
        );
      }
    } catch (error) {
      Alert.alert('Could not create pass', error instanceof Error ? error.message : String(error));
    } finally {
      setSubmitting(false);
    }
  };

  const createSpec = (): PassSpec => {
    if (!serverUrl.trim()) throw new Error('Set the pass server URL in Advanced → Server.');
    if (!description.trim()) throw new Error('Add the Wallet description in Design → Identity.');
    if (!images.icon) throw new Error('Choose the required icon artwork in Design → Artwork.');
    for (const [name, value, required] of [
      ['Background', bgColor, true],
      ['Foreground', fgColor, true],
      ['Label', labelColor, true],
      ['Strip', stripColor, false],
      ['Footer', footerColor, false],
    ] as const) {
      if ((required || value.trim()) && !HEX_COLOR.test(value.trim())) throw new Error(`${name} color must be a hex value like #131822.`);
    }

    const specFields: Partial<Record<FieldCategory, PassField[]>> = {};
    for (const field of fields) {
      if (!field.value.trim()) continue;
      let value: string | number = field.value.trim();
      if (field.valueType === 'number') {
        value = parseRequiredNumber(field.value, `${field.label || field.key || 'Field'} value`);
      } else if (field.valueType === 'date') {
        assertDate(field.value, `${field.label || field.key || 'Field'} date`);
      }
      const list = (specFields[field.category] ??= []);
      const parsed: PassField = {
        key: field.key.trim() || `${field.category}-${list.length + 1}`,
        ...(field.label.trim() ? { label: field.label.trim() } : {}),
        value,
      };
      if (field.attributedValue.trim()) parsed.attributedValue = field.valueType === 'number' ? parseRequiredNumber(field.attributedValue, 'Attributed value') : field.attributedValue.trim();
      if (field.changeMessage.trim()) parsed.changeMessage = field.changeMessage.trim();
      if (field.textAlignment !== 'unset') parsed.textAlignment = field.textAlignment;
      if (field.dataDetectorTypes.length) parsed.dataDetectorTypes = field.dataDetectorTypes;
      if (field.valueType === 'date') {
        if (field.dateStyle !== 'unset') parsed.dateStyle = field.dateStyle;
        if (field.timeStyle !== 'unset') parsed.timeStyle = field.timeStyle;
        if (field.ignoresTimeZone) parsed.ignoresTimeZone = true;
        if (field.isRelative) parsed.isRelative = true;
      }
      if (field.valueType === 'number') {
        if (field.numberStyle !== 'unset') parsed.numberStyle = field.numberStyle;
        if (field.currencyCode.trim()) parsed.currencyCode = field.currencyCode.trim().toUpperCase();
      }
      if (field.row !== 'unset' && style === 'eventTicket' && field.category === 'auxiliary') parsed.row = Number(field.row) as 0 | 1;
      if (field.semanticsJson.trim()) parsed.semantics = parseJsonObject(field.semanticsJson, `Semantics for ${field.label || field.key || 'field'}`);
      list.push(parsed);
    }

    const parsedBarcodes = barcodes.filter((barcode) => barcode.message.trim()).map((barcode) => ({
      format: barcode.format,
      message: barcode.message.trim(),
      ...(barcode.altText.trim() ? { altText: barcode.altText.trim() } : {}),
      ...(barcode.messageEncoding.trim() ? { messageEncoding: barcode.messageEncoding.trim() } : {}),
    }));
    const parsedLocations = locations.filter(hasLocationContent).map((location, index) => ({
      latitude: parseRequiredNumber(location.latitude, `Location ${index + 1} latitude`),
      longitude: parseRequiredNumber(location.longitude, `Location ${index + 1} longitude`),
      ...(location.altitude.trim() ? { altitude: parseRequiredNumber(location.altitude, `Location ${index + 1} altitude`) } : {}),
      ...(location.relevantText.trim() ? { relevantText: location.relevantText.trim() } : {}),
    }));
    const parsedBeacons = beacons.filter(hasBeaconContent).map((beacon, index) => {
      if (!beacon.proximityUUID.trim()) throw new Error(`Beacon ${index + 1} needs a proximity UUID.`);
      return {
        proximityUUID: beacon.proximityUUID.trim(),
        ...(beacon.major.trim() ? { major: parseRequiredInteger(beacon.major, `Beacon ${index + 1} major`) } : {}),
        ...(beacon.minor.trim() ? { minor: parseRequiredInteger(beacon.minor, `Beacon ${index + 1} minor`) } : {}),
        ...(beacon.relevantText.trim() ? { relevantText: beacon.relevantText.trim() } : {}),
      };
    });
    const parsedDates = relevantDates.map((entry, index) => {
      if (entry.kind === 'date') {
        assertDate(entry.date, `Relevant date ${index + 1}`);
        return { date: entry.date.trim() };
      }
      assertDate(entry.startDate, `Interval ${index + 1} start`);
      assertDate(entry.endDate, `Interval ${index + 1} end`);
      return { startDate: entry.startDate.trim(), endDate: entry.endDate.trim() };
    });

    const guidedSemantics = Object.fromEntries(Object.entries(semanticValues).filter(([, value]) => value.trim()).map(([key, value]) => [key, value.trim()])) as JsonObject;
    const rawSemantics = semanticsJson.trim() ? parseJsonObject(semanticsJson, 'Pass semantics') : {};
    const mergedSemantics = { ...rawSemantics, ...guidedSemantics } as JsonObject;
    const options: PassOptions = {
      ...(appLaunchURL.trim() ? { appLaunchURL: appLaunchURL.trim() } : {}),
      ...(voided ? { voided: true } : {}),
      ...(sharingProhibited ? { sharingProhibited: true } : {}),
      ...(groupingIdentifier.trim() ? { groupingIdentifier: groupingIdentifier.trim() } : {}),
      ...(suppressStripShine ? { suppressStripShine: true } : {}),
      ...(maxDistance.trim() ? { maxDistance: parseRequiredNumber(maxDistance, 'Maximum relevance distance') } : {}),
      ...(Object.keys(mergedSemantics).length ? { semantics: mergedSemantics } : {}),
      ...(userInfoJson.trim() ? { userInfo: parseJsonObject(userInfoJson, 'User info') } : {}),
      ...(!updatable && webServiceURL.trim() ? { webServiceURL: webServiceURL.trim() } : {}),
      ...(!updatable && authenticationToken.trim() ? { authenticationToken: authenticationToken.trim() } : {}),
      ...(associatedStoreIdentifiers.trim() ? { associatedStoreIdentifiers: parseNumberList(associatedStoreIdentifiers, 'Associated App Store identifiers') } : {}),
    };
    if (Boolean(options.webServiceURL) !== Boolean(options.authenticationToken)) throw new Error('Web service URL and authentication token must be supplied together.');

    const parsedLocalizations = localizations.map((localization, index) => {
      const language = localization.language.trim();
      if (!LANGUAGE.test(language)) throw new Error(`Language ${index + 1} needs a tag such as en or en-US.`);
      const translations = Object.fromEntries(localization.translations.filter((entry) => entry.key.trim()).map((entry) => [entry.key.trim(), entry.value]));
      return { language, translations };
    });

    const activeImageSlots = [
      ...standardSlots,
      ...localizedSlots,
      ...(personalizationEnabled ? [PERSONALIZATION_LOGO_SLOT] : []),
    ];
    const specImages: Record<string, string> = {};
    for (const slot of activeImageSlots) {
      const picked = images[slot.name];
      if (picked) Object.assign(specImages, picked.files);
    }

    assertModernStyleRequirements({
      style,
      transitType,
      preferredStyleSchemes,
      semantics: mergedSemantics,
      images: specImages,
    });

    if (expirationDate.trim()) assertDate(expirationDate, 'Expiration date');
    if (legacyRelevantDate.trim()) assertDate(legacyRelevantDate, 'Legacy relevant date');
    if (personalizationEnabled && !nfcEnabled) throw new Error('Personalization requires NFC to be enabled.');
    if (personalizationEnabled && !images.personalizationLogo) throw new Error('Personalization requires its logo artwork.');
    if (nfcEnabled && (!nfcMessage.trim() || !nfcPublicKey.trim())) throw new Error('NFC requires both a message and encryption public key.');

    const parsedEventOptions = cleanStringRecord(eventOptions) as unknown as EventTicketOptions;
    if (eventAutomaticColors) parsedEventOptions.useAutomaticColors = true;
    if (suppressHeaderDarkening) parsedEventOptions.suppressHeaderDarkening = true;
    if (auxiliaryStoreIdentifiers.trim()) parsedEventOptions.auxiliaryStoreIdentifiers = parseNumberList(auxiliaryStoreIdentifiers, 'Auxiliary App Store identifiers');
    if (eventLogoText.trim()) parsedEventOptions.eventLogoText = eventLogoText.trim();

    return {
      style,
      description: description.trim(),
      ...(updatable ? { updatable: true } : {}),
      ...(serialNumber.trim() ? { serialNumber: serialNumber.trim() } : {}),
      ...(organizationName.trim() ? { organizationName: organizationName.trim() } : {}),
      ...(logoText.trim() ? { logoText: logoText.trim() } : {}),
      colors: {
        backgroundColor: bgColor.trim(),
        foregroundColor: fgColor.trim(),
        labelColor: labelColor.trim(),
        ...(stripColor.trim() ? { stripColor: stripColor.trim() } : {}),
        ...(footerColor.trim() ? { footerBackgroundColor: footerColor.trim() } : {}),
      },
      ...(Object.keys(options).length ? { options } : {}),
      ...(style === 'eventTicket' && Object.keys(parsedEventOptions).length ? { eventTicketOptions: parsedEventOptions } : {}),
      ...(style === 'boardingPass' && Object.keys(boardingOptions).length ? { boardingPassOptions: cleanStringRecord(boardingOptions) as unknown as BoardingPassOptions } : {}),
      ...(Object.keys(specFields).length ? { fields: specFields } : {}),
      ...(parsedBarcodes.length ? { barcodes: parsedBarcodes } : {}),
      ...(style === 'boardingPass' ? { transitType } : {}),
      ...(preferredStyleSchemes.length ? { preferredStyleSchemes } : {}),
      ...(expirationDate.trim() ? { expirationDate: expirationDate.trim() } : {}),
      ...(legacyRelevantDate.trim() ? { relevantDate: legacyRelevantDate.trim() } : {}),
      ...(parsedDates.length ? { relevantDates: parsedDates } : {}),
      ...(parsedLocations.length ? { locations: parsedLocations } : {}),
      ...(parsedBeacons.length ? { beacons: parsedBeacons } : {}),
      ...(nfcEnabled ? { nfc: { message: nfcMessage.trim(), encryptionPublicKey: nfcPublicKey.trim(), ...(nfcRequiresAuthentication ? { requiresAuthentication: true } : {}) } } : {}),
      ...(parsedLocalizations.length ? { localizations: parsedLocalizations } : {}),
      ...(personalizationEnabled ? { personalization: { description: personalizationDescription.trim() || description.trim(), requiredPersonalizationFields: personalizationFields, ...(personalizationTerms.trim() ? { termsAndConditions: personalizationTerms.trim() } : {}) } } : {}),
      ...(upcomingPassJson.trim() ? { upcomingPassInformation: parseJsonArray(upcomingPassJson, 'Upcoming pass information') } : {}),
      images: specImages,
    };
  };

  return (
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={92}>
      <ScrollView
        style={styles.flex}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: insets.bottom }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.hero}>
          <View style={styles.heroCopy}>
            <View style={styles.heroLockup}>
              <Image source={require('../../assets/images/seal-key.png')} style={styles.heroSeal} />
              <View style={styles.heroLockupDivider} />
              <Text style={styles.heroWordmark}>ABDEEN LABS</Text>
            </View>
            <Text style={styles.heroTitle}>Pocketful</Text>
            <Text style={styles.heroSubtitle}>A complete, visual editor for signed Apple Wallet passes.</Text>
          </View>
        </View>

        <PassPreview
          style={style}
          description={description}
          organizationName={organizationName}
          logoText={logoText}
          backgroundColor={bgColor}
          foregroundColor={fgColor}
          labelColor={labelColor}
          fields={fields}
          images={images}
          barcodeCount={barcodes.filter((barcode) => barcode.message.trim()).length}
          voided={voided}
        />

        <View style={styles.tabBar}>
          <ChipRow options={TAB_OPTIONS} value={tab} onChange={setTab} />
          <View style={styles.summaryRow}>
            <Badge text={`${fields.length} fields`} />
            <Badge text={`${Object.keys(images).length} artwork`} />
            <Badge text={`${localizations.length} languages`} />
          </View>
        </View>

        {tab === 'design' ? (
          <>
            <Section
              title="Templates"
              description={lastAppliedTemplateId ? 'A polished starting point is applied. Expand to switch it.' : 'Pick a polished starting point, then make every detail yours.'}
              badge={lastAppliedTemplateId ? 'Applied' : 'Curated'}
              collapsible
              collapsed={templatesCollapsed}
              onCollapsedChange={setTemplatesCollapsed}
            >
              <TemplateGallery
                onApply={handleTemplate}
                lastAppliedId={lastAppliedTemplateId}
                applyingId={applyingTemplateId}
              />
            </Section>

            <Section title="Pass format" description="Choose Wallet's visual template and modern layout preference." badge="Core">
              <ChipRow options={STYLE_OPTIONS} value={style} onChange={(nextStyle) => {
                setStyle(nextStyle);
                setPreferredStyleSchemes([]);
                if (nextStyle !== 'eventTicket') {
                  setFields((current) => current.map((field) => field.category === 'additionalInfo' ? { ...field, category: 'back' } : field));
                }
              }} />
              {style === 'boardingPass' ? (
                <>
                  <Text style={styles.miniLabel}>Transit type</Text>
                  <ChipRow options={TRANSIT_OPTIONS} value={transitType} onChange={setTransitType} />
                  <Text style={styles.miniLabel}>Preferred layouts</Text>
                  <MultiChipRow options={BOARDING_SCHEMES} values={preferredStyleSchemes} onChange={setPreferredStyleSchemes} />
                </>
              ) : null}
              {style === 'eventTicket' ? (
                <>
                  <Text style={styles.miniLabel}>Preferred layouts</Text>
                  <MultiChipRow options={EVENT_SCHEMES} values={preferredStyleSchemes} onChange={setPreferredStyleSchemes} />
                </>
              ) : null}
            </Section>

            <Section title="Identity" description="The pass name, issuer, and stable identity used by Wallet.">
              <Input label="Wallet description · required" value={description} onChangeText={setDescription} placeholder="Coffee rewards card" autoCapitalize="sentences" maxLength={200} />
              <Input label="Organization name" value={organizationName} onChangeText={setOrganizationName} placeholder="Pocketful Coffee" autoCapitalize="words" />
              <Input label="Logo text" value={logoText} onChangeText={setLogoText} placeholder="Pocketful" autoCapitalize="words" />
              <Input label="Serial number" value={serialNumber} onChangeText={setSerialNumber} placeholder="Generated automatically when blank" helper="Supply this when you need a stable identifier for updates; otherwise the server creates a UUID." />
            </Section>

            <Section title="Color system" description="Wallet uses these colors across the front, labels, strips, and modern event footer.">
              <View style={styles.swatches}>
                {[bgColor, fgColor, labelColor].map((color, index) => <View key={index} style={[styles.swatch, { backgroundColor: HEX_COLOR.test(color) ? color : colors.border }]} />)}
              </View>
              <Input label="Background" value={bgColor} onChangeText={setBgColor} placeholder="#131822" />
              <Input label="Foreground text" value={fgColor} onChangeText={setFgColor} placeholder="#ffffff" />
              <Input label="Labels" value={labelColor} onChangeText={setLabelColor} placeholder="#a9b2c0" />
              <Disclosure title="Specialized colors" description="Optional strip-field and poster-event footer colors">
                <Input label="Strip text color" value={stripColor} onChangeText={setStripColor} placeholder="Optional #ffffff" />
                <Input label="Event footer background" value={footerColor} onChangeText={setFooterColor} placeholder="Optional #0c1017" />
              </Disclosure>
            </Section>

            <Section title="Artwork" description="Every standard Wallet asset is resized and exported at 1×, 2×, and 3×." badge="PNG">
              <ImagesSection slots={recommendedSlots} images={images} busySlot={busySlot} onPick={handlePick} onClear={handleClear} />
              <Disclosure title="More standard artwork" description="Strip, thumbnail, background, and footer slots that are less common for this format">
                <ImagesSection slots={optionalSlots} images={images} busySlot={busySlot} onPick={handlePick} onClear={handleClear} />
              </Disclosure>
              {localizedSlots.length ? (
                <Disclosure title="Localized artwork" description={`${localizationLanguages.length} language-specific asset sets`}>
                  <ImagesSection slots={localizedSlots} images={images} busySlot={busySlot} onPick={handlePick} onClear={handleClear} />
                </Disclosure>
              ) : null}
              {personalizationEnabled ? (
                <Disclosure title="Personalization artwork" description="Required alongside NFC and personalization.json" defaultOpen>
                  <ImagesSection slots={[PERSONALIZATION_LOGO_SLOT]} images={images} busySlot={busySlot} onPick={handlePick} onClear={handleClear} />
                </Disclosure>
              ) : null}
            </Section>
          </>
        ) : null}

        {tab === 'content' ? (
          <>
            <Section title="Pass fields" description="Header, primary, secondary, auxiliary, back, and modern event-details fields." badge="Rich content">
              <FieldsEditor fields={fields} style={style} onChange={setFields} />
            </Section>
            <Section title="Barcodes" description="Add ordered fallback formats with their own encodings and visible text." badge="Up to 4">
              <BarcodesEditor value={barcodes} onChange={setBarcodes} />
            </Section>
          </>
        ) : null}

        {tab === 'smart' ? (
          <>
            <Section title="Semantic intelligence" description="Help Wallet understand events, transit, loyalty, seats, prices, people, Wi-Fi, and more." badge="iOS 18/26">
              {COMMON_SEMANTICS[style].map((field) => (
                <Input key={field.key} label={field.label} value={semanticValues[field.key] ?? ''} onChangeText={(value) => setSemanticValues((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} />
              ))}
              <Disclosure title="Complete semantic tags object" description="Access every passkit-generator semantic tag, including nested seats, locations, names, currency, dates, security programs, and Wi-Fi">
                <Input label="Pass semantics · JSON" value={semanticsJson} onChangeText={setSemanticsJson} multiline placeholder={'{\n  "eventType": "PKEventTypeSports",\n  "seats": [{ "seatSection": "104", "seatRow": "B", "seatNumber": "12" }]\n}'} helper="Guided fields above override matching keys in this object." />
                <Notice title="Full schema access">Use any key supported by passkit-generator&apos;s Semantics schema. Nested semantic tag types are accepted here without reducing them to text fields.</Notice>
              </Disclosure>
            </Section>

            <Section title="Relevant moments" description="Expiration, legacy relevance, modern relevant dates, and Live Activity intervals.">
              <Input label="Expiration date" value={expirationDate} onChangeText={setExpirationDate} placeholder="2026-09-02T00:00:00-04:00" />
              <Disclosure title="Legacy relevant date" description="Deprecated in iOS 18, retained because passkit-generator exposes it">
                <Input label="Relevant date" value={legacyRelevantDate} onChangeText={setLegacyRelevantDate} placeholder="2026-09-01T19:30:00-04:00" />
              </Disclosure>
              <RelevantDatesEditor value={relevantDates} onChange={setRelevantDates} />
            </Section>

            <Section title="Locations" description="Geographic relevance points that can surface the pass nearby." badge="Up to 10">
              <LocationsEditor value={locations} onChange={setLocations} />
            </Section>
            <Section title="iBeacons" description="Proximity UUIDs, major/minor identifiers, and relevant messages." badge="Up to 10">
              <BeaconsEditor value={beacons} onChange={setBeacons} />
            </Section>
            <Section title="NFC" description="Configure contactless payloads and authentication behavior.">
              <ToggleRow label="Enable NFC" description="Required for personalization passes." value={nfcEnabled} onChange={setNfcEnabled} />
              {nfcEnabled ? (
                <>
                  <Input label="NFC message" value={nfcMessage} onChangeText={setNfcMessage} placeholder="Payload read by the NFC terminal" />
                  <Input label="Encryption public key" value={nfcPublicKey} onChangeText={setNfcPublicKey} placeholder="PEM or pass-compatible public key" multiline />
                  <ToggleRow label="Require authentication" value={nfcRequiresAuthentication} onChange={setNfcRequiresAuthentication} />
                </>
              ) : null}
            </Section>
          </>
        ) : null}

        {tab === 'advanced' ? (
          <>
            <Section title="Pass behavior" description="App launching, grouping, sharing, relevance radius, update services, and custom metadata.">
              <Input label="App launch URL" value={appLaunchURL} onChangeText={setAppLaunchURL} placeholder="pocketful://pass/123" keyboardType="url" />
              <Input label="Grouping identifier" value={groupingIdentifier} onChangeText={setGroupingIdentifier} placeholder="membership-cards" />
              <Input label="Maximum relevance distance" value={maxDistance} onChangeText={setMaxDistance} placeholder="Meters" keyboardType="decimal-pad" />
              <Input label="Associated App Store IDs" value={associatedStoreIdentifiers} onChangeText={setAssociatedStoreIdentifiers} placeholder="123456789, 987654321" keyboardType="numbers-and-punctuation" />
              <ToggleRow label="Mark pass as voided" description="Wallet renders a prominent voided state." value={voided} onChange={setVoided} />
              <ToggleRow label="Prohibit sharing" value={sharingProhibited} onChange={setSharingProhibited} />
              <ToggleRow label="Suppress strip shine" value={suppressStripShine} onChange={setSuppressStripShine} />
              <Disclosure title="Web service updates" description="Let the signing server push changes to this pass after it is in Wallet">
                <ToggleRow label="Updatable (OTA)" description="The server keeps this pass, manages its update credentials, and can push new versions to Wallet." value={updatable} onChange={setUpdatable} />
                {!updatable ? (
                  <>
                    <Input label="Web service URL" value={webServiceURL} onChangeText={setWebServiceURL} placeholder="https://passes.example/v1" keyboardType="url" />
                    <Input label="Authentication token" value={authenticationToken} onChangeText={setAuthenticationToken} placeholder="At least 16 characters recommended" secureTextEntry />
                  </>
                ) : null}
              </Disclosure>
              <Disclosure title="Custom user info" description="App-defined JSON stored inside pass.json">
                <Input label="User info · JSON" value={userInfoJson} onChangeText={setUserInfoJson} multiline placeholder={'{\n  "accountId": "abc-123",\n  "tier": "gold"\n}'} />
              </Disclosure>
            </Section>

            {style === 'eventTicket' ? (
              <Section title="Event experience" description="Poster layout, Event Guide actions, contact details, and ticket menu actions." badge="iOS 18+">
                <ToggleRow label="Use automatic colors" description="Derive foreground and label colors from poster artwork." value={eventAutomaticColors} onChange={setEventAutomaticColors} />
                <ToggleRow label="Suppress header darkening" value={suppressHeaderDarkening} onChange={setSuppressHeaderDarkening} />
                <Input label="Poster event logo text" value={eventLogoText} onChangeText={setEventLogoText} placeholder="Pocketful Live" />
                <Input label="Auxiliary App Store IDs" value={auxiliaryStoreIdentifiers} onChangeText={setAuxiliaryStoreIdentifiers} placeholder="123456789, 987654321" />
                <Disclosure title="Event Guide & ticket actions" description="Wallet generally shows the Event Guide when at least two relevant actions are supplied">
                  {EVENT_OPTION_FIELDS.map((field) => (
                    <Input key={field.key} label={field.label} value={eventOptions[field.key] ?? ''} onChangeText={(value) => setEventOptions((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} keyboardType={field.keyboard} />
                  ))}
                </Disclosure>
                {preferredStyleSchemes.includes('posterEventTicket') ? (
                  <Disclosure title="Upcoming pass information" description="The complete iOS 26 poster-event entries schema">
                    <Input label="Upcoming entries · JSON array" value={upcomingPassJson} onChangeText={setUpcomingPassJson} multiline placeholder={'[\n  {\n    "type": "event",\n    "date": "2026-10-01T19:30:00Z"\n  }\n]'} helper="passkit-generator validates every entry against its installed iOS 26 schema." />
                  </Disclosure>
                ) : null}
              </Section>
            ) : null}

            {style === 'boardingPass' ? (
              <Section title="Enhanced boarding" description="Seat, entertainment, baggage, lounge, Wi-Fi, accessibility, and provider actions." badge="iOS 26+">
                {BOARDING_OPTION_FIELDS.map((field) => (
                  <Input key={field.key} label={field.label} value={boardingOptions[field.key] ?? ''} onChangeText={(value) => setBoardingOptions((current) => ({ ...current, [field.key]: value }))} placeholder={field.placeholder} keyboardType={field.keyboard} />
                ))}
              </Section>
            ) : null}

            <Section title="Localization" description="Generate pass.strings for every language and enable localized artwork folders." badge={`${localizations.length} languages`}>
              <LocalizationsEditor value={localizations} onChange={setLocalizations} />
            </Section>

            <Section title="Personalization" description="Ask for customer information before adding an NFC pass." badge="NFC required">
              <ToggleRow label="Enable personalization" value={personalizationEnabled} onChange={setPersonalizationEnabled} />
              {personalizationEnabled ? (
                <>
                  <Notice tone="warning" title="Three required pieces">Wallet only keeps personalization.json when NFC details and personalization logo artwork are also present.</Notice>
                  <Input label="Personalization description" value={personalizationDescription} onChangeText={setPersonalizationDescription} placeholder="Personalize your membership pass" />
                  <Text style={styles.miniLabel}>Information to collect</Text>
                  <MultiChipRow options={PERSONALIZATION_OPTIONS} values={personalizationFields} onChange={setPersonalizationFields} />
                  <Input label="Terms and conditions" value={personalizationTerms} onChangeText={setPersonalizationTerms} placeholder="Optional terms shown during personalization" multiline />
                </>
              ) : null}
            </Section>

            <Section title="Server" description="The signing service remains the authority for certificates, team ID, and pass type ID." badge="Secure">
              <Input label="Pass server URL" value={serverUrl} onChangeText={setServerUrl} placeholder="https://pass.abdeen.dev" keyboardType="url" autoCapitalize="none" />
              <Input label="API token" value={apiToken} onChangeText={setApiToken} placeholder="Only when configured on the server" secureTextEntry />
              <Notice>Signing certificates never enter the app or pass payload. The server supplies the pass type identifier, team identifier, and signing chain.</Notice>
            </Section>
          </>
        ) : null}

        <View style={styles.submitCard}>
          <View style={styles.submitCopy}>
            <Text style={styles.submitTitle}>Ready for Wallet?</Text>
            <Text style={styles.submitSubtitle}>
              {applyingTemplateId
                ? 'Loading the template artwork before generation…'
                : 'The server will validate, sign, and return the finished pass.'}
            </Text>
          </View>
          <Button
            title="Create pass & add to Wallet"
            onPress={handleSubmit}
            loading={submitting}
            disabled={Boolean(applyingTemplateId)}
          />
        </View>
        <View style={styles.footer} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function parseRequiredNumber(value: string, label: string): number {
  const number = Number(value.trim());
  if (!value.trim() || !Number.isFinite(number)) throw new Error(`${label} must be a number.`);
  return number;
}

function parseRequiredInteger(value: string, label: string): number {
  const number = parseRequiredNumber(value, label);
  if (!Number.isInteger(number)) throw new Error(`${label} must be a whole number.`);
  return number;
}

function parseNumberList(value: string, label: string): number[] {
  return value.split(/[\s,]+/).filter(Boolean).map((part) => parseRequiredInteger(part, label));
}

function assertDate(value: string, label: string): void {
  if (!value.trim() || Number.isNaN(Date.parse(value.trim()))) throw new Error(`${label} must be an ISO-8601 date.`);
}

function parseJsonObject(value: string, label: string): JsonObject {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${label} is not valid JSON.`); }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) throw new Error(`${label} must be a JSON object.`);
  return parsed as JsonObject;
}

function parseJsonArray(value: string, label: string): JsonObject[] {
  let parsed: unknown;
  try { parsed = JSON.parse(value); } catch { throw new Error(`${label} is not valid JSON.`); }
  if (!Array.isArray(parsed) || parsed.some((entry) => typeof entry !== 'object' || entry === null || Array.isArray(entry))) throw new Error(`${label} must be a JSON array of objects.`);
  return parsed as JsonObject[];
}

function cleanStringRecord(value: Record<string, string>): Record<string, string> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry.trim()).map(([key, entry]) => [key, entry.trim()]));
}

function assertModernStyleRequirements({
  style,
  transitType,
  preferredStyleSchemes,
  semantics,
  images,
}: {
  style: PassStyle;
  transitType: TransitType;
  preferredStyleSchemes: PreferredStyleScheme[];
  semantics: JsonObject;
  images: Record<string, string>;
}): void {
  if (preferredStyleSchemes.includes('posterEventTicket')) {
    if (style !== 'eventTicket') throw new Error('Poster layout requires the event-ticket format.');
    if (!hasImageAsset(images, 'artwork')) {
      throw new Error('Poster event tickets require poster artwork in Design → Artwork.');
    }
    assertSemanticKeys(semantics, ['eventName', 'venueName', 'venueRegionName', 'venueRoom'], 'Poster event ticket');
    if (semantics.eventType === 'PKEventTypeSports') {
      assertSemanticKeys(semantics, ['awayTeamAbbreviation', 'homeTeamAbbreviation'], 'Sports poster ticket');
    }
    if (semantics.eventType === 'PKEventTypeLivePerformance') {
      if (!Array.isArray(semantics.performerNames) || semantics.performerNames.length === 0) {
        throw new Error('Live-performance poster tickets require at least one performer name in pass semantics.');
      }
    }
  }

  if (preferredStyleSchemes.includes('semanticBoardingPass')) {
    if (style !== 'boardingPass' || transitType !== 'PKTransitTypeAir') {
      throw new Error('Enhanced boarding passes require an airline boarding-pass format.');
    }
    assertSemanticKeys(semantics, [
      'airlineCode',
      'flightNumber',
      'departureAirportCode',
      'departureCityName',
      'departureLocationTimeZone',
      'destinationAirportCode',
      'destinationCityName',
      'destinationLocationTimeZone',
      'originalArrivalDate',
      'originalBoardingDate',
      'originalDepartureDate',
      'passengerName',
    ], 'Enhanced boarding pass');
  }
}

function hasImageAsset(images: Record<string, string>, name: string): boolean {
  return Boolean(images[name] || images[`${name}@2x`] || images[`${name}@3x`]);
}

function assertSemanticKeys(semantics: JsonObject, keys: string[], label: string): void {
  const missing = keys.filter((key) => {
    const value = semantics[key];
    return value === undefined || value === null || value === '';
  });
  if (missing.length) throw new Error(`${label} is missing required semantics: ${missing.join(', ')}.`);
}

function hasLocationContent(location: EditableLocation): boolean {
  return Boolean(location.latitude.trim() || location.longitude.trim() || location.altitude.trim() || location.relevantText.trim());
}

function hasBeaconContent(beacon: EditableBeacon): boolean {
  return Boolean(beacon.proximityUUID.trim() || beacon.major.trim() || beacon.minor.trim() || beacon.relevantText.trim());
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: 16, paddingTop: 12 },
  hero: { minHeight: 148, borderRadius: radii.shell, marginBottom: 24, overflow: 'hidden', backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  heroCopy: { flex: 1, justifyContent: 'center', padding: 22, gap: 9 },
  heroLockup: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroSeal: { width: 24, height: 24 },
  heroLockupDivider: { width: StyleSheet.hairlineWidth, height: 16, backgroundColor: colors.border },
  heroWordmark: { color: colors.textSoft, fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: 2.42 },
  heroTitle: { color: colors.text, fontFamily: fonts.displayHeavy, fontSize: 28, lineHeight: 30, letterSpacing: 28 * tracking.display, textTransform: 'uppercase' },
  heroSubtitle: { color: colors.textSoft, fontFamily: fonts.text, fontSize: 13, lineHeight: 18 },
  tabBar: { marginBottom: 28, padding: 12, gap: 11, borderRadius: radii.plate, backgroundColor: colors.card, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  summaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  miniLabel: { color: colors.textSoft, fontFamily: fonts.monoMedium, fontSize: 11, letterSpacing: tracking.micro, textTransform: 'uppercase' },
  swatches: { height: 42, flexDirection: 'row', overflow: 'hidden', borderRadius: radii.control, borderWidth: 1, borderColor: colors.border },
  swatch: { flex: 1 },
  submitCard: { gap: 16, padding: 18, borderRadius: radii.plate, backgroundColor: colors.cardElevated, borderWidth: 1, borderColor: colors.borderStrong },
  submitCopy: { gap: 3 },
  submitTitle: { color: colors.text, fontFamily: fonts.textSemiBold, fontSize: 17 },
  submitSubtitle: { color: colors.dim, fontFamily: fonts.text, fontSize: 12, lineHeight: 17 },
  footer: { height: 52 },
});
