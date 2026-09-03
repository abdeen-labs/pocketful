// Additional formats and featured actions: the two iOS 27 collections that
// sit outside a single style dictionary.

import SwiftUI

// MARK: - Additional formats

struct AdditionalStylesEditorView: View {
    @Bindable var state: EditorState

    private static let styleOptions: [(value: PassStyle, label: String)] =
        PassStyle.allCases.map { (value: $0, label: $0.displayName) }

    private static let transitOptions: [(value: TransitType, label: String)] = [
        (.generic, "Generic"),
        (.air, "Air"),
        (.train, "Train"),
        (.bus, "Bus"),
        (.boat, "Boat"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($state.additionalStyles.enumerated()), id: \.element.id) { index, $entry in
                AdditionalStyleCard(
                    entry: $entry,
                    index: index,
                    primaryStyle: state.style,
                    styleOptions: Self.styleOptions,
                    transitOptions: Self.transitOptions,
                    onRemove: { state.additionalStyles.removeAll { $0.id == entry.id } }
                )
            }
            if state.additionalStyles.isEmpty {
                EmptyHint("Add a generic or store card format so a poster generic pass installs on older iOS. Each format keeps its own fields.")
            }
            PocketfulButton(
                "+ Add format",
                kind: .secondary,
                disabled: state.additionalStyles.count >= PassStyle.allCases.count - 1
            ) {
                state.additionalStyles.append(EditableAdditionalStyle(style: state.nextUnusedStyle))
            }
        }
    }
}

private struct AdditionalStyleCard: View {
    @Binding var entry: EditableAdditionalStyle
    let index: Int
    let primaryStyle: PassStyle
    let styleOptions: [(value: PassStyle, label: String)]
    let transitOptions: [(value: TransitType, label: String)]
    let onRemove: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 10) {
                Text(String(format: "%02d", index + 1))
                    .font(PocketfulFont.monoMedium(11))
                    .foregroundStyle(PocketfulTheme.dim)
                VStack(alignment: .leading, spacing: 1) {
                    Text(entry.style.displayName)
                        .font(PocketfulFont.textSemiBold(14))
                        .foregroundStyle(PocketfulTheme.text)
                        .lineLimit(1)
                    Text(entry.fields.count == 1 ? "1 field" : "\(entry.fields.count) fields")
                        .font(PocketfulFont.mono(11))
                        .foregroundStyle(PocketfulTheme.dim)
                }
                Spacer(minLength: 0)
                PocketfulButton("Remove", kind: .ghost, compact: true, action: onRemove)
            }

            ChipRow(options: styleOptions, value: entry.style) { entry.select(style: $0) }

            if entry.style == primaryStyle {
                PocketfulNotice("This is already the pass format. Pick a different one or remove this card.", tone: .warning)
            }

            if entry.style == .boardingPass {
                MicroLabel("Transit type")
                ChipRow(options: transitOptions, value: entry.transitType) { entry.transitType = $0 }
            }

            PocketfulDivider()
            FieldsEditorView(fields: $entry.fields, style: entry.style)
        }
        .padding(14)
        .background(PocketfulTheme.card, in: RoundedRectangle(cornerRadius: Radii.plate))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.plate)
                .stroke(PocketfulTheme.border, lineWidth: 0.5)
        )
    }
}

// MARK: - Featured actions

struct FeaturedActionsEditorView: View {
    @Binding var actions: [EditableFeaturedAction]

    private static let typeOptions: [(value: FeaturedActionType, label: String)] = [
        (.viewSchedule, "Schedule"),
        (.watchTrailer, "Trailer"),
        (.listenToMusic, "Music"),
        (.call, "Call"),
        (.place, "Place"),
        (.addToBalance, "Add to balance"),
        (.order, "Order"),
        (.shop, "Shop"),
        (.membershipBenefits, "Benefits"),
        (.bookAppointment, "Appointment"),
        (.bookCar, "Car"),
        (.bookFlight, "Flight"),
        (.bookStay, "Stay"),
        (.viewOffersRewards, "Offers & rewards"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            ForEach(Array($actions.enumerated()), id: \.element.id) { index, $action in
                EditorCard(
                    index: index,
                    title: action.identifier.isEmpty ? "Featured action" : action.identifier,
                    onRemove: { actions.removeAll { $0.id == action.id } }
                ) {
                    MicroLabel("Action type")
                    ChipRow(options: Self.typeOptions, value: action.type) { action.type = $0 }
                    PocketfulInput("Identifier", text: $action.identifier, placeholder: "book-table")
                    PocketfulInput("URL", text: $action.url, placeholder: "https://pocketful.example/book", keyboard: .URL)
                }
            }
            if actions.isEmpty {
                EmptyHint("Up to two tappable actions beneath the pass on iOS 27. Older systems ignore them.")
            }
            PocketfulButton("+ Add featured action", kind: .secondary, disabled: actions.count >= 2) {
                actions.append(EditableFeaturedAction())
            }
        }
    }
}
