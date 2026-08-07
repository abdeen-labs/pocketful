// The pass-field list editor, ported from src/components/FieldsEditor.tsx.

import SwiftUI
import UIKit

struct FieldsEditorView: View {
    @Bindable var state: EditorState

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            if state.fields.isEmpty {
                VStack(spacing: 5) {
                    Text("No content fields yet")
                        .font(PocketfulFont.textSemiBold(15))
                        .foregroundStyle(PocketfulTheme.textSoft)
                    Text("Add the visible text, dates, numbers, and back-of-pass details Wallet should render.")
                        .font(PocketfulFont.text(12))
                        .foregroundStyle(PocketfulTheme.dim)
                        .multilineTextAlignment(.center)
                }
                .frame(maxWidth: .infinity)
                .padding(20)
                .background(PocketfulTheme.surface, in: RoundedRectangle(cornerRadius: Radii.plate))
            }

            ForEach(Array($state.fields.enumerated()), id: \.element.id) { index, $field in
                FieldCardView(
                    field: $field,
                    index: index,
                    style: state.style,
                    onRemove: {
                        state.fields.removeAll { $0.id == field.id }
                    }
                )
            }

            PocketfulButton("+ Add pass field", kind: .secondary) {
                state.fields.append(EditableField())
            }
        }
    }
}

private struct FieldCardView: View {
    @Binding var field: EditableField
    let index: Int
    let style: PassStyle
    let onRemove: () -> Void

    private var categoryOptions: [(value: FieldCategory, label: String)] {
        var options: [(value: FieldCategory, label: String)] = [
            (.header, "Header"),
            (.primary, "Primary"),
            (.secondary, "Secondary"),
            (.auxiliary, "Auxiliary"),
            (.back, "Back"),
        ]
        if style == .eventTicket {
            options.append((.additionalInfo, "Event details"))
        }
        return options
    }

    private static let valueTypeOptions: [(value: FieldValueType, label: String)] = [
        (.text, "Text"),
        (.number, "Number"),
        (.date, "Date"),
    ]

    private static let alignmentOptions: [(value: PassTextAlignment?, label: String)] = [
        (nil, "Automatic"),
        (.left, "Left"),
        (.center, "Center"),
        (.right, "Right"),
        (.natural, "Natural"),
    ]

    private static let dateStyleOptions: [(value: PassDateStyle?, label: String)] = [
        (nil, "Automatic"),
        (PassDateStyle.none, "None"),
        (.short, "Short"),
        (.medium, "Medium"),
        (.long, "Long"),
        (.full, "Full"),
    ]

    private static let numberStyleOptions: [(value: PassNumberStyle?, label: String)] = [
        (nil, "Automatic"),
        (.decimal, "Decimal"),
        (.percent, "Percent"),
        (.scientific, "Scientific"),
        (.spellOut, "Spell out"),
    ]

    private static let detectorOptions: [(value: DataDetectorType, label: String)] = [
        (.phoneNumber, "Phone"),
        (.link, "Link"),
        (.address, "Address"),
        (.calendarEvent, "Calendar"),
    ]

    private static let rowOptions: [(value: Int?, label: String)] = [
        (nil, "Automatic"),
        (0, "Row 1"),
        (1, "Row 2"),
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            HStack(spacing: 10) {
                Text("\(index + 1)")
                    .font(PocketfulFont.monoSemiBold(12))
                    .foregroundStyle(PocketfulTheme.textSoft)
                    .frame(width: 28, height: 28)
                    .background(PocketfulTheme.band, in: Circle())
                    .overlay(Circle().stroke(PocketfulTheme.border, lineWidth: 0.5))
                VStack(alignment: .leading, spacing: 1) {
                    Text(!field.label.isEmpty ? field.label : (!field.key.isEmpty ? field.key : "Untitled field"))
                        .font(PocketfulFont.textSemiBold(14))
                        .foregroundStyle(PocketfulTheme.text)
                        .lineLimit(1)
                    Text("\(field.category.rawValue) · \(field.valueType.rawValue)")
                        .font(PocketfulFont.mono(11))
                        .foregroundStyle(PocketfulTheme.dim)
                }
                Spacer(minLength: 0)
                PocketfulButton("Remove", kind: .ghost, compact: true, action: onRemove)
            }

            ChipRow(options: categoryOptions, value: field.category) { field.category = $0 }

            HStack(alignment: .top, spacing: 10) {
                PocketfulInput("Label", text: $field.label, placeholder: "MEMBER")
                PocketfulInput("Unique key", text: $field.key, placeholder: "\(field.category.rawValue)-\(index + 1)")
            }

            ChipRow(options: Self.valueTypeOptions, value: field.valueType) { field.valueType = $0 }

            PocketfulInput(
                field.valueType == .date ? "ISO-8601 date value" : (field.valueType == .number ? "Numeric value" : "Value"),
                text: $field.value,
                placeholder: field.valueType == .date
                    ? "2026-09-01T19:30:00-04:00"
                    : (field.valueType == .number ? "42.50" : "Jane Appleseed"),
                keyboard: field.valueType == .number ? .decimalPad : .default
            )

            PocketfulDisclosure("Formatting & behavior", description: "Attributed display, updates, alignment, data detection, and type-specific formatting") {
                PocketfulInput("Attributed value", text: $field.attributedValue, placeholder: "Optional rich display value")
                PocketfulInput("Change message", text: $field.changeMessage, placeholder: "Gate changed to %@", helper: "Use %@ where Wallet should insert the new value.")
                MicroLabel("Text alignment")
                ChipRow(options: Self.alignmentOptions, value: field.textAlignment) { field.textAlignment = $0 }
                if field.category == .back {
                    MicroLabel("Automatic data detection")
                    MultiChipRow(options: Self.detectorOptions, values: field.dataDetectorTypes) { field.dataDetectorTypes = $0 }
                }
                if field.valueType == .date {
                    MicroLabel("Date style")
                    ChipRow(options: Self.dateStyleOptions, value: field.dateStyle) { field.dateStyle = $0 }
                    MicroLabel("Time style")
                    ChipRow(options: Self.dateStyleOptions, value: field.timeStyle) { field.timeStyle = $0 }
                    PocketfulToggleRow("Ignore time zone", value: $field.ignoresTimeZone)
                    PocketfulToggleRow("Show relative date", description: "For example, “in 3 hours.”", value: $field.isRelative)
                }
                if field.valueType == .number {
                    MicroLabel("Number style")
                    ChipRow(options: Self.numberStyleOptions, value: field.numberStyle) { field.numberStyle = $0 }
                    PocketfulInput("Currency code", text: $field.currencyCode, placeholder: "USD", capitalization: .characters)
                }
                if style == .eventTicket, field.category == .auxiliary {
                    MicroLabel("Auxiliary row")
                    ChipRow(options: Self.rowOptions, value: field.row) { field.row = $0 }
                }
                PocketfulInput(
                    "Field semantics (JSON)",
                    text: $field.semanticsJson,
                    placeholder: "{\n  \"seat\": { \"seatNumber\": \"12A\" }\n}",
                    helper: "Any passkit-generator semantic tags object. Leave blank for none.",
                    multiline: true
                )
            }
        }
        .padding(14)
        .background(PocketfulTheme.cardElevated, in: RoundedRectangle(cornerRadius: Radii.plate))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.plate)
                .stroke(PocketfulTheme.border, lineWidth: 1)
        )
    }
}
