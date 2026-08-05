// Pass spec accepted by the server. Mirrors server/src/types.ts — keep in
// sync by hand, there is deliberately no shared package. Every optional
// property encodes only when set (synthesized Codable uses encodeIfPresent),
// matching the old app's omit-when-empty JSON.

import Foundation

nonisolated enum PassStyle: String, Codable, CaseIterable, Identifiable {
    case generic, storeCard, coupon, eventTicket, boardingPass
    var id: String { rawValue }
}

nonisolated enum BarcodeFormat: String, Codable, CaseIterable, Identifiable {
    case qr = "PKBarcodeFormatQR"
    case pdf417 = "PKBarcodeFormatPDF417"
    case aztec = "PKBarcodeFormatAztec"
    case code128 = "PKBarcodeFormatCode128"
    var id: String { rawValue }
}

nonisolated enum TransitType: String, Codable, CaseIterable {
    case air = "PKTransitTypeAir"
    case boat = "PKTransitTypeBoat"
    case bus = "PKTransitTypeBus"
    case train = "PKTransitTypeTrain"
    case generic = "PKTransitTypeGeneric"
}

nonisolated enum FieldCategory: String, Codable, CaseIterable {
    case header, primary, secondary, auxiliary, back, additionalInfo
}

nonisolated enum PassTextAlignment: String, Codable, CaseIterable {
    case left = "PKTextAlignmentLeft"
    case center = "PKTextAlignmentCenter"
    case right = "PKTextAlignmentRight"
    case natural = "PKTextAlignmentNatural"
}

nonisolated enum PassDateStyle: String, Codable, CaseIterable {
    case none = "PKDateStyleNone"
    case short = "PKDateStyleShort"
    case medium = "PKDateStyleMedium"
    case long = "PKDateStyleLong"
    case full = "PKDateStyleFull"
}

nonisolated enum PassNumberStyle: String, Codable, CaseIterable {
    case decimal = "PKNumberStyleDecimal"
    case percent = "PKNumberStylePercent"
    case scientific = "PKNumberStyleScientific"
    case spellOut = "PKNumberStyleSpellOut"
}

nonisolated enum DataDetectorType: String, Codable, CaseIterable {
    case phoneNumber = "PKDataDetectorTypePhoneNumber"
    case link = "PKDataDetectorTypeLink"
    case address = "PKDataDetectorTypeAddress"
    case calendarEvent = "PKDataDetectorTypeCalendarEvent"
}

nonisolated enum PersonalizationField: String, Codable, CaseIterable {
    case name = "PKPassPersonalizationFieldName"
    case postalCode = "PKPassPersonalizationFieldPostalCode"
    case emailAddress = "PKPassPersonalizationFieldEmailAddress"
    case phoneNumber = "PKPassPersonalizationFieldPhoneNumber"
}

nonisolated enum PreferredStyleScheme: String, Codable, CaseIterable {
    case posterEventTicket, eventTicket, boardingPass, semanticBoardingPass
}

/// string | number — encodes as a bare JSON value.
nonisolated enum FieldValue: Codable, Equatable {
    case string(String)
    case number(Double)

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Field values must be strings or numbers.")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        }
    }
}

nonisolated struct PassField: Codable, Equatable {
    var key: String
    var label: String? = nil
    var value: FieldValue
    var attributedValue: FieldValue? = nil
    var changeMessage: String? = nil
    var dataDetectorTypes: [DataDetectorType]? = nil
    var textAlignment: PassTextAlignment? = nil
    var semantics: [String: JSONValue]? = nil
    var dateStyle: PassDateStyle? = nil
    var ignoresTimeZone: Bool? = nil
    var isRelative: Bool? = nil
    var timeStyle: PassDateStyle? = nil
    var currencyCode: String? = nil
    var numberStyle: PassNumberStyle? = nil
    /// Only valid for event-ticket auxiliary fields (0 or 1).
    var row: Int? = nil
}

nonisolated struct BarcodeSpec: Codable, Equatable {
    var format: BarcodeFormat
    var message: String
    var altText: String? = nil
    var messageEncoding: String? = nil
}

nonisolated struct LocationSpec: Codable, Equatable {
    var latitude: Double
    var longitude: Double
    var altitude: Double? = nil
    var relevantText: String? = nil
}

nonisolated struct BeaconSpec: Codable, Equatable {
    var proximityUUID: String
    var major: Int? = nil
    var minor: Int? = nil
    var relevantText: String? = nil
}

/// { date } | { startDate, endDate }
nonisolated enum RelevantDateSpec: Codable, Equatable {
    case date(String)
    case interval(startDate: String, endDate: String)

    private enum CodingKeys: String, CodingKey {
        case date, startDate, endDate
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        if let date = try container.decodeIfPresent(String.self, forKey: .date) {
            self = .date(date)
        } else {
            self = .interval(
                startDate: try container.decode(String.self, forKey: .startDate),
                endDate: try container.decode(String.self, forKey: .endDate)
            )
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.container(keyedBy: CodingKeys.self)
        switch self {
        case .date(let date):
            try container.encode(date, forKey: .date)
        case .interval(let startDate, let endDate):
            try container.encode(startDate, forKey: .startDate)
            try container.encode(endDate, forKey: .endDate)
        }
    }
}

nonisolated struct NFCSpec: Codable, Equatable {
    var message: String
    var encryptionPublicKey: String
    var requiresAuthentication: Bool? = nil
}

nonisolated struct PersonalizationSpec: Codable, Equatable {
    var description: String
    var requiredPersonalizationFields: [PersonalizationField]
    var termsAndConditions: String? = nil
}

nonisolated struct LocalizationSpec: Codable, Equatable {
    var language: String
    var translations: [String: String]
}

nonisolated struct PassColors: Codable, Equatable {
    var backgroundColor: String
    var foregroundColor: String
    var labelColor: String
    var stripColor: String? = nil
    var footerBackgroundColor: String? = nil
}

nonisolated struct PassOptions: Codable, Equatable {
    var appLaunchURL: String? = nil
    var voided: Bool? = nil
    var userInfo: [String: JSONValue]? = nil
    var sharingProhibited: Bool? = nil
    var groupingIdentifier: String? = nil
    var suppressStripShine: Bool? = nil
    var maxDistance: Double? = nil
    var semantics: [String: JSONValue]? = nil
    var webServiceURL: String? = nil
    var associatedStoreIdentifiers: [Int]? = nil
    var authenticationToken: String? = nil

    var isEmpty: Bool {
        appLaunchURL == nil && voided == nil && userInfo == nil
            && sharingProhibited == nil && groupingIdentifier == nil
            && suppressStripShine == nil && maxDistance == nil && semantics == nil
            && webServiceURL == nil && associatedStoreIdentifiers == nil
            && authenticationToken == nil
    }
}

nonisolated struct EventTicketOptions: Codable, Equatable {
    var bagPolicyURL: String? = nil
    var orderFoodURL: String? = nil
    var parkingInformationURL: String? = nil
    var directionsInformationURL: String? = nil
    var purchaseParkingURL: String? = nil
    var merchandiseURL: String? = nil
    var transitInformationURL: String? = nil
    var accessibilityURL: String? = nil
    var addOnURL: String? = nil
    var contactVenueEmail: String? = nil
    var contactVenuePhoneNumber: String? = nil
    var contactVenueWebsite: String? = nil
    var transferURL: String? = nil
    var sellURL: String? = nil
    var suppressHeaderDarkening: Bool? = nil
    var useAutomaticColors: Bool? = nil
    var auxiliaryStoreIdentifiers: [Int]? = nil
    var eventLogoText: String? = nil

    /// String-valued members, keyed by their JSON name — used to bridge the
    /// editor's string-keyed option record into typed properties.
    static let stringFields: [(key: String, path: WritableKeyPath<EventTicketOptions, String?>)] = [
        ("bagPolicyURL", \.bagPolicyURL),
        ("orderFoodURL", \.orderFoodURL),
        ("parkingInformationURL", \.parkingInformationURL),
        ("directionsInformationURL", \.directionsInformationURL),
        ("purchaseParkingURL", \.purchaseParkingURL),
        ("merchandiseURL", \.merchandiseURL),
        ("transitInformationURL", \.transitInformationURL),
        ("accessibilityURL", \.accessibilityURL),
        ("addOnURL", \.addOnURL),
        ("contactVenueEmail", \.contactVenueEmail),
        ("contactVenuePhoneNumber", \.contactVenuePhoneNumber),
        ("contactVenueWebsite", \.contactVenueWebsite),
        ("transferURL", \.transferURL),
        ("sellURL", \.sellURL),
    ]

    var isEmpty: Bool {
        Self.stringFields.allSatisfy { self[keyPath: $0.path] == nil }
            && suppressHeaderDarkening == nil && useAutomaticColors == nil
            && auxiliaryStoreIdentifiers == nil && eventLogoText == nil
    }
}

nonisolated struct BoardingPassOptions: Codable, Equatable {
    var changeSeatURL: String? = nil
    var entertainmentURL: String? = nil
    var purchaseAdditionalBaggageURL: String? = nil
    var purchaseLoungeAccessURL: String? = nil
    var purchaseWifiURL: String? = nil
    var upgradeURL: String? = nil
    var managementURL: String? = nil
    var registerServiceAnimalURL: String? = nil
    var reportLostBagURL: String? = nil
    var requestWheelchairURL: String? = nil
    var transitProviderEmail: String? = nil
    var transitProviderPhoneNumber: String? = nil
    var transitProviderWebsiteURL: String? = nil

    static let stringFields: [(key: String, path: WritableKeyPath<BoardingPassOptions, String?>)] = [
        ("changeSeatURL", \.changeSeatURL),
        ("entertainmentURL", \.entertainmentURL),
        ("purchaseAdditionalBaggageURL", \.purchaseAdditionalBaggageURL),
        ("purchaseLoungeAccessURL", \.purchaseLoungeAccessURL),
        ("purchaseWifiURL", \.purchaseWifiURL),
        ("upgradeURL", \.upgradeURL),
        ("managementURL", \.managementURL),
        ("registerServiceAnimalURL", \.registerServiceAnimalURL),
        ("reportLostBagURL", \.reportLostBagURL),
        ("requestWheelchairURL", \.requestWheelchairURL),
        ("transitProviderEmail", \.transitProviderEmail),
        ("transitProviderPhoneNumber", \.transitProviderPhoneNumber),
        ("transitProviderWebsiteURL", \.transitProviderWebsiteURL),
    ]

    var isEmpty: Bool {
        Self.stringFields.allSatisfy { self[keyPath: $0.path] == nil }
    }
}

nonisolated struct PassSpec: Codable {
    var style: PassStyle
    var description: String
    /// When true, the server keeps the spec, stamps webServiceURL and a
    /// per-pass authenticationToken into the pass, and serves OTA updates.
    var updatable: Bool? = nil
    var serialNumber: String? = nil
    var organizationName: String? = nil
    var logoText: String? = nil
    var colors: PassColors? = nil
    var options: PassOptions? = nil
    var eventTicketOptions: EventTicketOptions? = nil
    var boardingPassOptions: BoardingPassOptions? = nil
    /// Keys are FieldCategory raw values; a string-keyed dictionary so the
    /// JSON encodes as an object.
    var fields: [String: [PassField]]? = nil
    var barcodes: [BarcodeSpec]? = nil
    var transitType: TransitType? = nil
    var preferredStyleSchemes: [PreferredStyleScheme]? = nil
    var expirationDate: String? = nil
    /// Deprecated by Apple, retained because passkit-generator still exposes it.
    var relevantDate: String? = nil
    var relevantDates: [RelevantDateSpec]? = nil
    var locations: [LocationSpec]? = nil
    var beacons: [BeaconSpec]? = nil
    var nfc: NFCSpec? = nil
    var localizations: [LocalizationSpec]? = nil
    var personalization: PersonalizationSpec? = nil
    /// iOS 26 poster-event entries; validated server-side by passkit-generator.
    var upcomingPassInformation: [[String: JSONValue]]? = nil
    /// image path without .png -> bare base64 PNG. Paths may include xx.lproj/.
    var images: [String: String]
}
