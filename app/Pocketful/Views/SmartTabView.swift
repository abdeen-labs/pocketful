// Smart tab: semantics, relevant moments, locations, iBeacons, NFC.

import SwiftUI

struct SmartTabView: View {
    @Bindable var state: EditorState

    private func semanticBinding(_ key: String) -> Binding<String> {
        Binding(
            get: { state.semanticValues[key] ?? "" },
            set: { state.semanticValues[key] = $0 }
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PocketfulSection(
                title: "Semantic intelligence",
                description: "Help Wallet understand events, transit, loyalty, seats, prices, people, Wi-Fi, and more.",
                badge: "iOS 18/26"
            ) {
                ForEach(EditorCatalog.commonSemantics(for: state.style)) { field in
                    PocketfulInput(field.label, text: semanticBinding(field.key), placeholder: field.placeholder)
                }
                PocketfulDisclosure("Complete semantic tags object", description: "Access every passkit-generator semantic tag, including nested seats, locations, names, currency, dates, security programs, and Wi-Fi") {
                    PocketfulInput(
                        "Pass semantics · JSON",
                        text: $state.semanticsJson,
                        placeholder: "{\n  \"eventType\": \"PKEventTypeSports\",\n  \"seats\": [{ \"seatSection\": \"104\", \"seatRow\": \"B\", \"seatNumber\": \"12\" }]\n}",
                        helper: "Guided fields above override matching keys in this object.",
                        multiline: true
                    )
                    PocketfulNotice("Use any key supported by passkit-generator's Semantics schema. Nested semantic tag types are accepted here without reducing them to text fields.", title: "Full schema access")
                }
            }

            PocketfulSection(
                title: "Relevant moments",
                description: "Expiration, legacy relevance, modern relevant dates, and Live Activity intervals."
            ) {
                PocketfulInput("Expiration date", text: $state.expirationDate, placeholder: "2026-09-02T00:00:00-04:00")
                PocketfulDisclosure("Legacy relevant date", description: "Deprecated in iOS 18, retained because passkit-generator exposes it") {
                    PocketfulInput("Relevant date", text: $state.legacyRelevantDate, placeholder: "2026-09-01T19:30:00-04:00")
                }
                RelevantDatesEditorView(relevantDates: $state.relevantDates)
            }

            PocketfulSection(
                title: "Locations",
                description: "Geographic relevance points that can surface the pass nearby.",
                badge: "Up to 10"
            ) {
                LocationsEditorView(locations: $state.locations)
            }

            PocketfulSection(
                title: "iBeacons",
                description: "Proximity UUIDs, major/minor identifiers, and relevant messages.",
                badge: "Up to 10"
            ) {
                BeaconsEditorView(beacons: $state.beacons)
            }

            PocketfulSection(
                title: "NFC",
                description: "Configure contactless payloads and authentication behavior."
            ) {
                PocketfulToggleRow("Enable NFC", description: "Required for personalization passes.", value: $state.nfcEnabled)
                if state.nfcEnabled {
                    PocketfulInput("NFC message", text: $state.nfcMessage, placeholder: "Payload read by the NFC terminal")
                    PocketfulInput("Encryption public key", text: $state.nfcPublicKey, placeholder: "PEM or pass-compatible public key", multiline: true)
                    PocketfulToggleRow("Require authentication", value: $state.nfcRequiresAuthentication)
                }
            }
        }
    }
}
