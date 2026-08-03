import { newBarcode, newRelevantDate, type EditableBarcode, type EditableRelevantDate } from '@/components/CollectionEditors';
import { newField, type EditableField } from '@/components/FieldsEditor';
import type {
  BarcodeFormat,
  BoardingPassOptions,
  DataDetectorType,
  DateStyle,
  EventTicketOptions,
  FieldCategory,
  JsonObject,
  NumberStyle,
  PassStyle,
  PreferredStyleScheme,
  RelevantDateSpec,
  TextAlignment,
  TransitType,
} from '@/types';

// Curated starting points. A template fills the design and content surface —
// style, identity, colors, fields, barcode, relevance, semantics, and modern
// style-specific actions — while leaving artwork, NFC, and server settings alone.

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
  features?: string[];
  glyph: string;
  style: PassStyle;
  transitType?: TransitType;
  preferredStyleSchemes?: PreferredStyleScheme[];
  relevantDates?: RelevantDateSpec[];
  eventTicketOptions?: EventTicketOptions;
  boardingPassOptions?: BoardingPassOptions;
  description: string;
  organizationName: string;
  logoText: string;
  colors: { background: string; foreground: string; label: string; strip?: string; footer?: string };
  fields: TemplateField[];
  barcode?: { format: BarcodeFormat; message: string; altText?: string };
  semantics?: JsonObject;
  eventLogoText?: string;
}

// Sample dates stay in the near future relative to whenever the app launches.
function upcoming(days: number, hour = 19, minute = 0): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  date.setHours(hour, minute, 0, 0);
  return date.toISOString();
}

const SAMPLE_DATES = {
  flightBoarding: upcoming(7, 17, 40),
  flightDeparture: upcoming(7, 18, 25),
  flightArrival: upcoming(8, 2, 10),
  concertDoors: upcoming(30, 18, 30),
  concertStart: upcoming(30, 20, 0),
  concertEnd: upcoming(30, 23, 0),
  matchGates: upcoming(21, 17, 0),
  matchStart: upcoming(21, 19, 30),
  matchEnd: upcoming(21, 22, 0),
  movieStart: upcoming(3, 19, 45),
  movieEnd: upcoming(3, 22, 10),
};

export const TEMPLATES: PassTemplate[] = [
  {
    id: 'espresso-club',
    name: 'Espresso Club',
    tagline: 'Warm café loyalty card with a live balance and stamp progress.',
    features: ['Live balance', 'Membership semantics', 'Update messages'],
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
    semantics: {
      membershipProgramName: 'Espresso Club',
      membershipProgramNumber: '104820',
      balance: { amount: '12.50', currencyCode: 'USD' },
    },
  },
  {
    id: 'skyline-air',
    name: 'Skyline Air',
    tagline: 'Semantic airline pass with flight tracking, passenger badges, and service actions.',
    features: ['iOS 26 enhanced', 'Flight tracking', 'Live Activity'],
    glyph: '✈️',
    style: 'boardingPass',
    transitType: 'PKTransitTypeAir',
    preferredStyleSchemes: ['semanticBoardingPass', 'boardingPass'],
    relevantDates: [{ startDate: SAMPLE_DATES.flightBoarding, endDate: SAMPLE_DATES.flightArrival }],
    boardingPassOptions: {
      changeSeatURL: 'https://example.com/skyline/manage/seat',
      purchaseAdditionalBaggageURL: 'https://example.com/skyline/manage/bags',
      purchaseWifiURL: 'https://example.com/skyline/wifi',
      upgradeURL: 'https://example.com/skyline/upgrade',
      managementURL: 'https://example.com/skyline/manage',
      reportLostBagURL: 'https://example.com/skyline/baggage',
      transitProviderEmail: 'support@example.com',
      transitProviderPhoneNumber: '+1 800 555 0208',
      transitProviderWebsiteURL: 'https://example.com/skyline',
    },
    description: 'Skyline Air boarding pass',
    organizationName: 'Skyline Air',
    logoText: 'Skyline Air',
    colors: { background: '#0c2d4d', foreground: '#f4f9ff', label: '#93bee8' },
    fields: [
      { category: 'header', key: 'gate', label: 'Gate', value: 'B7', changeMessage: 'Gate changed to %@' },
      { category: 'header', key: 'flight', label: 'Flight', value: 'PF 208' },
      { category: 'primary', key: 'origin', label: 'New York', value: 'JFK' },
      { category: 'primary', key: 'destination', label: 'London', value: 'LHR' },
      { category: 'secondary', key: 'boarding', label: 'Boarding', value: SAMPLE_DATES.flightBoarding, valueType: 'date', dateStyle: 'PKDateStyleNone', timeStyle: 'PKDateStyleShort', changeMessage: 'Boarding is now at %@' },
      { category: 'secondary', key: 'seat', label: 'Seat', value: '14A' },
      { category: 'secondary', key: 'group', label: 'Group', value: '2' },
      { category: 'auxiliary', key: 'passenger', label: 'Passenger', value: 'Jane Appleseed' },
      { category: 'auxiliary', key: 'class', label: 'Class', value: 'Business' },
      { category: 'auxiliary', key: 'status', label: 'Status', value: 'Gold · TSA PreCheck' },
      { category: 'back', key: 'baggage', label: 'Baggage', value: 'Two checked bags included. Drop closes 45 minutes before departure.' },
      { category: 'back', key: 'connection', label: 'Arrival', value: 'Terminal 3 · Follow purple signs for baggage claim.' },
      { category: 'back', key: 'support', label: 'Day-of-travel support', value: '+1 (800) 555-0208', dataDetectorTypes: ['PKDataDetectorTypePhoneNumber'] },
    ],
    barcode: { format: 'PKBarcodeFormatAztec', message: 'PF208-JFK-LHR-14A-K8VX2Q', altText: 'PF 208 · Seat 14A' },
    semantics: {
      airlineCode: 'PF',
      flightCode: 'PF208',
      flightNumber: 208,
      departureAirportCode: 'JFK',
      departureAirportName: 'John F. Kennedy International Airport',
      departureCityName: 'New York',
      departureLocationTimeZone: 'America/New_York',
      departureLocation: { latitude: 40.6413, longitude: -73.7781 },
      destinationAirportCode: 'LHR',
      destinationAirportName: 'London Heathrow Airport',
      destinationCityName: 'London',
      destinationLocationTimeZone: 'Europe/London',
      destinationLocation: { latitude: 51.47, longitude: -0.4543 },
      originalBoardingDate: SAMPLE_DATES.flightBoarding,
      originalDepartureDate: SAMPLE_DATES.flightDeparture,
      originalArrivalDate: SAMPLE_DATES.flightArrival,
      passengerName: { givenName: 'Jane', familyName: 'Appleseed' },
      departureGate: 'B7',
      departureTerminal: '4',
      destinationTerminal: '3',
      boardingGroup: '2',
      boardingSequenceNumber: '042',
      confirmationNumber: 'K8VX2Q',
      transitProvider: 'Skyline Air',
      transitStatus: 'On Time',
      membershipProgramName: 'Skyline Altitude',
      membershipProgramNumber: 'PF-104820',
      membershipProgramStatus: 'Gold',
      priorityStatus: 'Priority',
      ticketFareClass: 'Business',
      internationalDocumentsAreVerified: true,
      internationalDocumentsVerifiedDeclarationName: 'Travel Ready',
      passengerEligibleSecurityPrograms: ['PKTransitSecurityProgramTSAPreCheck'],
      departureLocationSecurityPrograms: ['PKTransitSecurityProgramTSAPreCheck', 'PKTransitSecurityProgramCLEAR'],
      passengerCapabilities: ['PKPassengerCapabilityPriorityBoarding', 'PKPassengerCapabilityCarryon', 'PKPassengerCapabilityPersonalItem'],
      seats: [{ seatNumber: '14A', seatRow: '14', seatType: 'Business', seatDescription: 'Window' }],
    },
  },
  {
    id: 'midnight-live',
    name: 'Midnight Live',
    tagline: 'A real iOS 18 poster ticket with structured seating, venue context, and Event Guide actions.',
    features: ['iOS 18 poster', 'Event Guide', 'Live Activity', 'Bundled photo artwork'],
    glyph: '🎤',
    style: 'eventTicket',
    preferredStyleSchemes: ['posterEventTicket', 'eventTicket'],
    relevantDates: [{ startDate: SAMPLE_DATES.concertDoors, endDate: SAMPLE_DATES.concertEnd }],
    eventTicketOptions: {
      directionsInformationURL: 'https://maps.apple.com/?q=The+Grand+Hall',
      parkingInformationURL: 'https://example.com/midnight-live/parking',
      merchandiseURL: 'https://example.com/midnight-live/merch',
      accessibilityURL: 'https://example.com/midnight-live/accessibility',
      contactVenuePhoneNumber: '+1 212 555 0144',
      contactVenueWebsite: 'https://example.com/midnight-live',
      transferURL: 'https://example.com/midnight-live/transfer',
      sellURL: 'https://example.com/midnight-live/sell',
      suppressHeaderDarkening: true,
      useAutomaticColors: true,
      eventLogoText: 'MIDNIGHT LIVE',
    },
    eventLogoText: 'Midnight Live',
    description: 'Midnight Live concert ticket',
    organizationName: 'Neon Stage Presents',
    logoText: 'Neon Stage',
    colors: { background: '#1c1130', foreground: '#f6f1ff', label: '#b79ce4', footer: '#140b24' },
    fields: [
      { category: 'header', key: 'show', label: 'Show', value: SAMPLE_DATES.concertStart, valueType: 'date', dateStyle: 'PKDateStyleShort', timeStyle: 'PKDateStyleShort' },
      { category: 'primary', key: 'event', label: 'Event', value: 'Midnight Live' },
      { category: 'secondary', key: 'venue', label: 'Venue', value: 'The Grand Hall' },
      { category: 'secondary', key: 'doors', label: 'Doors', value: '6:30 PM' },
      { category: 'auxiliary', key: 'section', label: 'Section', value: '104', row: '0' },
      { category: 'auxiliary', key: 'row', label: 'Row', value: 'B', row: '0' },
      { category: 'auxiliary', key: 'seat', label: 'Seat', value: '12', row: '0' },
      { category: 'auxiliary', key: 'entry', label: 'Entry', value: 'North Gate', row: '1' },
      { category: 'additionalInfo', key: 'support', label: 'Need help?', value: 'Visit the Event Guide for directions, accessibility, parking, and ticket actions.', row: '1' },
      { category: 'back', key: 'entry-details', label: 'Entry details', value: 'Enter through the North Gate, Portal 4. Doors open at 6:30 PM. Re-entry is allowed until 9 PM.' },
      { category: 'back', key: 'venue-policy', label: 'Venue policy', value: 'Small bags up to 12 × 6 × 12 inches are permitted. The Grand Hall is a cashless venue.' },
      { category: 'back', key: 'support-phone', label: 'Venue support', value: '+1 (212) 555-0144', dataDetectorTypes: ['PKDataDetectorTypePhoneNumber'] },
      { category: 'back', key: 'artwork-credit', label: 'Artwork credit', value: 'Photo by Aleksandr Popov on Unsplash · https://unsplash.com/photos/3InMDrsuYrk', dataDetectorTypes: ['PKDataDetectorTypeLink'] },
    ],
    semantics: {
      eventType: 'PKEventTypeLivePerformance',
      eventName: 'Midnight Live',
      performerNames: ['Nova Vale', 'The Satellites'],
      genre: 'Alternative pop',
      venueName: 'The Grand Hall',
      venueRegionName: 'New York',
      venueRoom: 'Main Arena',
      venueLocation: { latitude: 40.7505, longitude: -73.9934 },
      eventStartDate: SAMPLE_DATES.concertStart,
      eventEndDate: SAMPLE_DATES.concertEnd,
      eventStartDateInfo: { date: SAMPLE_DATES.concertStart, timeZone: 'America/New_York' },
      venueDoorsOpenDate: SAMPLE_DATES.concertDoors,
      venueEntrance: 'North Gate · Portal 4',
      entranceDescription: 'Use the North Gate and follow signs to Portal 4.',
      attendeeName: 'Jane Appleseed',
      admissionLevel: 'Reserved seating',
      admissionLevelAbbreviation: 'RSVD',
      eventLiveMessage: 'Doors are open. Head to North Gate · Portal 4.',
      duration: 10800,
      silenceRequested: false,
      seats: [{
        seatIdentifier: '104-B-12',
        seatSection: '104',
        seatRow: 'B',
        seatNumber: '12',
        seatAisle: 'Right',
        seatLevel: 'Lower Bowl',
        seatType: 'Reserved',
        seatDescription: 'Aisle seat',
        seatSectionColor: '#8b5cf6',
      }],
    },
  },
  {
    id: 'harbor-fc',
    name: 'Harbor FC',
    tagline: 'Match-day poster ticket with team identity, color-coded seating, and stadium guidance.',
    features: ['iOS 18 poster', 'Sports semantics', 'Event Guide', 'Bundled photo artwork'],
    glyph: '⚽️',
    style: 'eventTicket',
    preferredStyleSchemes: ['posterEventTicket', 'eventTicket'],
    relevantDates: [{ startDate: SAMPLE_DATES.matchGates, endDate: SAMPLE_DATES.matchEnd }],
    eventTicketOptions: {
      directionsInformationURL: 'https://maps.apple.com/?q=Harbor+Stadium',
      parkingInformationURL: 'https://example.com/harbor-fc/parking',
      orderFoodURL: 'https://example.com/harbor-fc/order',
      merchandiseURL: 'https://example.com/harbor-fc/shop',
      contactVenueWebsite: 'https://example.com/harbor-fc/matchday',
      useAutomaticColors: true,
      eventLogoText: 'HARBOR FC',
    },
    eventLogoText: 'Harbor FC',
    description: 'Harbor FC match ticket',
    organizationName: 'Harbor FC',
    logoText: 'Harbor FC',
    colors: { background: '#082f49', foreground: '#f0f9ff', label: '#7dd3fc', footer: '#062538' },
    fields: [
      { category: 'header', key: 'kickoff', label: 'Kickoff', value: SAMPLE_DATES.matchStart, valueType: 'date', dateStyle: 'PKDateStyleShort', timeStyle: 'PKDateStyleShort' },
      { category: 'primary', key: 'match', label: 'Match', value: 'HBR vs. ATC' },
      { category: 'secondary', key: 'venue', label: 'Venue', value: 'Harbor Stadium' },
      { category: 'secondary', key: 'gates', label: 'Gates open', value: '5:00 PM' },
      { category: 'auxiliary', key: 'section', label: 'Section', value: '118', row: '0' },
      { category: 'auxiliary', key: 'row', label: 'Row', value: 'F', row: '0' },
      { category: 'auxiliary', key: 'seat', label: 'Seat', value: '21', row: '0' },
      { category: 'auxiliary', key: 'entrance', label: 'Entrance', value: 'Blue Gate', row: '1' },
      { category: 'additionalInfo', key: 'supporters', label: 'Supporters section', value: 'Home colors encouraged · Scarves up before kickoff.', row: '1' },
      { category: 'back', key: 'matchday', label: 'Match-day guide', value: 'Blue Gate opens at 5 PM. Food ordering, parking, directions, and team merchandise are available in the Event Guide.' },
      { category: 'back', key: 'policy', label: 'Stadium policy', value: 'Bags must be smaller than 12 × 12 × 6 inches. No outside food or beverages.' },
      { category: 'back', key: 'artwork-credit', label: 'Artwork credit', value: 'Photo by Vienna Reyes on Unsplash · https://unsplash.com/photos/qCrKTET_09o', dataDetectorTypes: ['PKDataDetectorTypeLink'] },
    ],
    semantics: {
      eventType: 'PKEventTypeSports',
      eventName: 'Harbor FC vs. Atlantic City',
      eventStartDate: SAMPLE_DATES.matchStart,
      eventEndDate: SAMPLE_DATES.matchEnd,
      eventStartDateInfo: { date: SAMPLE_DATES.matchStart, timeZone: 'America/New_York' },
      venueGatesOpenDate: SAMPLE_DATES.matchGates,
      venueName: 'Harbor Stadium',
      venueRegionName: 'Kingsport',
      venueRoom: 'Main Pitch',
      venueLocation: { latitude: 40.7009, longitude: -74.0129 },
      venueEntrance: 'Blue Gate',
      entranceDescription: 'Use the Blue Gate on Harbor Avenue for section 118.',
      homeTeamAbbreviation: 'HBR',
      homeTeamName: 'Harbor FC',
      homeTeamLocation: 'Kingsport',
      awayTeamAbbreviation: 'ATC',
      awayTeamName: 'Atlantic City',
      awayTeamLocation: 'Atlantic City',
      leagueAbbreviation: 'NPL',
      leagueName: 'National Premier League',
      sportName: 'Soccer',
      attendeeName: 'Jane Appleseed',
      admissionLevel: 'Reserved seating',
      tailgatingAllowed: true,
      seats: [{
        seatIdentifier: '118-F-21',
        seatSection: '118',
        seatRow: 'F',
        seatNumber: '21',
        seatLevel: 'Lower Stand',
        seatType: 'Home Supporter',
        seatDescription: 'Blue section',
        seatSectionColor: '#0ea5e9',
      }],
    },
  },
  {
    id: 'golden-hour',
    name: 'Golden Hour',
    tagline: 'Sunset-toned promo coupon with a bold offer and scannable code.',
    features: ['Expiration date', 'Offer semantics', 'Redemption terms'],
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
    semantics: { confirmationNumber: 'GOLD25', additionalTicketAttributes: 'Single use · All café locations' },
  },
  {
    id: 'iron-works',
    name: 'Iron Works',
    tagline: 'Graphite gym membership with electric accents and renewal tracking.',
    features: ['Renewal tracking', 'Member access', 'Update-ready'],
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
    semantics: { membershipProgramName: 'Iron Works Athletics', membershipProgramNumber: '00217', admissionLevel: 'Unlimited access' },
  },
  {
    id: 'reve-cinema',
    name: 'Le Rêve Cinéma',
    tagline: 'A detailed classic movie ticket with focus suggestions, duration, venue, and structured seating.',
    features: ['Movie semantics', 'Focus suggestion', 'Relevant interval'],
    glyph: '🎬',
    style: 'eventTicket',
    preferredStyleSchemes: ['eventTicket'],
    relevantDates: [{ startDate: SAMPLE_DATES.movieStart, endDate: SAMPLE_DATES.movieEnd }],
    description: 'Le Rêve Cinéma movie ticket',
    organizationName: 'Le Rêve Cinéma',
    logoText: 'Le Rêve',
    colors: { background: '#141b33', foreground: '#fcf6e5', label: '#d9b45b' },
    fields: [
      { category: 'header', key: 'showtime', label: 'Showtime', value: SAMPLE_DATES.movieStart, valueType: 'date', dateStyle: 'PKDateStyleShort', timeStyle: 'PKDateStyleShort' },
      { category: 'primary', key: 'film', label: 'Film', value: 'The Voyager' },
      { category: 'secondary', key: 'screen', label: 'Screen', value: '4' },
      { category: 'secondary', key: 'seat', label: 'Seat', value: 'J14' },
      { category: 'auxiliary', key: 'format', label: 'Format', value: 'IMAX 70mm' },
      { category: 'auxiliary', key: 'rating', label: 'Rating', value: 'PG-13' },
      { category: 'auxiliary', key: 'admission', label: 'Admission', value: 'Adult' },
      { category: 'back', key: 'policy', label: 'Good to know', value: 'Doors open 20 minutes before the showtime. Exchanges up to 2 hours prior.' },
      { category: 'back', key: 'concessions', label: 'Concessions', value: 'Order ahead in the Le Rêve app and collect from the express counter beside Screen 4.' },
    ],
    barcode: { format: 'PKBarcodeFormatQR', message: 'CINE-VOY-S4-J14', altText: 'Seat J14' },
    semantics: {
      eventName: 'The Voyager',
      eventType: 'PKEventTypeMovie',
      venueName: 'Le Rêve Cinéma',
      venueRegionName: 'New York',
      venueRoom: 'Screen 4',
      venueLocation: { latitude: 40.7411, longitude: -73.9897 },
      eventStartDate: SAMPLE_DATES.movieStart,
      eventEndDate: SAMPLE_DATES.movieEnd,
      duration: 8700,
      attendeeName: 'Jane Appleseed',
      admissionLevel: 'Adult',
      silenceRequested: true,
      seats: [{ seatIdentifier: '4-J-14', seatSection: 'Screen 4', seatRow: 'J', seatNumber: '14', seatType: 'Recliner', seatDescription: 'Center' }],
    },
  },
  {
    id: 'coastal-rail',
    name: 'Coastal Rail',
    tagline: 'Evergreen train ticket with coach, seat, and platform updates.',
    features: ['Journey semantics', 'Platform updates', 'Relevant date'],
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
    relevantDates: [{ date: upcoming(10, 8, 15) }],
    semantics: {
      confirmationNumber: 'R7Q4TZ',
      transitProvider: 'Coastal Rail',
      transitStatus: 'On Time',
      departureStationName: 'King Street Station',
      departurePlatform: '3',
      destinationStationName: 'Portland Union Station',
      destinationPlatform: '5',
      passengerName: { givenName: 'Jane', familyName: 'Appleseed' },
      carNumber: '6',
      seats: [{ seatNumber: '22C', seatType: 'Business Saver', seatDescription: 'Window' }],
    },
  },
  {
    id: 'harbor-museum',
    name: 'Harbor Museum',
    tagline: 'Elegant parchment membership with patron perks and guest passes.',
    features: ['Patron tier', 'Guest allowance', 'Detected address'],
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
    features: ['Points updates', 'Reward progress', 'Membership semantics'],
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
    features: ['Offer terms', 'Validity window', 'Single-use code'],
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

export function buildTemplateRelevantDates(template: PassTemplate): EditableRelevantDate[] {
  return (template.relevantDates ?? []).map((entry) => {
    if ('date' in entry) {
      return { ...newRelevantDate(), kind: 'date', date: entry.date };
    }
    return {
      ...newRelevantDate(),
      kind: 'interval',
      startDate: entry.startDate,
      endDate: entry.endDate,
    };
  });
}
