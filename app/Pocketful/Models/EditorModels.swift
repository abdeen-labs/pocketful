// Editable, string-backed models the editor mutates freely — parsed and
// validated into the typed PassSpec only at create time. Ported from the
// Expo components' Editable* interfaces.

import Foundation
import UIKit

enum FieldValueType: String, CaseIterable {
    case text, number, date
}

struct EditableField: Identifiable, Equatable {
    let id = UUID()
    var category: FieldCategory = .primary
    var key = ""
    var label = ""
    var value = ""
    var valueType: FieldValueType = .text
    var attributedValue = ""
    var changeMessage = ""
    var textAlignment: PassTextAlignment? = nil   // nil = automatic
    var dateStyle: PassDateStyle? = nil
    var timeStyle: PassDateStyle? = nil
    var ignoresTimeZone = false
    var isRelative = false
    var currencyCode = ""
    var numberStyle: PassNumberStyle? = nil
    var row: Int? = nil                           // nil = automatic; 0 or 1
    var dataDetectorTypes: [DataDetectorType] = []
    var semanticsJson = ""
}

struct EditableBarcode: Identifiable, Equatable {
    let id = UUID()
    var format: BarcodeFormat = .qr
    var message = ""
    var altText = ""
    var messageEncoding = "iso-8859-1"
}

struct EditableLocation: Identifiable, Equatable {
    let id = UUID()
    var latitude = ""
    var longitude = ""
    var altitude = ""
    var relevantText = ""

    var hasContent: Bool {
        !latitude.trimmed.isEmpty || !longitude.trimmed.isEmpty
            || !altitude.trimmed.isEmpty || !relevantText.trimmed.isEmpty
    }
}

struct EditableBeacon: Identifiable, Equatable {
    let id = UUID()
    var proximityUUID = ""
    var major = ""
    var minor = ""
    var relevantText = ""

    var hasContent: Bool {
        !proximityUUID.trimmed.isEmpty || !major.trimmed.isEmpty
            || !minor.trimmed.isEmpty || !relevantText.trimmed.isEmpty
    }
}

struct EditableRelevantDate: Identifiable, Equatable {
    enum Kind: String, CaseIterable {
        case date, interval
    }

    let id = UUID()
    var kind: Kind = .date
    var date = ""
    var startDate = ""
    var endDate = ""
}

struct EditableTranslation: Identifiable, Equatable {
    let id = UUID()
    var key = ""
    var value = ""
}

struct EditableLocalization: Identifiable, Equatable {
    let id = UUID()
    var language = ""
    var translations: [EditableTranslation] = [EditableTranslation()]
}

// MARK: - Editor catalogs (labels, placeholders, keyboards)

struct OptionFieldSpec: Identifiable {
    let key: String
    let label: String
    let placeholder: String
    var keyboard: UIKeyboardType = .default
    var id: String { key }
}

struct SemanticFieldSpec: Identifiable {
    let key: String
    let label: String
    let placeholder: String
    var id: String { key }
}

enum EditorCatalog {
    static let eventOptionFields: [OptionFieldSpec] = [
        OptionFieldSpec(key: "bagPolicyURL", label: "Bag policy URL", placeholder: "https://venue.example/bags", keyboard: .URL),
        OptionFieldSpec(key: "orderFoodURL", label: "Order food URL", placeholder: "https://venue.example/food", keyboard: .URL),
        OptionFieldSpec(key: "parkingInformationURL", label: "Parking information URL", placeholder: "https://venue.example/parking", keyboard: .URL),
        OptionFieldSpec(key: "directionsInformationURL", label: "Directions URL", placeholder: "https://venue.example/directions", keyboard: .URL),
        OptionFieldSpec(key: "purchaseParkingURL", label: "Purchase parking URL", placeholder: "https://venue.example/buy-parking", keyboard: .URL),
        OptionFieldSpec(key: "merchandiseURL", label: "Merchandise URL", placeholder: "https://venue.example/merch", keyboard: .URL),
        OptionFieldSpec(key: "transitInformationURL", label: "Transit information URL", placeholder: "https://venue.example/transit", keyboard: .URL),
        OptionFieldSpec(key: "accessibilityURL", label: "Accessibility URL", placeholder: "https://venue.example/accessibility", keyboard: .URL),
        OptionFieldSpec(key: "addOnURL", label: "Add-ons URL", placeholder: "https://venue.example/add-ons", keyboard: .URL),
        OptionFieldSpec(key: "contactVenueEmail", label: "Venue email", placeholder: "hello@venue.example", keyboard: .emailAddress),
        OptionFieldSpec(key: "contactVenuePhoneNumber", label: "Venue phone", placeholder: "+1 212 555 0100", keyboard: .phonePad),
        OptionFieldSpec(key: "contactVenueWebsite", label: "Venue website", placeholder: "https://venue.example", keyboard: .URL),
        OptionFieldSpec(key: "transferURL", label: "Transfer ticket URL", placeholder: "https://tickets.example/transfer", keyboard: .URL),
        OptionFieldSpec(key: "sellURL", label: "Sell ticket URL", placeholder: "https://tickets.example/sell", keyboard: .URL),
    ]

    static let boardingOptionFields: [OptionFieldSpec] = [
        OptionFieldSpec(key: "changeSeatURL", label: "Change seat URL", placeholder: "https://airline.example/seats", keyboard: .URL),
        OptionFieldSpec(key: "entertainmentURL", label: "Entertainment URL", placeholder: "https://airline.example/entertainment", keyboard: .URL),
        OptionFieldSpec(key: "purchaseAdditionalBaggageURL", label: "Additional baggage URL", placeholder: "https://airline.example/bags", keyboard: .URL),
        OptionFieldSpec(key: "purchaseLoungeAccessURL", label: "Lounge access URL", placeholder: "https://airline.example/lounge", keyboard: .URL),
        OptionFieldSpec(key: "purchaseWifiURL", label: "Wi-Fi purchase URL", placeholder: "https://airline.example/wifi", keyboard: .URL),
        OptionFieldSpec(key: "upgradeURL", label: "Upgrade URL", placeholder: "https://airline.example/upgrade", keyboard: .URL),
        OptionFieldSpec(key: "managementURL", label: "Manage trip URL", placeholder: "https://airline.example/manage", keyboard: .URL),
        OptionFieldSpec(key: "registerServiceAnimalURL", label: "Service animal URL", placeholder: "https://airline.example/service-animal", keyboard: .URL),
        OptionFieldSpec(key: "reportLostBagURL", label: "Lost bag URL", placeholder: "https://airline.example/lost-bag", keyboard: .URL),
        OptionFieldSpec(key: "requestWheelchairURL", label: "Wheelchair request URL", placeholder: "https://airline.example/accessibility", keyboard: .URL),
        OptionFieldSpec(key: "transitProviderEmail", label: "Provider email", placeholder: "support@airline.example", keyboard: .emailAddress),
        OptionFieldSpec(key: "transitProviderPhoneNumber", label: "Provider phone", placeholder: "+1 800 555 0100", keyboard: .phonePad),
        OptionFieldSpec(key: "transitProviderWebsiteURL", label: "Provider website", placeholder: "https://airline.example", keyboard: .URL),
    ]

    static func commonSemantics(for style: PassStyle) -> [SemanticFieldSpec] {
        switch style {
        case .generic:
            return [
                SemanticFieldSpec(key: "membershipProgramName", label: "Membership program", placeholder: "Pocketful Plus"),
                SemanticFieldSpec(key: "membershipProgramNumber", label: "Membership number", placeholder: "PFL-2048"),
            ]
        case .storeCard:
            return [
                SemanticFieldSpec(key: "membershipProgramName", label: "Loyalty program", placeholder: "Pocketful Rewards"),
                SemanticFieldSpec(key: "membershipProgramNumber", label: "Member number", placeholder: "104820"),
            ]
        case .posterGeneric:
            return [
                SemanticFieldSpec(key: "membershipProgramName", label: "Membership program", placeholder: "Pocketful Plus"),
                SemanticFieldSpec(key: "membershipProgramNumber", label: "Membership number", placeholder: "PFL-2048"),
            ]
        case .coupon:
            return [
                SemanticFieldSpec(key: "confirmationNumber", label: "Confirmation number", placeholder: "SAVE-2026"),
                SemanticFieldSpec(key: "additionalTicketAttributes", label: "Offer details", placeholder: "Single use"),
            ]
        case .eventTicket:
            return [
                SemanticFieldSpec(key: "eventName", label: "Event name", placeholder: "Pocketful Live"),
                SemanticFieldSpec(key: "venueName", label: "Venue name", placeholder: "The Grand Hall"),
                SemanticFieldSpec(key: "eventStartDate", label: "Event start date", placeholder: "2026-09-01T19:30:00-04:00"),
                SemanticFieldSpec(key: "eventEndDate", label: "Event end date", placeholder: "2026-09-01T22:30:00-04:00"),
                SemanticFieldSpec(key: "venueEntrance", label: "Entrance", placeholder: "North Gate"),
                SemanticFieldSpec(key: "attendeeName", label: "Attendee name", placeholder: "Jane Appleseed"),
            ]
        case .boardingPass:
            return [
                SemanticFieldSpec(key: "airlineCode", label: "Airline code", placeholder: "PF"),
                SemanticFieldSpec(key: "flightCode", label: "Flight code", placeholder: "PF2048"),
                SemanticFieldSpec(key: "departureAirportCode", label: "Departure airport", placeholder: "JFK"),
                SemanticFieldSpec(key: "destinationAirportCode", label: "Destination airport", placeholder: "LHR"),
                SemanticFieldSpec(key: "departureGate", label: "Departure gate", placeholder: "12A"),
                SemanticFieldSpec(key: "boardingGroup", label: "Boarding group", placeholder: "2"),
                SemanticFieldSpec(key: "confirmationNumber", label: "Confirmation number", placeholder: "ABC123"),
                SemanticFieldSpec(key: "transitStatus", label: "Transit status", placeholder: "On Time"),
            ]
        }
    }
}
