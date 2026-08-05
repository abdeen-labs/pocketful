// The entire editor state plus spec assembly and validation, ported from
// src/app/index.tsx. createSpec() and assertModernStyleRequirements() are
// faithful ports — error messages and validation order match the Expo app.

import Foundation
import Observation

@Observable
final class EditorState {
    enum Tab: String, CaseIterable {
        case design, content, smart, advanced
    }

    static let hexColorPattern = "^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$"
    static let languagePattern = "^[a-zA-Z]{2,3}(?:-[a-zA-Z0-9]{2,8})?$"
    private static let serverURLKey = "pocketful.serverURL"
    private static let apiTokenKey = "pocketful.apiToken"

    // MARK: - Editor state

    var tab: Tab = .design
    var templatesCollapsed = false
    var lastAppliedTemplateId: String? = nil

    var style: PassStyle = .storeCard
    var descriptionText = ""
    var organizationName = ""
    var logoText = ""
    var serialNumber = ""

    var bgColor = "#131822"
    var fgColor = "#ffffff"
    var labelColor = "#a9b2c0"
    var stripColor = ""
    var footerColor = ""
    var fields: [EditableField] = []
    var barcodes: [EditableBarcode] = [EditableBarcode()]
    var transitType: TransitType = .generic
    var preferredStyleSchemes: [PreferredStyleScheme] = []

    var images: [String: ProcessedImage] = [:]
    var busySlot: String? = nil
    var locations: [EditableLocation] = []
    var beacons: [EditableBeacon] = []
    var relevantDates: [EditableRelevantDate] = []
    var localizations: [EditableLocalization] = []

    var expirationDate = ""
    var legacyRelevantDate = ""
    var semanticValues: [String: String] = [:]
    var semanticsJson = ""
    var userInfoJson = ""
    var upcomingPassJson = ""

    var appLaunchURL = ""
    var voided = false
    var sharingProhibited = false
    var groupingIdentifier = ""
    var suppressStripShine = false
    var maxDistance = ""
    var updatable = false
    var webServiceURL = ""
    var authenticationToken = ""
    var associatedStoreIdentifiers = ""

    var nfcEnabled = false
    var nfcMessage = ""
    var nfcPublicKey = ""
    var nfcRequiresAuthentication = false
    var personalizationEnabled = false
    var personalizationDescription = ""
    var personalizationFields: [PersonalizationField] = []
    var personalizationTerms = ""

    var eventOptions: [String: String] = [:]
    var eventAutomaticColors = false
    var suppressHeaderDarkening = false
    var auxiliaryStoreIdentifiers = ""
    var eventLogoText = ""
    var boardingOptions: [String: String] = [:]

    var serverUrl: String {
        didSet { UserDefaults.standard.set(serverUrl, forKey: Self.serverURLKey) }
    }
    var apiToken: String {
        didSet { UserDefaults.standard.set(apiToken, forKey: Self.apiTokenKey) }
    }

    var submitting = false
    var alert: AlertMessage? = nil

    init() {
        let defaults = UserDefaults.standard
        serverUrl = defaults.string(forKey: Self.serverURLKey) ?? "https://pass.abdeen.dev"
        apiToken = defaults.string(forKey: Self.apiTokenKey) ?? ""
    }

    // MARK: - Derived

    var posterEvent: Bool {
        style == .eventTicket && preferredStyleSchemes.contains(.posterEventTicket)
    }

    var standardSlots: [ImageSlot] {
        Slots.standard(for: style, posterEvent: posterEvent)
    }

    var localizationLanguages: [String] {
        localizations
            .map { $0.language.trimmed }
            .filter { $0.range(of: Self.languagePattern, options: .regularExpression) != nil }
    }

    var localizedSlots: [ImageSlot] {
        Slots.localized(for: style, languages: localizationLanguages, posterEvent: posterEvent)
    }

    var recommendedSlots: [ImageSlot] {
        standardSlots.filter { $0.recommended || $0.required }
    }

    var optionalSlots: [ImageSlot] {
        standardSlots.filter { !$0.recommended && !$0.required }
    }

    var activeBarcodeCount: Int {
        barcodes.filter { !$0.message.trimmed.isEmpty }.count
    }

    /// True when applying a template would overwrite meaningful edits.
    var hasContent: Bool {
        !descriptionText.trimmed.isEmpty || !fields.isEmpty
            || barcodes.contains { !$0.message.trimmed.isEmpty }
    }

    // MARK: - Mutations

    /// Style change from the format chips — resets modern schemes and folds
    /// event-only field categories back onto the back of the pass.
    func selectStyle(_ next: PassStyle) {
        style = next
        preferredStyleSchemes = []
        if next != .eventTicket {
            fields = fields.map { field in
                var updated = field
                if updated.category == .additionalInfo { updated.category = .back }
                return updated
            }
        }
    }

    /// Ports applyTemplate: replaces format, identity, colors, fields,
    /// barcode, relevant dates, semantics, and style-specific actions while
    /// leaving other artwork, NFC credentials, and server settings alone.
    func applyTemplate(_ template: PassTemplate) throws {
        let bundledImages = try TemplateArtwork.load(templateID: template.id)

        let guidedKeys = Set(EditorCatalog.commonSemantics(for: template.style).map(\.key))
        var guidedSemantics: [String: String] = [:]
        var advancedSemantics: [String: JSONValue] = [:]
        for (key, value) in template.semantics {
            if guidedKeys.contains(key), case .string(let text) = value {
                guidedSemantics[key] = text
            } else {
                advancedSemantics[key] = value
            }
        }

        var eventActionValues: [String: String] = [:]
        if let options = template.eventTicketOptions {
            for entry in EventTicketOptions.stringFields {
                if let value = options[keyPath: entry.path] {
                    eventActionValues[entry.key] = value
                }
            }
        }
        var boardingActionValues: [String: String] = [:]
        if let options = template.boardingPassOptions {
            for entry in BoardingPassOptions.stringFields {
                if let value = options[keyPath: entry.path] {
                    boardingActionValues[entry.key] = value
                }
            }
        }

        lastAppliedTemplateId = template.id
        templatesCollapsed = true
        style = template.style
        descriptionText = template.description
        organizationName = template.organizationName
        logoText = template.logoText
        bgColor = template.colors.background
        fgColor = template.colors.foreground
        labelColor = template.colors.label
        stripColor = template.colors.strip ?? ""
        footerColor = template.colors.footer ?? ""
        fields = Templates.buildFields(template)
        barcodes = Templates.buildBarcodes(template)
        relevantDates = Templates.buildRelevantDates(template)
        legacyRelevantDate = ""
        transitType = template.transitType ?? .generic
        preferredStyleSchemes = template.preferredStyleSchemes
        semanticValues = guidedSemantics
        semanticsJson = advancedSemantics.isEmpty ? "" : JSONText.prettyPrinted(advancedSemantics)
        eventOptions = eventActionValues
        eventAutomaticColors = template.eventTicketOptions?.useAutomaticColors ?? false
        suppressHeaderDarkening = template.eventTicketOptions?.suppressHeaderDarkening ?? false
        auxiliaryStoreIdentifiers = template.eventTicketOptions?.auxiliaryStoreIdentifiers?
            .map(String.init).joined(separator: ", ") ?? ""
        eventLogoText = template.eventTicketOptions?.eventLogoText ?? template.eventLogoText ?? ""
        boardingOptions = boardingActionValues
        upcomingPassJson = ""
        if !bundledImages.isEmpty {
            var next = images
            next.merge(bundledImages) { _, bundled in bundled }
            // The template's poster artwork is the whole visual identity —
            // legacy strip or background images left over from earlier editing
            // would leak into the pass.
            if bundledImages["artwork"] != nil {
                next["strip"] = nil
                next["background"] = nil
            }
            images = next
        }
    }

    // MARK: - Spec assembly (faithful port of createSpec)

    func createSpec() throws -> PassSpec {
        if serverUrl.trimmed.isEmpty { throw PassError("Set the pass server URL in Advanced → Server.") }
        if descriptionText.trimmed.isEmpty { throw PassError("Add the Wallet description in Design → Identity.") }
        if images["icon"] == nil { throw PassError("Choose the required icon artwork in Design → Artwork.") }
        let colorChecks: [(name: String, value: String, required: Bool)] = [
            ("Background", bgColor, true),
            ("Foreground", fgColor, true),
            ("Label", labelColor, true),
            ("Strip", stripColor, false),
            ("Footer", footerColor, false),
        ]
        for check in colorChecks {
            let value = check.value.trimmed
            if (check.required || !value.isEmpty),
               value.range(of: Self.hexColorPattern, options: .regularExpression) == nil {
                throw PassError("\(check.name) color must be a hex value like #131822.")
            }
        }

        var specFields: [String: [PassField]] = [:]
        for field in fields {
            if field.value.trimmed.isEmpty { continue }
            let errorName = !field.label.isEmpty ? field.label : (!field.key.isEmpty ? field.key : "Field")
            var value = FieldValue.string(field.value.trimmed)
            if field.valueType == .number {
                value = .number(try Self.parseRequiredNumber(field.value, "\(errorName) value"))
            } else if field.valueType == .date {
                try Self.assertDate(field.value, "\(errorName) date")
            }
            var list = specFields[field.category.rawValue] ?? []
            var parsed = PassField(
                key: field.key.trimmed.isEmpty ? "\(field.category.rawValue)-\(list.count + 1)" : field.key.trimmed,
                value: value
            )
            if !field.label.trimmed.isEmpty { parsed.label = field.label.trimmed }
            if !field.attributedValue.trimmed.isEmpty {
                parsed.attributedValue = field.valueType == .number
                    ? .number(try Self.parseRequiredNumber(field.attributedValue, "Attributed value"))
                    : .string(field.attributedValue.trimmed)
            }
            if !field.changeMessage.trimmed.isEmpty { parsed.changeMessage = field.changeMessage.trimmed }
            if let alignment = field.textAlignment { parsed.textAlignment = alignment }
            if !field.dataDetectorTypes.isEmpty { parsed.dataDetectorTypes = field.dataDetectorTypes }
            if field.valueType == .date {
                if let dateStyle = field.dateStyle { parsed.dateStyle = dateStyle }
                if let timeStyle = field.timeStyle { parsed.timeStyle = timeStyle }
                if field.ignoresTimeZone { parsed.ignoresTimeZone = true }
                if field.isRelative { parsed.isRelative = true }
            }
            if field.valueType == .number {
                if let numberStyle = field.numberStyle { parsed.numberStyle = numberStyle }
                if !field.currencyCode.trimmed.isEmpty { parsed.currencyCode = field.currencyCode.trimmed.uppercased() }
            }
            if let row = field.row, style == .eventTicket, field.category == .auxiliary { parsed.row = row }
            if !field.semanticsJson.trimmed.isEmpty {
                let semanticsName = !field.label.isEmpty ? field.label : (!field.key.isEmpty ? field.key : "field")
                parsed.semantics = try JSONText.parseObject(field.semanticsJson, label: "Semantics for \(semanticsName)")
            }
            list.append(parsed)
            specFields[field.category.rawValue] = list
        }

        let parsedBarcodes: [BarcodeSpec] = barcodes
            .filter { !$0.message.trimmed.isEmpty }
            .map { barcode in
                var spec = BarcodeSpec(format: barcode.format, message: barcode.message.trimmed)
                if !barcode.altText.trimmed.isEmpty { spec.altText = barcode.altText.trimmed }
                if !barcode.messageEncoding.trimmed.isEmpty { spec.messageEncoding = barcode.messageEncoding.trimmed }
                return spec
            }

        var parsedLocations: [LocationSpec] = []
        for (index, location) in locations.filter({ $0.hasContent }).enumerated() {
            var spec = LocationSpec(
                latitude: try Self.parseRequiredNumber(location.latitude, "Location \(index + 1) latitude"),
                longitude: try Self.parseRequiredNumber(location.longitude, "Location \(index + 1) longitude")
            )
            if !location.altitude.trimmed.isEmpty {
                spec.altitude = try Self.parseRequiredNumber(location.altitude, "Location \(index + 1) altitude")
            }
            if !location.relevantText.trimmed.isEmpty { spec.relevantText = location.relevantText.trimmed }
            parsedLocations.append(spec)
        }

        var parsedBeacons: [BeaconSpec] = []
        for (index, beacon) in beacons.filter({ $0.hasContent }).enumerated() {
            if beacon.proximityUUID.trimmed.isEmpty { throw PassError("Beacon \(index + 1) needs a proximity UUID.") }
            var spec = BeaconSpec(proximityUUID: beacon.proximityUUID.trimmed)
            if !beacon.major.trimmed.isEmpty {
                spec.major = try Self.parseRequiredInteger(beacon.major, "Beacon \(index + 1) major")
            }
            if !beacon.minor.trimmed.isEmpty {
                spec.minor = try Self.parseRequiredInteger(beacon.minor, "Beacon \(index + 1) minor")
            }
            if !beacon.relevantText.trimmed.isEmpty { spec.relevantText = beacon.relevantText.trimmed }
            parsedBeacons.append(spec)
        }

        var parsedDates: [RelevantDateSpec] = []
        for (index, entry) in relevantDates.enumerated() {
            if entry.kind == .date {
                try Self.assertDate(entry.date, "Relevant date \(index + 1)")
                parsedDates.append(.date(entry.date.trimmed))
            } else {
                try Self.assertDate(entry.startDate, "Interval \(index + 1) start")
                try Self.assertDate(entry.endDate, "Interval \(index + 1) end")
                parsedDates.append(.interval(startDate: entry.startDate.trimmed, endDate: entry.endDate.trimmed))
            }
        }

        var mergedSemantics: [String: JSONValue] = semanticsJson.trimmed.isEmpty
            ? [:]
            : try JSONText.parseObject(semanticsJson, label: "Pass semantics")
        for (key, value) in semanticValues where !value.trimmed.isEmpty {
            mergedSemantics[key] = .string(value.trimmed)
        }

        var options = PassOptions()
        if !appLaunchURL.trimmed.isEmpty { options.appLaunchURL = appLaunchURL.trimmed }
        if voided { options.voided = true }
        if sharingProhibited { options.sharingProhibited = true }
        if !groupingIdentifier.trimmed.isEmpty { options.groupingIdentifier = groupingIdentifier.trimmed }
        if suppressStripShine { options.suppressStripShine = true }
        if !maxDistance.trimmed.isEmpty {
            options.maxDistance = try Self.parseRequiredNumber(maxDistance, "Maximum relevance distance")
        }
        if !mergedSemantics.isEmpty { options.semantics = mergedSemantics }
        if !userInfoJson.trimmed.isEmpty {
            options.userInfo = try JSONText.parseObject(userInfoJson, label: "User info")
        }
        if !updatable, !webServiceURL.trimmed.isEmpty { options.webServiceURL = webServiceURL.trimmed }
        if !updatable, !authenticationToken.trimmed.isEmpty { options.authenticationToken = authenticationToken.trimmed }
        if !associatedStoreIdentifiers.trimmed.isEmpty {
            options.associatedStoreIdentifiers = try Self.parseNumberList(associatedStoreIdentifiers, "Associated App Store identifiers")
        }
        if (options.webServiceURL != nil) != (options.authenticationToken != nil) {
            throw PassError("Web service URL and authentication token must be supplied together.")
        }

        var parsedLocalizations: [LocalizationSpec] = []
        for (index, localization) in localizations.enumerated() {
            let language = localization.language.trimmed
            if language.range(of: Self.languagePattern, options: .regularExpression) == nil {
                throw PassError("Language \(index + 1) needs a tag such as en or en-US.")
            }
            var translations: [String: String] = [:]
            for entry in localization.translations where !entry.key.trimmed.isEmpty {
                translations[entry.key.trimmed] = entry.value
            }
            parsedLocalizations.append(LocalizationSpec(language: language, translations: translations))
        }

        let activeImageSlots = standardSlots + localizedSlots
            + (personalizationEnabled ? [Slots.personalizationLogo] : [])
        var specImages: [String: String] = [:]
        for slot in activeImageSlots {
            if let picked = images[slot.name] {
                specImages.merge(picked.files) { _, new in new }
            }
        }

        try assertModernStyleRequirements(semantics: mergedSemantics, specImages: specImages)

        if !expirationDate.trimmed.isEmpty { try Self.assertDate(expirationDate, "Expiration date") }
        if !legacyRelevantDate.trimmed.isEmpty { try Self.assertDate(legacyRelevantDate, "Legacy relevant date") }
        if personalizationEnabled, !nfcEnabled { throw PassError("Personalization requires NFC to be enabled.") }
        if personalizationEnabled, images["personalizationLogo"] == nil {
            throw PassError("Personalization requires its logo artwork.")
        }
        if nfcEnabled, nfcMessage.trimmed.isEmpty || nfcPublicKey.trimmed.isEmpty {
            throw PassError("NFC requires both a message and encryption public key.")
        }

        var parsedEventOptions = EventTicketOptions()
        for entry in EventTicketOptions.stringFields {
            if let raw = eventOptions[entry.key], !raw.trimmed.isEmpty {
                parsedEventOptions[keyPath: entry.path] = raw.trimmed
            }
        }
        if eventAutomaticColors { parsedEventOptions.useAutomaticColors = true }
        if suppressHeaderDarkening { parsedEventOptions.suppressHeaderDarkening = true }
        if !auxiliaryStoreIdentifiers.trimmed.isEmpty {
            parsedEventOptions.auxiliaryStoreIdentifiers = try Self.parseNumberList(auxiliaryStoreIdentifiers, "Auxiliary App Store identifiers")
        }
        if !eventLogoText.trimmed.isEmpty { parsedEventOptions.eventLogoText = eventLogoText.trimmed }

        var parsedBoardingOptions = BoardingPassOptions()
        for entry in BoardingPassOptions.stringFields {
            if let raw = boardingOptions[entry.key], !raw.trimmed.isEmpty {
                parsedBoardingOptions[keyPath: entry.path] = raw.trimmed
            }
        }

        var spec = PassSpec(style: style, description: descriptionText.trimmed, images: specImages)
        if updatable { spec.updatable = true }
        if !serialNumber.trimmed.isEmpty { spec.serialNumber = serialNumber.trimmed }
        if !organizationName.trimmed.isEmpty { spec.organizationName = organizationName.trimmed }
        if !logoText.trimmed.isEmpty { spec.logoText = logoText.trimmed }
        spec.colors = PassColors(
            backgroundColor: bgColor.trimmed,
            foregroundColor: fgColor.trimmed,
            labelColor: labelColor.trimmed,
            stripColor: stripColor.trimmed.isEmpty ? nil : stripColor.trimmed,
            footerBackgroundColor: footerColor.trimmed.isEmpty ? nil : footerColor.trimmed
        )
        if !options.isEmpty { spec.options = options }
        if style == .eventTicket, !parsedEventOptions.isEmpty { spec.eventTicketOptions = parsedEventOptions }
        if style == .boardingPass, !parsedBoardingOptions.isEmpty { spec.boardingPassOptions = parsedBoardingOptions }
        if !specFields.isEmpty { spec.fields = specFields }
        if !parsedBarcodes.isEmpty { spec.barcodes = parsedBarcodes }
        if style == .boardingPass { spec.transitType = transitType }
        if !preferredStyleSchemes.isEmpty { spec.preferredStyleSchemes = preferredStyleSchemes }
        if !expirationDate.trimmed.isEmpty { spec.expirationDate = expirationDate.trimmed }
        if !legacyRelevantDate.trimmed.isEmpty { spec.relevantDate = legacyRelevantDate.trimmed }
        if !parsedDates.isEmpty { spec.relevantDates = parsedDates }
        if !parsedLocations.isEmpty { spec.locations = parsedLocations }
        if !parsedBeacons.isEmpty { spec.beacons = parsedBeacons }
        if nfcEnabled {
            var nfc = NFCSpec(message: nfcMessage.trimmed, encryptionPublicKey: nfcPublicKey.trimmed)
            if nfcRequiresAuthentication { nfc.requiresAuthentication = true }
            spec.nfc = nfc
        }
        if !parsedLocalizations.isEmpty { spec.localizations = parsedLocalizations }
        if personalizationEnabled {
            var personalization = PersonalizationSpec(
                description: personalizationDescription.trimmed.isEmpty
                    ? descriptionText.trimmed
                    : personalizationDescription.trimmed,
                requiredPersonalizationFields: personalizationFields
            )
            if !personalizationTerms.trimmed.isEmpty { personalization.termsAndConditions = personalizationTerms.trimmed }
            spec.personalization = personalization
        }
        if !upcomingPassJson.trimmed.isEmpty {
            spec.upcomingPassInformation = try JSONText.parseObjectArray(upcomingPassJson, label: "Upcoming pass information")
        }
        return spec
    }

    // MARK: - Modern style requirements (faithful port)

    private func assertModernStyleRequirements(semantics: [String: JSONValue], specImages: [String: String]) throws {
        if preferredStyleSchemes.contains(.posterEventTicket) {
            if style != .eventTicket { throw PassError("Poster layout requires the event-ticket format.") }
            if !Self.hasImageAsset(specImages, name: "artwork") {
                throw PassError("Poster event tickets require poster artwork in Design → Artwork.")
            }
            try Self.assertSemanticKeys(semantics, ["eventName", "venueName", "venueRegionName", "venueRoom"], "Poster event ticket")
            if semantics["eventType"] == .string("PKEventTypeSports") {
                try Self.assertSemanticKeys(semantics, ["awayTeamAbbreviation", "homeTeamAbbreviation"], "Sports poster ticket")
            }
            if semantics["eventType"] == .string("PKEventTypeLivePerformance") {
                var hasPerformer = false
                if case .array(let names)? = semantics["performerNames"], !names.isEmpty { hasPerformer = true }
                if !hasPerformer {
                    throw PassError("Live-performance poster tickets require at least one performer name in pass semantics.")
                }
            }
        }

        if preferredStyleSchemes.contains(.semanticBoardingPass) {
            if style != .boardingPass || transitType != .air {
                throw PassError("Enhanced boarding passes require an airline boarding-pass format.")
            }
            try Self.assertSemanticKeys(semantics, [
                "airlineCode",
                "flightNumber",
                "departureAirportCode",
                "departureCityName",
                "departureLocationTimeZone",
                "destinationAirportCode",
                "destinationCityName",
                "destinationLocationTimeZone",
                "originalArrivalDate",
                "originalBoardingDate",
                "originalDepartureDate",
                "passengerName",
            ], "Enhanced boarding pass")
        }
    }

    private static func hasImageAsset(_ images: [String: String], name: String) -> Bool {
        images[name] != nil || images["\(name)@2x"] != nil || images["\(name)@3x"] != nil
    }

    private static func assertSemanticKeys(_ semantics: [String: JSONValue], _ keys: [String], _ label: String) throws {
        let missing = keys.filter { key in
            switch semantics[key] {
            case nil, .some(.null), .some(.string("")):
                return true
            default:
                return false
            }
        }
        if !missing.isEmpty {
            throw PassError("\(label) is missing required semantics: \(missing.joined(separator: ", ")).")
        }
    }

    // MARK: - Parsing helpers (ported from index.tsx)

    static func parseRequiredNumber(_ value: String, _ label: String) throws -> Double {
        let trimmed = value.trimmed
        guard !trimmed.isEmpty, let number = Double(trimmed), number.isFinite else {
            throw PassError("\(label) must be a number.")
        }
        return number
    }

    static func parseRequiredInteger(_ value: String, _ label: String) throws -> Int {
        let number = try parseRequiredNumber(value, label)
        guard number.truncatingRemainder(dividingBy: 1) == 0, let integer = Int(exactly: number.rounded()) else {
            throw PassError("\(label) must be a whole number.")
        }
        return integer
    }

    static func parseNumberList(_ value: String, _ label: String) throws -> [Int] {
        let separators = CharacterSet.whitespacesAndNewlines.union(CharacterSet(charactersIn: ","))
        return try value.components(separatedBy: separators)
            .filter { !$0.isEmpty }
            .map { try parseRequiredInteger($0, label) }
    }

    static let isoDateFormatters: [ISO8601DateFormatter] = {
        let internet = ISO8601DateFormatter()
        internet.formatOptions = [.withInternetDateTime]
        let fractional = ISO8601DateFormatter()
        fractional.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        let dateOnly = ISO8601DateFormatter()
        dateOnly.formatOptions = [.withFullDate]
        return [internet, fractional, dateOnly]
    }()

    static func parseISODate(_ value: String) -> Date? {
        for formatter in isoDateFormatters {
            if let date = formatter.date(from: value) { return date }
        }
        return nil
    }

    static func assertDate(_ value: String, _ label: String) throws {
        let trimmed = value.trimmed
        guard !trimmed.isEmpty, parseISODate(trimmed) != nil else {
            throw PassError("\(label) must be an ISO-8601 date.")
        }
    }
}
