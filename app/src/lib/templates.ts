import { newBarcode, type EditableBarcode } from '@/components/CollectionEditors';
import { newField, type EditableField } from '@/components/FieldsEditor';
import type {
  BarcodeFormat,
  DataDetectorType,
  DateStyle,
  FieldCategory,
  NumberStyle,
  PassStyle,
  PreferredStyleScheme,
  TextAlignment,
  TransitType,
} from '@/types';

// Curated starting points. A template fills the design and content surface —
// style, identity, colors, fields, barcode, and guided semantics — and leaves
// artwork, relevance, NFC, and server settings untouched.

export interface TemplateField {
  category: FieldCategory;
  key: string;
  label?: string;
  value: string;
  valueType?: 'text' | 'number' | 'date';
  changeMessage?: string;
  textAlignment?: TextAlignment;
  dateStyle?: DateStyle;
  timeStyle?: DateStyle;
  numberStyle?: NumberStyle;
  currencyCode?: string;
  row?: '0' | '1';
  dataDetectorTypes?: DataDetectorType[];
}

export interface PassTemplate {
  id: string;
  name: string;
  tagline: string;
  glyph: string;
  style: PassStyle;
  transitType?: TransitType;
  preferredStyleSchemes?: PreferredStyleScheme[];
  description: string;
  organizationName: string;
  logoText: string;
  colors: { background: string; foreground: string; label: string; strip?: string; footer?: string };
  fields: TemplateField[];
  barcode?: { format: BarcodeFormat; message: string; altText?: string };
  semantics?: Record<string, string>;
  eventLogoText?: string;
}

// Sample dates stay in the near future relative to whenever the app launches.
function upcoming(days: number, hour = 19, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

export const TEMPLATES: PassTemplate[] = [
  {
    id: 'espresso-club',
    name: 'Espresso Club',
    tagline: 'Warm café loyalty card with a live balance and stamp progress.',
    glyph: '☕️',
    style: 'storeCard',
    description: 'Espresso Club loyalty card',
    organizationName: 'Espresso Club',
    logoText: 'Espresso Club',
    colors: { background: '#31221b', foreground: '#f7efe4', label: '#d3a874' },
    fields: [
      { category: 'header', key: 'balance', label: 'Balance', value: '12.50', valueType: 'number', currencyCode: 'USD', changeMessage: 'Balance updated to %@' },
      { category: 'primary', key: 'member', label: 'Member', value: 'Jane Appleseed' },
      { category: 'secondary', key: 'tier', label: 'Tier', value: 'Gold' },
      { category: 'secondary', key: 'points', label: 'Points', value: '1280', valueType: 'number', numberStyle: 'PKNumberStyleDecimal' },
      { category: 'auxiliary', key: 'reward', label: 'Next reward', value: '2 stamps away' },
      { category: 'back', key: 'perks', label: 'Gold perks', value: 'Free size upgrades, birthday drink, and early access to seasonal roasts.' },
      { category: 'back', key: 'contact', label: 'Questions?', value: '+1 (212) 555-0139', dataDetectorTypes: ['PKDataDetectorTypePhoneNumber'] },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'ESPRESSO-104820', altText: 'Member 104820' },
    semantics: { membershipProgramName: 'Espresso Club', membershipProgramNumber: '104820' },
  },
  {
    id: 'skyline-air',
    name: 'Skyline Air',
    tagline: 'Enhanced boarding pass with gates, groups, and live flight status.',
    glyph: '✈️',
    style: 'boardingPass',
    transitType: 'PKTransitTypeAir',
    preferredStyleSchemes: ['semanticBoardingPass'],
    description: 'Skyline Air boarding pass',
    organizationName: 'Skyline Air',
    logoText: 'Skyline Air',
    colors: { background: '#0c2d4d', foreground: '#f4f9ff', label: '#93bee8' },
    fields: [
      { category: 'header', key: 'gate', label: 'Gate', value: 'B7', changeMessage: 'Gate changed to %@' },
      { category: 'header', key: 'flight', label: 'Flight', value: 'PF 208' },
      { category: 'primary', key: 'origin', label: 'New York', value: 'JFK' },
      { category: 'primary', key: 'destination', label: 'London', value: 'LHR' },
      { category: 'secondary', key: 'boarding', label: 'Boarding', value: upcoming(7, 17, 40), valueType: 'date', dateStyle: 'PKDateStyleNone', timeStyle: 'PKDateStyleShort' },
      { category: 'secondary', key: 'seat', label: 'Seat', value: '14A' },
      { category: 'secondary', key: 'group', label: 'Group', value: '2' },
      { category: 'auxiliary', key: 'passenger', label: 'Passenger', value: 'Jane Appleseed' },
      { category: 'auxiliary', key: 'class', label: 'Class', value: 'Business' },
      { category: 'back', key: 'baggage', label: 'Baggage', value: 'Two checked bags included. Drop closes 45 minutes before departure.' },
    ],
    barcode: { format: 'PKBarcodeFormatAztec', message: 'PF208-JFK-LHR-14A-K8VX2Q', altText: 'PF 208 · Seat 14A' },
    semantics: {
      airlineCode: 'PF',
      flightCode: 'PF208',
      departureAirportCode: 'JFK',
      destinationAirportCode: 'LHR',
      departureGate: 'B7',
      boardingGroup: '2',
      confirmationNumber: 'K8VX2Q',
      transitStatus: 'On Time',
    },
  },
  {
    id: 'midnight-live',
    name: 'Midnight Live',
    tagline: 'Poster-style concert ticket with seating and an Event Guide-ready venue.',
    glyph: '🎤',
    style: 'eventTicket',
    preferredStyleSchemes: ['posterEventTicket'],
    eventLogoText: 'Midnight Live',
    description: 'Midnight Live concert ticket',
    organizationName: 'Neon Stage Presents',
    logoText: 'Neon Stage',
    colors: { background: '#1c1130', foreground: '#f6f1ff', label: '#b79ce4', footer: '#140b24' },
    fields: [
      { category: 'header', key: 'show', label: 'Show', value: upcoming(30, 20, 0), valueType: 'date', dateStyle: 'PKDateStyleShort', timeStyle: 'PKDateStyleShort' },
      { category: 'primary', key: 'event', label: 'Event', value: 'Midnight Live' },
      { category: 'secondary', key: 'venue', label: 'Venue', value: 'The Grand Hall' },
      { category: 'secondary', key: 'doors', label: 'Doors', value: '7:00 PM' },
      { category: 'auxiliary', key: 'section', label: 'Section', value: '104', row: '0' },
      { category: 'auxiliary', key: 'row', label: 'Row', value: 'B', row: '0' },
      { category: 'auxiliary', key: 'seat', label: 'Seat', value: '12', row: '0' },
      { category: 'back', key: 'entry', label: 'Entry', value: 'Enter through the North Gate. Re-entry allowed with this pass.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'MLIVE-104-B-12-9F27', altText: 'Sec 104 · Row B · Seat 12' },
    semantics: {
      eventName: 'Midnight Live',
      venueName: 'The Grand Hall',
      eventStartDate: upcoming(30, 20, 0),
      eventEndDate: upcoming(30, 23, 0),
      venueEntrance: 'North Gate',
      attendeeName: 'Jane Appleseed',
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    tagline: 'Sunset-toned promo coupon with a bold offer and scannable code.',
    glyph: '🌇',
    style: 'coupon',
    description: 'Golden Hour discount coupon',
    organizationName: 'Golden Hour Café',
    logoText: 'Golden Hour',
    colors: { background: '#a63d10', foreground: '#fff7ed', label: '#fed7aa' },
    fields: [
      { category: 'header', key: 'code', label: 'Code', value: 'GOLD25' },
      { category: 'primary', key: 'offer', label: 'Today 4–7 PM', value: '25% OFF' },
      { category: 'secondary', key: 'ends', label: 'Ends', value: upcoming(14, 19, 0), valueType: 'date', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleNone' },
      { category: 'secondary', key: 'minimum', label: 'Minimum', value: 'None' },
      { category: 'back', key: 'terms', label: 'Terms', value: 'One redemption per visit. Valid on all drinks and pastries. Not combinable with other offers.' },
    ],
    barcode: { format: 'PKBarcodeFormatCode128', message: 'GOLD25-2026', altText: 'GOLD25' },
    semantics: { confirmationNumber: 'GOLD25' },
  },
  {
    id: 'iron-works',
    name: 'Iron Works',
    tagline: 'Graphite gym membership with electric accents and renewal tracking.',
    glyph: '🏋️',
    style: 'generic',
    description: 'Iron Works gym membership',
    organizationName: 'Iron Works Athletics',
    logoText: 'Iron Works',
    colors: { background: '#14181d', foreground: '#f4f6f8', label: '#a3e635' },
    fields: [
      { category: 'header', key: 'status', label: 'Status', value: 'Active' },
      { category: 'primary', key: 'member', label: 'Member', value: 'Jane Appleseed' },
      { category: 'secondary', key: 'plan', label: 'Plan', value: 'Unlimited' },
      { category: 'secondary', key: 'renews', label: 'Renews', value: upcoming(45, 9, 0), valueType: 'date', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleNone' },
      { category: 'auxiliary', key: 'locker', label: 'Locker', value: '217' },
      { category: 'auxiliary', key: 'classes', label: 'Classes', value: 'Included' },
      { category: 'back', key: 'hours', label: 'Hours', value: 'Open 5 AM – 11 PM daily. Staffed hours 8 AM – 8 PM.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'IRON-00217', altText: 'IRON-00217' },
    semantics: { membershipProgramName: 'Iron Works Athletics', membershipProgramNumber: '00217' },
  },
  {
    id: 'reve-cinema',
    name: 'Le Rêve Cinéma',
    tagline: 'Gold-on-midnight movie ticket with showtime, screen, and seat.',
    glyph: '🎬',
    style: 'eventTicket',
    preferredStyleSchemes: ['eventTicket'],
    description: 'Le Rêve Cinéma movie ticket',
    organizationName: 'Le Rêve Cinéma',
    logoText: 'Le Rêve',
    colors: { background: '#141b33', foreground: '#fcf6e5', label: '#d9b45b' },
    fields: [
      { category: 'header', key: 'showtime', label: 'Showtime', value: upcoming(3, 19, 45), valueType: 'date', dateStyle: 'PKDateStyleShort', timeStyle: 'PKDateStyleShort' },
      { category: 'primary', key: 'film', label: 'Film', value: 'The Voyager' },
      { category: 'secondary', key: 'screen', label: 'Screen', value: '4' },
      { category: 'secondary', key: 'seat', label: 'Seat', value: 'J14' },
      { category: 'auxiliary', key: 'format', label: 'Format', value: 'IMAX 70mm' },
      { category: 'auxiliary', key: 'rating', label: 'Rating', value: 'PG-13' },
      { category: 'back', key: 'policy', label: 'Good to know', value: 'Doors open 20 minutes before the showtime. Exchanges up to 2 hours prior.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'CINE-VOY-S4-J14', altText: 'Seat J14' },
    semantics: {
      eventName: 'The Voyager',
      venueName: 'Le Rêve Cinéma',
      eventStartDate: upcoming(3, 19, 45),
      eventEndDate: upcoming(3, 22, 10),
    },
  },
  {
    id: 'coastal-rail',
    name: 'Coastal Rail',
    tagline: 'Evergreen train ticket with coach, seat, and platform updates.',
    glyph: '🚆',
    style: 'boardingPass',
    transitType: 'PKTransitTypeTrain',
    description: 'Coastal Rail train ticket',
    organizationName: 'Coastal Rail',
    logoText: 'Coastal Rail',
    colors: { background: '#0f3d2e', foreground: '#ecfdf5', label: '#6ee7b7' },
    fields: [
      { category: 'header', key: 'train', label: 'Train', value: 'CR 402' },
      { category: 'header', key: 'platform', label: 'Platform', value: '3', changeMessage: 'Platform changed to %@' },
      { category: 'primary', key: 'origin', label: 'Seattle', value: 'SEA' },
      { category: 'primary', key: 'destination', label: 'Portland', value: 'PDX' },
      { category: 'secondary', key: 'departs', label: 'Departs', value: upcoming(10, 8, 15), valueType: 'date', dateStyle: 'PKDateStyleShort', timeStyle: 'PKDateStyleShort' },
      { category: 'secondary', key: 'coach', label: 'Coach', value: '6' },
      { category: 'secondary', key: 'seat', label: 'Seat', value: '22C' },
      { category: 'auxiliary', key: 'passenger', label: 'Passenger', value: 'Jane Appleseed' },
      { category: 'auxiliary', key: 'fare', label: 'Fare', value: 'Business Saver' },
      { category: 'back', key: 'luggage', label: 'Luggage', value: 'Two carry-ons included. Bicycles welcome in coach 1.' },
    ],
    barcode: { format: 'PKBarcodeFormatAztec', message: 'CR402-SEA-PDX-22C-R7Q4TZ', altText: 'CR 402 · Seat 22C' },
    semantics: { confirmationNumber: 'R7Q4TZ', transitStatus: 'On Time' },
  },
  {
    id: 'harbor-museum',
    name: 'Harbor Museum',
    tagline: 'Elegant parchment membership with patron perks and guest passes.',
    glyph: '🏛️',
    style: 'generic',
    description: 'Harbor Museum patron pass',
    organizationName: 'Harbor Museum',
    logoText: 'Harbor Museum',
    colors: { background: '#f4efe6', foreground: '#2f2a21', label: '#9c8b6c' },
    fields: [
      { category: 'header', key: 'tier', label: 'Tier', value: 'Patron' },
      { category: 'primary', key: 'member', label: 'Member', value: 'Jane Appleseed' },
      { category: 'secondary', key: 'valid', label: 'Valid thru', value: upcoming(365, 12, 0), valueType: 'date', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleNone' },
      { category: 'secondary', key: 'guests', label: 'Guests', value: '2' },
      { category: 'auxiliary', key: 'access', label: 'Early access', value: 'Fridays' },
      { category: 'back', key: 'address', label: 'Visit us', value: '123 Harbor Way, Kingsport', dataDetectorTypes: ['PKDataDetectorTypeAddress'] },
      { category: 'back', key: 'benefits', label: 'Patron benefits', value: 'Unlimited admission, exhibition previews, 10% off at the museum shop and café.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'HARBOR-P-5521', altText: 'Patron 5521' },
    semantics: { membershipProgramName: 'Harbor Museum Patrons', membershipProgramNumber: '5521' },
  },
  {
    id: 'bloom-rewards',
    name: 'Bloom Rewards',
    tagline: 'Rosy florist rewards card that counts points toward a free bouquet.',
    glyph: '🌸',
    style: 'storeCard',
    description: 'Bloom Rewards card',
    organizationName: 'Bloom & Petal',
    logoText: 'Bloom & Petal',
    colors: { background: '#8e2a5c', foreground: '#fff1f6', label: '#f5a8c9' },
    fields: [
      { category: 'header', key: 'points', label: 'Points', value: '342', valueType: 'number', numberStyle: 'PKNumberStyleDecimal', changeMessage: 'You now have %@ points' },
      { category: 'primary', key: 'member', label: 'Member', value: 'Jane Appleseed' },
      { category: 'secondary', key: 'tier', label: 'Tier', value: 'Blossom' },
      { category: 'secondary', key: 'reward', label: 'Next reward', value: 'Free bouquet at 500' },
      { category: 'back', key: 'seasonal', label: 'This season', value: 'Peonies and ranunculus are in. Members get first pick on Saturday mornings.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'BLOOM-342-JA', altText: 'Member JA-342' },
    semantics: { membershipProgramName: 'Bloom Rewards', membershipProgramNumber: 'JA-342' },
  },
  {
    id: 'sunday-brunch',
    name: 'Sunday Brunch',
    tagline: 'Playful violet two-for-one voucher for lazy weekend mornings.',
    glyph: '🥞',
    style: 'coupon',
    description: 'Sunday brunch two-for-one voucher',
    organizationName: 'Butter & Sage',
    logoText: 'Butter & Sage',
    colors: { background: '#5b21b6', foreground: '#f5f3ff', label: '#c4b5fd' },
    fields: [
      { category: 'header', key: 'valid', label: 'Valid', value: 'Sundays' },
      { category: 'primary', key: 'offer', label: 'Sunday special', value: '2-for-1 Brunch' },
      { category: 'secondary', key: 'ends', label: 'Ends', value: upcoming(60, 12, 0), valueType: 'date', dateStyle: 'PKDateStyleMedium', timeStyle: 'PKDateStyleNone' },
      { category: 'secondary', key: 'where', label: 'Where', value: 'All locations' },
      { category: 'back', key: 'terms', label: 'Terms', value: 'Second entrée of equal or lesser value is free. Dine-in only, 9 AM – 2 PM.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'BRUNCH-BOGO-2026', altText: 'BRUNCH BOGO' },
    semantics: { confirmationNumber: 'BRUNCH-BOGO' },
  },
];

export function buildTemplateFields(template: PassTemplate): EditableField[] {
  return template.fields.map((field) => ({
    ...newField(field.category),
    key: field.key,
    label: field.label ?? '',
    value: field.value,
    valueType: field.valueType ?? 'text',
    changeMessage: field.changeMessage ?? '',
    textAlignment: field.textAlignment ?? 'unset',
    dateStyle: field.dateStyle ?? 'unset',
    timeStyle: field.timeStyle ?? 'unset',
    numberStyle: field.numberStyle ?? 'unset',
    currencyCode: field.currencyCode ?? '',
    row: field.row ?? 'unset',
    dataDetectorTypes: field.dataDetectorTypes ?? [],
  }));
}

export function buildTemplateBarcodes(template: PassTemplate): EditableBarcode[] {
  if (!template.barcode) return [newBarcode()];
  return [{
    ...newBarcode(),
    format: template.barcode.format,
    message: template.barcode.message,
    altText: template.barcode.altText ?? '',
  }];
}
