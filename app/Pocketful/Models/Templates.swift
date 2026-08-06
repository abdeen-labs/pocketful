// Curated starting points, ported verbatim from src/lib/templates.ts.
// A template fills the design and content surface — style, identity, colors,
// fields, barcode, relevance, semantics, and modern style-specific actions —
// while leaving artwork, NFC, and server settings alone.

import Foundation

struct TemplateField {
    var category: FieldCategory
    var key: String
    var label: String? = nil
    var value: String
    var valueType: FieldValueType = .text
    var changeMessage: String? = nil
    var textAlignment: PassTextAlignment? = nil
    var dateStyle: PassDateStyle? = nil
    var timeStyle: PassDateStyle? = nil
    var numberStyle: PassNumberStyle? = nil
    var currencyCode: String? = nil
    var row: Int? = nil
    var dataDetectorTypes: [DataDetectorType] = []
}

struct TemplateBarcode {
    var format: BarcodeFormat
    var message: String
    var altText: String? = nil
}

struct TemplateColors {
    var background: String
    var foreground: String
    var label: String
    var strip: String? = nil
    var footer: String? = nil
}

struct PassTemplate: Identifiable {
    var id: String
    var name: String
    var tagline: String
    var features: [String] = []
    var glyph: String
    var style: PassStyle
    var transitType: TransitType? = nil
    var preferredStyleSchemes: [PreferredStyleScheme] = []
    var relevantDates: [RelevantDateSpec] = []
    var eventTicketOptions: EventTicketOptions? = nil
    var boardingPassOptions: BoardingPassOptions? = nil
    var description: String
    var organizationName: String
    var logoText: String
    var colors: TemplateColors
    var fields: [TemplateField]
    var barcode: TemplateBarcode? = nil
    var semantics: [String: JSONValue] = [:]
}

enum Templates {
    /// Sample dates stay in the near future relative to whenever the app launches.
    private static func upcoming(_ days: Int, _ hour: Int = 19, _ minute: Int = 0) -> String {
        let calendar = Calendar.current
        let shifted = calendar.date(byAdding: .day, value: days, to: Date()) ?? Date()
        let stamped = calendar.date(bySettingHour: hour, minute: minute, second: 0, of: shifted) ?? shifted
        return ISO8601DateFormatter().string(from: stamped)
    }

    private static let flightBoarding = upcoming(7, 17, 40)
    private static let flightDeparture = upcoming(7, 18, 25)
    private static let flightArrival = upcoming(8, 2, 10)
    private static let concertDoors = upcoming(30, 18, 30)
    private static let concertStart = upcoming(30, 20, 0)
    private static let concertEnd = upcoming(30, 23, 0)
    private static let matchGates = upcoming(21, 17, 0)
    private static let matchStart = upcoming(21, 19, 30)
    private static let matchEnd = upcoming(21, 22, 0)
    private static let movieStart = upcoming(3, 19, 45)
    private static let movieEnd = upcoming(3, 22, 10)

    static let all: [PassTemplate] = [
        PassTemplate(
            id: "espresso-club",
            name: "Espresso Club",
            tagline: "Warm café loyalty card with a live balance and stamp progress.",
            features: ["Live balance", "Membership semantics", "Update messages"],
            glyph: "☕️",
            style: .storeCard,
            description: "Espresso Club loyalty card",
            organizationName: "Espresso Club",
            logoText: "Espresso Club",
            colors: TemplateColors(background: "#31221b", foreground: "#f7efe4", label: "#d3a874"),
            fields: [
                TemplateField(category: .header, key: "balance", label: "Balance", value: "12.50", valueType: .number, changeMessage: "Balance updated to %@", currencyCode: "USD"),
                TemplateField(category: .primary, key: "member", label: "Member", value: "Jane Appleseed"),
                TemplateField(category: .secondary, key: "tier", label: "Tier", value: "Gold"),
                TemplateField(category: .secondary, key: "points", label: "Points", value: "1280", valueType: .number, numberStyle: .decimal),
                TemplateField(category: .auxiliary, key: "reward", label: "Next reward", value: "2 stamps away"),
                TemplateField(category: .back, key: "perks", label: "Gold perks", value: "Free size upgrades, birthday drink, and early access to seasonal roasts."),
                TemplateField(category: .back, key: "contact", label: "Questions?", value: "+1 (212) 555-0139", dataDetectorTypes: [.phoneNumber]),
            ],
            barcode: TemplateBarcode(format: .qr, message: "ESPRESSO-104820", altText: "Member 104820"),
            semantics: [
                "membershipProgramName": "Espresso Club",
                "membershipProgramNumber": "104820",
                "balance": ["amount": "12.50", "currencyCode": "USD"],
            ]
        ),
        PassTemplate(
            id: "skyline-air",
            name: "Skyline Air",
            tagline: "Semantic airline pass with flight tracking, passenger badges, and service actions.",
            features: ["iOS 26 enhanced", "Flight tracking", "Live Activity"],
            glyph: "✈️",
            style: .boardingPass,
            transitType: .air,
            preferredStyleSchemes: [.semanticBoardingPass, .boardingPass],
            relevantDates: [.interval(startDate: flightBoarding, endDate: flightArrival)],
            boardingPassOptions: BoardingPassOptions(
                changeSeatURL: "https://example.com/skyline/manage/seat",
                purchaseAdditionalBaggageURL: "https://example.com/skyline/manage/bags",
                purchaseWifiURL: "https://example.com/skyline/wifi",
                upgradeURL: "https://example.com/skyline/upgrade",
                managementURL: "https://example.com/skyline/manage",
                reportLostBagURL: "https://example.com/skyline/baggage",
                transitProviderEmail: "support@example.com",
                transitProviderPhoneNumber: "+1 800 555 0208",
                transitProviderWebsiteURL: "https://example.com/skyline"
            ),
            description: "Skyline Air boarding pass",
            organizationName: "Skyline Air",
            logoText: "Skyline Air",
            colors: TemplateColors(background: "#0c2d4d", foreground: "#f4f9ff", label: "#93bee8"),
            fields: [
                TemplateField(category: .header, key: "gate", label: "Gate", value: "B7", changeMessage: "Gate changed to %@"),
                TemplateField(category: .header, key: "flight", label: "Flight", value: "PF 208"),
                TemplateField(category: .primary, key: "origin", label: "New York", value: "JFK"),
                TemplateField(category: .primary, key: "destination", label: "London", value: "LHR"),
                TemplateField(category: .secondary, key: "boarding", label: "Boarding", value: flightBoarding, valueType: .date, changeMessage: "Boarding is now at %@", dateStyle: PassDateStyle.none, timeStyle: .short),
                TemplateField(category: .secondary, key: "seat", label: "Seat", value: "14A"),
                TemplateField(category: .secondary, key: "group", label: "Group", value: "2"),
                TemplateField(category: .auxiliary, key: "passenger", label: "Passenger", value: "Jane Appleseed"),
                TemplateField(category: .auxiliary, key: "class", label: "Class", value: "Business"),
                TemplateField(category: .auxiliary, key: "status", label: "Status", value: "Gold · TSA PreCheck"),
                TemplateField(category: .back, key: "baggage", label: "Baggage", value: "Two checked bags included. Drop closes 45 minutes before departure."),
                TemplateField(category: .back, key: "connection", label: "Arrival", value: "Terminal 3 · Follow purple signs for baggage claim."),
                TemplateField(category: .back, key: "support", label: "Day-of-travel support", value: "+1 (800) 555-0208", dataDetectorTypes: [.phoneNumber]),
            ],
            barcode: TemplateBarcode(format: .aztec, message: "PF208-JFK-LHR-14A-K8VX2Q", altText: "PF 208 · Seat 14A"),
            semantics: [
                "airlineCode": "PF",
                "flightCode": "PF208",
                "flightNumber": 208,
                "departureAirportCode": "JFK",
                "departureAirportName": "John F. Kennedy International Airport",
                "departureCityName": "New York",
                "departureLocationTimeZone": "America/New_York",
                "departureLocation": ["latitude": 40.6413, "longitude": -73.7781],
                "destinationAirportCode": "LHR",
                "destinationAirportName": "London Heathrow Airport",
                "destinationCityName": "London",
                "destinationLocationTimeZone": "Europe/London",
                "destinationLocation": ["latitude": 51.47, "longitude": -0.4543],
                "originalBoardingDate": .string(flightBoarding),
                "originalDepartureDate": .string(flightDeparture),
                "originalArrivalDate": .string(flightArrival),
                "passengerName": ["givenName": "Jane", "familyName": "Appleseed"],
                "departureGate": "B7",
                "departureTerminal": "4",
                "destinationTerminal": "3",
                "boardingGroup": "2",
                "boardingSequenceNumber": "042",
                "confirmationNumber": "K8VX2Q",
                "transitProvider": "Skyline Air",
                "transitStatus": "On Time",
                "membershipProgramName": "Skyline Altitude",
                "membershipProgramNumber": "PF-104820",
                "membershipProgramStatus": "Gold",
                "priorityStatus": "Priority",
                "ticketFareClass": "Business",
                "internationalDocumentsAreVerified": true,
                "internationalDocumentsVerifiedDeclarationName": "Travel Ready",
                "passengerEligibleSecurityPrograms": ["PKTransitSecurityProgramTSAPreCheck"],
                "departureLocationSecurityPrograms": ["PKTransitSecurityProgramTSAPreCheck", "PKTransitSecurityProgramCLEAR"],
                "passengerCapabilities": ["PKPassengerCapabilityPriorityBoarding", "PKPassengerCapabilityCarryon", "PKPassengerCapabilityPersonalItem"],
                "seats": [["seatNumber": "14A", "seatRow": "14", "seatType": "Business", "seatDescription": "Window"]],
            ]
        ),
        PassTemplate(
            id: "midnight-live",
            name: "Midnight Live",
            tagline: "A real iOS 18 poster ticket with structured seating, venue context, and Event Guide actions.",
            features: ["iOS 18 poster", "Event Guide", "Bundled artwork"],
            glyph: "🎤",
            style: .eventTicket,
            // The poster scheme requires an entry credential (barcode or VAS/NFC)
            // on top of artwork + semantics — Wallet logs "Pass does not contain
            // VAS or Barcode information" and falls back to the legacy layout
            // without one.
            preferredStyleSchemes: [.posterEventTicket, .eventTicket],
            relevantDates: [.interval(startDate: concertDoors, endDate: concertEnd)],
            eventTicketOptions: EventTicketOptions(
                parkingInformationURL: "https://example.com/midnight-live/parking",
                directionsInformationURL: "https://maps.apple.com/?q=The+Grand+Hall",
                merchandiseURL: "https://example.com/midnight-live/merch",
                accessibilityURL: "https://example.com/midnight-live/accessibility",
                contactVenuePhoneNumber: "+1 212 555 0144",
                contactVenueWebsite: "https://example.com/midnight-live",
                transferURL: "https://example.com/midnight-live/transfer",
                sellURL: "https://example.com/midnight-live/sell",
                suppressHeaderDarkening: true,
                useAutomaticColors: true
            ),
            description: "Midnight Live concert ticket",
            organizationName: "Neon Stage Presents",
            // The bundled wordmark logo carries the brand — logoText would
            // render beside it twice, and eventLogoText would fight the logo
            // and the header date for the poster's top row and get clipped.
            logoText: "",
            colors: TemplateColors(background: "#1c1130", foreground: "#f6f1ff", label: "#b79ce4", footer: "#140b24"),
            fields: [
                TemplateField(category: .header, key: "show", label: "Show", value: concertStart, valueType: .date, dateStyle: .short, timeStyle: .short),
                TemplateField(category: .primary, key: "event", label: "Event", value: "Midnight Live"),
                TemplateField(category: .secondary, key: "venue", label: "Venue", value: "The Grand Hall"),
                TemplateField(category: .secondary, key: "doors", label: "Doors", value: "6:30 PM"),
                TemplateField(category: .auxiliary, key: "section", label: "Section", value: "104", row: 0),
                TemplateField(category: .auxiliary, key: "row", label: "Row", value: "B", row: 0),
                TemplateField(category: .auxiliary, key: "seat", label: "Seat", value: "12", row: 0),
                TemplateField(category: .auxiliary, key: "entry", label: "Entry", value: "North Gate", row: 1),
                TemplateField(category: .additionalInfo, key: "support", label: "Need help?", value: "Visit the Event Guide for directions, accessibility, parking, and ticket actions.", row: 1),
                TemplateField(category: .back, key: "entry-details", label: "Entry details", value: "Enter through the North Gate, Portal 4. Doors open at 6:30 PM. Re-entry is allowed until 9 PM."),
                TemplateField(category: .back, key: "venue-policy", label: "Venue policy", value: "Small bags up to 12 × 6 × 12 inches are permitted. The Grand Hall is a cashless venue."),
                TemplateField(category: .back, key: "support-phone", label: "Venue support", value: "+1 (212) 555-0144", dataDetectorTypes: [.phoneNumber]),
            ],
            // No altText — the poster already prints the seat row, and Wallet
            // truncates the caption under the QR.
            barcode: TemplateBarcode(format: .qr, message: "MIDNIGHT-104-B-12"),
            semantics: [
                "eventType": "PKEventTypeLivePerformance",
                "eventName": "Midnight Live",
                "performerNames": ["Nova Vale", "The Satellites"],
                "genre": "Alternative pop",
                "venueName": "The Grand Hall",
                "venueRegionName": "New York",
                "venueRoom": "Main Arena",
                "venueLocation": ["latitude": 40.7505, "longitude": -73.9934],
                "eventStartDate": .string(concertStart),
                "eventEndDate": .string(concertEnd),
                "eventStartDateInfo": ["date": .string(concertStart), "timeZone": "America/New_York"],
                "venueDoorsOpenDate": .string(concertDoors),
                "venueEntrance": "North Gate · Portal 4",
                "entranceDescription": "Use the North Gate and follow signs to Portal 4.",
                "attendeeName": "Jane Appleseed",
                "admissionLevel": "Reserved seating",
                "admissionLevelAbbreviation": "RSVD",
                "eventLiveMessage": "Doors are open. Head to North Gate · Portal 4.",
                "duration": 10800,
                "silenceRequested": false,
                "seats": [[
                    "seatIdentifier": "104-B-12",
                    "seatSection": "104",
                    "seatRow": "B",
                    "seatNumber": "12",
                    "seatAisle": "Right",
                    "seatLevel": "Lower Bowl",
                    "seatType": "Reserved",
                    "seatDescription": "Aisle seat",
                    "seatSectionColor": "#8b5cf6",
                ]],
            ]
        ),
        PassTemplate(
            id: "harbor-fc",
            name: "Harbor FC",
            tagline: "Match-day poster ticket with team identity, color-coded seating, and stadium guidance.",
            features: ["iOS 18 poster", "Sports semantics", "Event Guide", "Bundled artwork"],
            glyph: "⚽️",
            style: .eventTicket,
            preferredStyleSchemes: [.posterEventTicket, .eventTicket],
            relevantDates: [.interval(startDate: matchGates, endDate: matchEnd)],
            eventTicketOptions: EventTicketOptions(
                orderFoodURL: "https://example.com/harbor-fc/order",
                parkingInformationURL: "https://example.com/harbor-fc/parking",
                directionsInformationURL: "https://maps.apple.com/?q=Harbor+Stadium",
                merchandiseURL: "https://example.com/harbor-fc/shop",
                contactVenueWebsite: "https://example.com/harbor-fc/matchday",
                useAutomaticColors: true
            ),
            description: "Harbor FC match ticket",
            organizationName: "Harbor FC",
            // Same as Midnight Live: the crest wordmark is the brand, so no
            // logoText and no eventLogoText competing for the poster top row.
            logoText: "",
            colors: TemplateColors(background: "#082f49", foreground: "#f0f9ff", label: "#7dd3fc", footer: "#062538"),
            fields: [
                TemplateField(category: .header, key: "kickoff", label: "Kickoff", value: matchStart, valueType: .date, dateStyle: .short, timeStyle: .short),
                TemplateField(category: .primary, key: "match", label: "Match", value: "HBR vs. ATC"),
                TemplateField(category: .secondary, key: "venue", label: "Venue", value: "Harbor Stadium"),
                TemplateField(category: .secondary, key: "gates", label: "Gates open", value: "5:00 PM"),
                TemplateField(category: .auxiliary, key: "section", label: "Section", value: "118", row: 0),
                TemplateField(category: .auxiliary, key: "row", label: "Row", value: "F", row: 0),
                TemplateField(category: .auxiliary, key: "seat", label: "Seat", value: "21", row: 0),
                TemplateField(category: .auxiliary, key: "entrance", label: "Entrance", value: "Blue Gate", row: 1),
                TemplateField(category: .additionalInfo, key: "supporters", label: "Supporters section", value: "Home colors encouraged · Scarves up before kickoff.", row: 1),
                TemplateField(category: .back, key: "matchday", label: "Match-day guide", value: "Blue Gate opens at 5 PM. Food ordering, parking, directions, and team merchandise are available in the Event Guide."),
                TemplateField(category: .back, key: "policy", label: "Stadium policy", value: "Bags must be smaller than 12 × 12 × 6 inches. No outside food or beverages."),
            ],
            // No altText — see Midnight Live.
            barcode: TemplateBarcode(format: .qr, message: "HBR-ATC-118-F-21"),
            semantics: [
                "eventType": "PKEventTypeSports",
                "eventName": "Harbor FC vs. Atlantic City",
                "eventStartDate": .string(matchStart),
                "eventEndDate": .string(matchEnd),
                "eventStartDateInfo": ["date": .string(matchStart), "timeZone": "America/New_York"],
                "venueGatesOpenDate": .string(matchGates),
                "venueName": "Harbor Stadium",
                "venueRegionName": "Kingsport",
                "venueRoom": "Main Pitch",
                "venueLocation": ["latitude": 40.7009, "longitude": -74.0129],
                "venueEntrance": "Blue Gate",
                "entranceDescription": "Use the Blue Gate on Harbor Avenue for section 118.",
                "homeTeamAbbreviation": "HBR",
                "homeTeamName": "Harbor FC",
                "homeTeamLocation": "Kingsport",
                "awayTeamAbbreviation": "ATC",
                "awayTeamName": "Atlantic City",
                "awayTeamLocation": "Atlantic City",
                "leagueAbbreviation": "NPL",
                "leagueName": "National Premier League",
                "sportName": "Soccer",
                "attendeeName": "Jane Appleseed",
                "admissionLevel": "Reserved seating",
                "tailgatingAllowed": true,
                "seats": [[
                    "seatIdentifier": "118-F-21",
                    "seatSection": "118",
                    "seatRow": "F",
                    "seatNumber": "21",
                    // Wallet renders this as the poster's first seat column
                    // (Harbor has no seatAisle) and truncates past ~8 glyphs.
                    "seatLevel": "Lower",
                    "seatType": "Home Supporter",
                    "seatDescription": "Blue section",
                    "seatSectionColor": "#0ea5e9",
                ]],
            ]
        ),
        PassTemplate(
            id: "golden-hour",
            name: "Golden Hour",
            tagline: "Sunset-toned promo coupon with a bold offer and scannable code.",
            features: ["Expiration date", "Offer semantics", "Redemption terms"],
            glyph: "🌇",
            style: .coupon,
            description: "Golden Hour discount coupon",
            organizationName: "Golden Hour Café",
            logoText: "Golden Hour",
            colors: TemplateColors(background: "#a63d10", foreground: "#fff7ed", label: "#fed7aa"),
            fields: [
                TemplateField(category: .header, key: "code", label: "Code", value: "GOLD25"),
                TemplateField(category: .primary, key: "offer", label: "Today 4–7 PM", value: "25% OFF"),
                TemplateField(category: .secondary, key: "ends", label: "Ends", value: upcoming(14, 19, 0), valueType: .date, dateStyle: .medium, timeStyle: PassDateStyle.none),
                TemplateField(category: .secondary, key: "minimum", label: "Minimum", value: "None"),
                TemplateField(category: .back, key: "terms", label: "Terms", value: "One redemption per visit. Valid on all drinks and pastries. Not combinable with other offers."),
            ],
            barcode: TemplateBarcode(format: .code128, message: "GOLD25-2026", altText: "GOLD25"),
            semantics: [
                "confirmationNumber": "GOLD25",
                "additionalTicketAttributes": "Single use · All café locations",
            ]
        ),
        PassTemplate(
            id: "iron-works",
            name: "Iron Works",
            tagline: "Graphite gym membership with electric accents and renewal tracking.",
            features: ["Renewal tracking", "Member access", "Update-ready"],
            glyph: "🏋️",
            style: .generic,
            description: "Iron Works gym membership",
            organizationName: "Iron Works Athletics",
            logoText: "Iron Works",
            colors: TemplateColors(background: "#14181d", foreground: "#f4f6f8", label: "#a3e635"),
            fields: [
                TemplateField(category: .header, key: "status", label: "Status", value: "Active"),
                TemplateField(category: .primary, key: "member", label: "Member", value: "Jane Appleseed"),
                TemplateField(category: .secondary, key: "plan", label: "Plan", value: "Unlimited"),
                TemplateField(category: .secondary, key: "renews", label: "Renews", value: upcoming(45, 9, 0), valueType: .date, dateStyle: .medium, timeStyle: PassDateStyle.none),
                TemplateField(category: .auxiliary, key: "locker", label: "Locker", value: "217"),
                TemplateField(category: .auxiliary, key: "classes", label: "Classes", value: "Included"),
                TemplateField(category: .back, key: "hours", label: "Hours", value: "Open 5 AM – 11 PM daily. Staffed hours 8 AM – 8 PM."),
            ],
            barcode: TemplateBarcode(format: .qr, message: "IRON-00217", altText: "IRON-00217"),
            semantics: [
                "membershipProgramName": "Iron Works Athletics",
                "membershipProgramNumber": "00217",
                "admissionLevel": "Unlimited access",
            ]
        ),
        PassTemplate(
            id: "reve-cinema",
            name: "Le Rêve Cinéma",
            tagline: "A detailed classic movie ticket with focus suggestions, duration, venue, and structured seating.",
            features: ["Movie semantics", "Focus suggestion", "Relevant interval"],
            glyph: "🎬",
            style: .eventTicket,
            preferredStyleSchemes: [.eventTicket],
            relevantDates: [.interval(startDate: movieStart, endDate: movieEnd)],
            description: "Le Rêve Cinéma movie ticket",
            organizationName: "Le Rêve Cinéma",
            logoText: "Le Rêve",
            colors: TemplateColors(background: "#141b33", foreground: "#fcf6e5", label: "#d9b45b"),
            fields: [
                TemplateField(category: .header, key: "showtime", label: "Showtime", value: movieStart, valueType: .date, dateStyle: .short, timeStyle: .short),
                TemplateField(category: .primary, key: "film", label: "Film", value: "The Voyager"),
                TemplateField(category: .secondary, key: "screen", label: "Screen", value: "4"),
                TemplateField(category: .secondary, key: "seat", label: "Seat", value: "J14"),
                TemplateField(category: .auxiliary, key: "format", label: "Format", value: "IMAX 70mm"),
                TemplateField(category: .auxiliary, key: "rating", label: "Rating", value: "PG-13"),
                TemplateField(category: .auxiliary, key: "admission", label: "Admission", value: "Adult"),
                TemplateField(category: .back, key: "policy", label: "Good to know", value: "Doors open 20 minutes before the showtime. Exchanges up to 2 hours prior."),
                TemplateField(category: .back, key: "concessions", label: "Concessions", value: "Order ahead in the Le Rêve app and collect from the express counter beside Screen 4."),
            ],
            barcode: TemplateBarcode(format: .qr, message: "CINE-VOY-S4-J14", altText: "Seat J14"),
            semantics: [
                "eventName": "The Voyager",
                "eventType": "PKEventTypeMovie",
                "venueName": "Le Rêve Cinéma",
                "venueRegionName": "New York",
                "venueRoom": "Screen 4",
                "venueLocation": ["latitude": 40.7411, "longitude": -73.9897],
                "eventStartDate": .string(movieStart),
                "eventEndDate": .string(movieEnd),
                "duration": 8700,
                "attendeeName": "Jane Appleseed",
                "admissionLevel": "Adult",
                "silenceRequested": true,
                "seats": [["seatIdentifier": "4-J-14", "seatSection": "Screen 4", "seatRow": "J", "seatNumber": "14", "seatType": "Recliner", "seatDescription": "Center"]],
            ]
        ),
        PassTemplate(
            id: "coastal-rail",
            name: "Coastal Rail",
            tagline: "Evergreen train ticket with coach, seat, and platform updates.",
            features: ["Journey semantics", "Platform updates", "Relevant date"],
            glyph: "🚆",
            style: .boardingPass,
            transitType: .train,
            relevantDates: [.date(upcoming(10, 8, 15))],
            description: "Coastal Rail train ticket",
            organizationName: "Coastal Rail",
            logoText: "Coastal Rail",
            colors: TemplateColors(background: "#0f3d2e", foreground: "#ecfdf5", label: "#6ee7b7"),
            fields: [
                TemplateField(category: .header, key: "train", label: "Train", value: "CR 402"),
                TemplateField(category: .header, key: "platform", label: "Platform", value: "3", changeMessage: "Platform changed to %@"),
                TemplateField(category: .primary, key: "origin", label: "Seattle", value: "SEA"),
                TemplateField(category: .primary, key: "destination", label: "Portland", value: "PDX"),
                TemplateField(category: .secondary, key: "departs", label: "Departs", value: upcoming(10, 8, 15), valueType: .date, dateStyle: .short, timeStyle: .short),
                TemplateField(category: .secondary, key: "coach", label: "Coach", value: "6"),
                TemplateField(category: .secondary, key: "seat", label: "Seat", value: "22C"),
                TemplateField(category: .auxiliary, key: "passenger", label: "Passenger", value: "Jane Appleseed"),
                TemplateField(category: .auxiliary, key: "fare", label: "Fare", value: "Business Saver"),
                TemplateField(category: .back, key: "luggage", label: "Luggage", value: "Two carry-ons included. Bicycles welcome in coach 1."),
            ],
            barcode: TemplateBarcode(format: .aztec, message: "CR402-SEA-PDX-22C-R7Q4TZ", altText: "CR 402 · Seat 22C"),
            semantics: [
                "confirmationNumber": "R7Q4TZ",
                "transitProvider": "Coastal Rail",
                "transitStatus": "On Time",
                "departureStationName": "King Street Station",
                "departurePlatform": "3",
                "destinationStationName": "Portland Union Station",
                "destinationPlatform": "5",
                "passengerName": ["givenName": "Jane", "familyName": "Appleseed"],
                "carNumber": "6",
                "seats": [["seatNumber": "22C", "seatType": "Business Saver", "seatDescription": "Window"]],
            ]
        ),
        PassTemplate(
            id: "harbor-museum",
            name: "Harbor Museum",
            tagline: "Elegant parchment membership with patron perks and guest passes.",
            features: ["Patron tier", "Guest allowance", "Detected address"],
            glyph: "🏛️",
            style: .generic,
            description: "Harbor Museum patron pass",
            organizationName: "Harbor Museum",
            logoText: "Harbor Museum",
            colors: TemplateColors(background: "#f4efe6", foreground: "#2f2a21", label: "#9c8b6c"),
            fields: [
                TemplateField(category: .header, key: "tier", label: "Tier", value: "Patron"),
                TemplateField(category: .primary, key: "member", label: "Member", value: "Jane Appleseed"),
                TemplateField(category: .secondary, key: "valid", label: "Valid thru", value: upcoming(365, 12, 0), valueType: .date, dateStyle: .medium, timeStyle: PassDateStyle.none),
                TemplateField(category: .secondary, key: "guests", label: "Guests", value: "2"),
                TemplateField(category: .auxiliary, key: "access", label: "Early access", value: "Fridays"),
                TemplateField(category: .back, key: "address", label: "Visit us", value: "123 Harbor Way, Kingsport", dataDetectorTypes: [.address]),
                TemplateField(category: .back, key: "benefits", label: "Patron benefits", value: "Unlimited admission, exhibition previews, 10% off at the museum shop and café."),
            ],
            barcode: TemplateBarcode(format: .qr, message: "HARBOR-P-5521", altText: "Patron 5521"),
            semantics: [
                "membershipProgramName": "Harbor Museum Patrons",
                "membershipProgramNumber": "5521",
            ]
        ),
        PassTemplate(
            id: "bloom-rewards",
            name: "Bloom Rewards",
            tagline: "Rosy florist rewards card that counts points toward a free bouquet.",
            features: ["Points updates", "Reward progress", "Membership semantics"],
            glyph: "🌸",
            style: .storeCard,
            description: "Bloom Rewards card",
            organizationName: "Bloom & Petal",
            logoText: "Bloom & Petal",
            colors: TemplateColors(background: "#8e2a5c", foreground: "#fff1f6", label: "#f5a8c9"),
            fields: [
                TemplateField(category: .header, key: "points", label: "Points", value: "342", valueType: .number, changeMessage: "You now have %@ points", numberStyle: .decimal),
                TemplateField(category: .primary, key: "member", label: "Member", value: "Jane Appleseed"),
                TemplateField(category: .secondary, key: "tier", label: "Tier", value: "Blossom"),
                TemplateField(category: .secondary, key: "reward", label: "Next reward", value: "Free bouquet at 500"),
                TemplateField(category: .back, key: "seasonal", label: "This season", value: "Peonies and ranunculus are in. Members get first pick on Saturday mornings."),
            ],
            barcode: TemplateBarcode(format: .qr, message: "BLOOM-342-JA", altText: "Member JA-342"),
            semantics: [
                "membershipProgramName": "Bloom Rewards",
                "membershipProgramNumber": "JA-342",
            ]
        ),
        PassTemplate(
            id: "sunday-brunch",
            name: "Sunday Brunch",
            tagline: "Playful violet two-for-one voucher for lazy weekend mornings.",
            features: ["Offer terms", "Validity window", "Single-use code"],
            glyph: "🥞",
            style: .coupon,
            description: "Sunday brunch two-for-one voucher",
            organizationName: "Butter & Sage",
            logoText: "Butter & Sage",
            colors: TemplateColors(background: "#5b21b6", foreground: "#f5f3ff", label: "#c4b5fd"),
            fields: [
                TemplateField(category: .header, key: "valid", label: "Valid", value: "Sundays"),
                TemplateField(category: .primary, key: "offer", label: "Sunday special", value: "2-for-1 Brunch"),
                TemplateField(category: .secondary, key: "ends", label: "Ends", value: upcoming(60, 12, 0), valueType: .date, dateStyle: .medium, timeStyle: PassDateStyle.none),
                TemplateField(category: .secondary, key: "where", label: "Where", value: "All locations"),
                TemplateField(category: .back, key: "terms", label: "Terms", value: "Second entrée of equal or lesser value is free. Dine-in only, 9 AM – 2 PM."),
            ],
            barcode: TemplateBarcode(format: .qr, message: "BRUNCH-BOGO-2026", altText: "BRUNCH BOGO"),
            semantics: [
                "confirmationNumber": "BRUNCH-BOGO",
            ]
        ),
    ]

    // MARK: - Editor seeding

    static func buildFields(_ template: PassTemplate) -> [EditableField] {
        template.fields.map { field in
            var editable = EditableField()
            editable.category = field.category
            editable.key = field.key
            editable.label = field.label ?? ""
            editable.value = field.value
            editable.valueType = field.valueType
            editable.changeMessage = field.changeMessage ?? ""
            editable.textAlignment = field.textAlignment
            editable.dateStyle = field.dateStyle
            editable.timeStyle = field.timeStyle
            editable.numberStyle = field.numberStyle
            editable.currencyCode = field.currencyCode ?? ""
            editable.row = field.row
            editable.dataDetectorTypes = field.dataDetectorTypes
            return editable
        }
    }

    static func buildBarcodes(_ template: PassTemplate) -> [EditableBarcode] {
        guard let barcode = template.barcode else { return [EditableBarcode()] }
        var editable = EditableBarcode()
        editable.format = barcode.format
        editable.message = barcode.message
        editable.altText = barcode.altText ?? ""
        return [editable]
    }

    static func buildRelevantDates(_ template: PassTemplate) -> [EditableRelevantDate] {
        template.relevantDates.map { entry in
            var editable = EditableRelevantDate()
            switch entry {
            case .date(let date):
                editable.kind = .date
                editable.date = date
            case .interval(let startDate, let endDate):
                editable.kind = .interval
                editable.startDate = startDate
                editable.endDate = endDate
            }
            return editable
        }
    }
}
