// Barcodes, locations, beacons, relevant dates, and localizations — the
// collection editors, ported from src/components/CollectionEditors.tsx.

import SwiftUI
import UIKit

// MARK: - Shared card chrome

private struct EditorCard<Content: View>: View {
    let index: Int
    let title: String
    let onRemove: () -> Void
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 10) {
                Text("\(index + 1)")
                    .font(PocketfulFont.monoSemiBold(12))
                    .foregroundStyle(PocketfulTheme.textSoft)
                    .frame(width: 27, height: 27)
                    .background(PocketfulTheme.band, in: Circle())
                    .overlay(Circle().stroke(PocketfulTheme.border, lineWidth: 0.5))
                Text(title)
                    .font(PocketfulFont.textSemiBold(14))
                    .foregroundStyle(PocketfulTheme.text)
                    .lineLimit(1)
                Spacer(minLength: 0)
                PocketfulButton("Remove", kind: .ghost, compact: true, action: onRemove)
            }
            PocketfulDivider()
            content()
        }
        .padding(14)
        .background(PocketfulTheme.cardElevated, in: RoundedRectangle(cornerRadius: Radii.plate))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.plate)
                .stroke(PocketfulTheme.border, lineWidth: 1)
        )
    }
}

private struct EmptyHint: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text)
            .font(PocketfulFont.text(12))
            .foregroundStyle(PocketfulTheme.dim)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
            .padding(14)
    }
}

// MARK: - Barcodes

struct BarcodesEditorView: View {
    @Binding var barcodes: [EditableBarcode]

    private static let formatOptions: [(value: BarcodeFormat, label: String)] = [
        (.qr, "QR"),
        (.pdf417, "PDF417"),
        (.aztec, "Aztec"),
        (.code128, "Code 128"),
        // iOS 27+ formats — pair with a legacy fallback for older systems.
        (.ean13, "EAN-13"),
        (.code39, "Code 39"),
        (.codabar, "Codabar"),
        (.i2of5, "ITF"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($barcodes.enumerated()), id: \.element.id) { index, $barcode in
                EditorCard(
                    index: index,
                    title: barcode.altText.isEmpty ? "Barcode" : barcode.altText,
                    onRemove: { barcodes.removeAll { $0.id == barcode.id } }
                ) {
                    ChipRow(options: Self.formatOptions, value: barcode.format) { barcode.format = $0 }
                    PocketfulInput("Encoded message", text: $barcode.message, placeholder: "MEMBER-12345")
                    PocketfulInput("Text below barcode", text: $barcode.altText, placeholder: "Member 12345")
                    PocketfulInput("Message encoding", text: $barcode.messageEncoding, placeholder: "iso-8859-1")
                }
            }
            if barcodes.isEmpty {
                EmptyHint("No barcodes. Wallet can render up to four fallback formats.")
            }
            PocketfulButton("+ Add barcode", kind: .secondary, disabled: barcodes.count >= 4) {
                barcodes.append(EditableBarcode())
            }
        }
    }
}

// MARK: - Locations

struct LocationsEditorView: View {
    @Binding var locations: [EditableLocation]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($locations.enumerated()), id: \.element.id) { index, $location in
                EditorCard(
                    index: index,
                    title: location.relevantText.isEmpty ? "Location" : location.relevantText,
                    onRemove: { locations.removeAll { $0.id == location.id } }
                ) {
                    HStack(alignment: .top, spacing: 10) {
                        PocketfulInput("Latitude", text: $location.latitude, placeholder: "40.7128", keyboard: .numbersAndPunctuation)
                        PocketfulInput("Longitude", text: $location.longitude, placeholder: "-74.0060", keyboard: .numbersAndPunctuation)
                    }
                    PocketfulInput("Altitude", text: $location.altitude, placeholder: "Optional meters", keyboard: .numbersAndPunctuation)
                    PocketfulInput("Relevant text", text: $location.relevantText, placeholder: "You're near the venue")
                }
            }
            if locations.isEmpty {
                EmptyHint("Add geographic points where Wallet may surface this pass.")
            }
            PocketfulButton("+ Add location", kind: .secondary, disabled: locations.count >= 10) {
                locations.append(EditableLocation())
            }
        }
    }
}

// MARK: - Beacons

struct BeaconsEditorView: View {
    @Binding var beacons: [EditableBeacon]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($beacons.enumerated()), id: \.element.id) { index, $beacon in
                EditorCard(
                    index: index,
                    title: beacon.relevantText.isEmpty ? "iBeacon" : beacon.relevantText,
                    onRemove: { beacons.removeAll { $0.id == beacon.id } }
                ) {
                    PocketfulInput("Proximity UUID", text: $beacon.proximityUUID, placeholder: "00000000-0000-0000-0000-000000000000")
                    HStack(alignment: .top, spacing: 10) {
                        PocketfulInput("Major", text: $beacon.major, placeholder: "Optional", keyboard: .numberPad)
                        PocketfulInput("Minor", text: $beacon.minor, placeholder: "Optional", keyboard: .numberPad)
                    }
                    PocketfulInput("Relevant text", text: $beacon.relevantText, placeholder: "Welcome to the entrance")
                }
            }
            if beacons.isEmpty {
                EmptyHint("Add iBeacons that can make Wallet surface the pass nearby.")
            }
            PocketfulButton("+ Add beacon", kind: .secondary, disabled: beacons.count >= 10) {
                beacons.append(EditableBeacon())
            }
        }
    }
}

// MARK: - Relevant dates

struct RelevantDatesEditorView: View {
    @Binding var relevantDates: [EditableRelevantDate]

    private static let kindOptions: [(value: EditableRelevantDate.Kind, label: String)] = [
        (.date, "Single date"),
        (.interval, "Interval"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($relevantDates.enumerated()), id: \.element.id) { index, $entry in
                EditorCard(
                    index: index,
                    title: entry.kind == .date ? "Relevant date" : "Live Activity interval",
                    onRemove: { relevantDates.removeAll { $0.id == entry.id } }
                ) {
                    ChipRow(options: Self.kindOptions, value: entry.kind) { entry.kind = $0 }
                    if entry.kind == .date {
                        PocketfulInput("ISO-8601 date", text: $entry.date, placeholder: "2026-09-01T19:30:00-04:00")
                    } else {
                        PocketfulInput("Start date", text: $entry.startDate, placeholder: "2026-09-01T18:30:00-04:00")
                        PocketfulInput("End date", text: $entry.endDate, placeholder: "2026-09-01T22:30:00-04:00", helper: "passkit-generator allows a relevancy interval up to 24 hours.")
                    }
                }
            }
            if relevantDates.isEmpty {
                EmptyHint("Single dates control relevance; intervals can trigger modern event Live Activities.")
            }
            PocketfulButton("+ Add relevant date", kind: .secondary) {
                relevantDates.append(EditableRelevantDate())
            }
        }
    }
}

// MARK: - Localizations

struct LocalizationsEditorView: View {
    @Binding var localizations: [EditableLocalization]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($localizations.enumerated()), id: \.element.id) { index, $localization in
                EditorCard(
                    index: index,
                    title: localization.language.isEmpty ? "Language" : localization.language,
                    onRemove: { localizations.removeAll { $0.id == localization.id } }
                ) {
                    PocketfulInput("Language tag", text: $localization.language, placeholder: "en or en-US", helper: "This also enables localized artwork slots in the Artwork tab.")
                    ForEach(Array($localization.translations.enumerated()), id: \.element.id) { translationIndex, $translation in
                        VStack(alignment: .leading, spacing: 10) {
                            HStack {
                                Text("Translation \(translationIndex + 1)")
                                    .font(PocketfulFont.textSemiBold(12))
                                    .foregroundStyle(PocketfulTheme.textSoft)
                                Spacer(minLength: 0)
                                PocketfulButton("Remove", kind: .ghost, compact: true) {
                                    localization.translations.removeAll { $0.id == translation.id }
                                }
                            }
                            PocketfulInput("Source key", text: $translation.key, placeholder: "MEMBER_LABEL")
                            PocketfulInput("Localized value", text: $translation.value, placeholder: "Member", capitalization: .sentences)
                        }
                        .padding(.top, 12)
                        .overlay(alignment: .top) {
                            Rectangle().fill(PocketfulTheme.border).frame(height: 0.5)
                        }
                    }
                    PocketfulButton("+ Add translation", kind: .ghost) {
                        localization.translations.append(EditableTranslation())
                    }
                }
            }
            if localizations.isEmpty {
                EmptyHint("Localize any text key and optionally provide per-language artwork.")
            }
            PocketfulButton("+ Add language", kind: .secondary) {
                localizations.append(EditableLocalization())
            }
        }
    }
}
