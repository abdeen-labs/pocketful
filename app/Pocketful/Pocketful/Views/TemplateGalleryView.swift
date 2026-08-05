// The horizontally scrolling template gallery, ported from
// src/components/TemplateGallery.tsx.

import Foundation
import SwiftUI

struct TemplateGalleryView: View {
    var lastAppliedId: String?
    let onApply: (PassTemplate) -> Void

    private static let styleLabels: [PassStyle: String] = [
        .generic: "Membership",
        .storeCard: "Rewards",
        .coupon: "Offer",
        .eventTicket: "Event",
        .boardingPass: "Travel",
    ]

    private static let barcodeLabels: [BarcodeFormat: String] = [
        .qr: "QR",
        .pdf417: "PDF417",
        .aztec: "Aztec",
        .code128: "Code 128",
    ]

    var body: some View {
        VStack(alignment: .leading, spacing: 13) {
            VStack(alignment: .leading, spacing: 3) {
                Text("CURATED STARTING POINTS")
                    .font(AxisFont.monoMedium(11))
                    .tracking(Tracking.micro)
                    .foregroundStyle(Axis.dim)
                Text("Swipe to browse. Your artwork and server settings stay untouched.")
                    .font(AxisFont.text(11))
                    .foregroundStyle(Axis.dim)
            }

            ScrollView(.horizontal, showsIndicators: false) {
                HStack(alignment: .top, spacing: 12) {
                    ForEach(Templates.all) { template in
                        TemplateCardView(
                            template: template,
                            lastApplied: template.id == lastAppliedId,
                            styleLabel: Self.styleLabels[template.style] ?? "",
                            barcodeLabel: template.barcode.flatMap { Self.barcodeLabels[$0.format] },
                            onPress: { onApply(template) }
                        )
                    }
                }
                .padding(.horizontal, 16)
            }
            .padding(.horizontal, -16)

            Text("\(Templates.all.count) templates · Tap any card to use it")
                .font(AxisFont.monoMedium(10))
                .foregroundStyle(Axis.dim)
                .frame(maxWidth: .infinity)
        }
    }
}

private struct TemplateCardView: View {
    let template: PassTemplate
    let lastApplied: Bool
    let styleLabel: String
    let barcodeLabel: String?
    let onPress: () -> Void

    var body: some View {
        let background = Color(hex: template.colors.background)
        let foreground = Color(hex: template.colors.foreground)
        let label = Color(hex: template.colors.label)
        let primary = template.fields.filter { $0.category == .primary }.prefix(2)
        let details = template.fields
            .filter { $0.category == .header || $0.category == .secondary }
            .prefix(2)

        Button(action: onPress) {
            VStack(alignment: .leading, spacing: 11) {
                // Mini pass
                ZStack {
                    background
                    Circle()
                        .fill(label.opacity(0.2))
                        .frame(width: 142, height: 142)
                        .offset(x: 88, y: -60)
                    Circle()
                        .fill(foreground.opacity(0.08))
                        .frame(width: 92, height: 92)
                        .offset(x: -85, y: 62)

                    VStack(alignment: .leading, spacing: 0) {
                        HStack(spacing: 7) {
                            Text(template.glyph)
                                .font(.system(size: 13))
                                .frame(width: 27, height: 27)
                                .background(Color.black.opacity(0.08), in: RoundedRectangle(cornerRadius: 8))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 8)
                                        .stroke(label, lineWidth: 1)
                                )
                            Text(template.logoText.isEmpty ? template.organizationName : template.logoText)
                                .font(.system(size: 12, weight: .heavy))
                                .tracking(-0.15)
                                .foregroundStyle(foreground)
                                .lineLimit(1)
                            Spacer(minLength: 4)
                            Text(styleLabel.uppercased())
                                .font(.system(size: 6.5, weight: .black))
                                .tracking(0.75)
                                .foregroundStyle(foreground)
                                .padding(.horizontal, 7)
                                .padding(.vertical, 4)
                                .background(Color.black.opacity(0.14), in: Capsule())
                        }

                        Spacer(minLength: 6)

                        HStack(alignment: .top, spacing: 12) {
                            if primary.isEmpty {
                                TemplateFieldText(label: nil, value: template.name, valueType: .text, labelColor: label, valueColor: foreground, primary: true)
                            } else {
                                ForEach(Array(primary.enumerated()), id: \.offset) { _, field in
                                    TemplateFieldText(label: field.label, value: field.value, valueType: field.valueType, labelColor: label, valueColor: foreground, primary: true)
                                }
                            }
                        }
                        .frame(minHeight: 39, alignment: .top)

                        Spacer(minLength: 6)

                        HStack(alignment: .bottom, spacing: 10) {
                            HStack(alignment: .top, spacing: 10) {
                                ForEach(Array(details.enumerated()), id: \.offset) { _, field in
                                    TemplateFieldText(label: field.label, value: field.value, valueType: field.valueType, labelColor: label, valueColor: foreground, primary: false)
                                }
                            }
                            Spacer(minLength: 0)
                            if let barcode = template.barcode {
                                BarcodeMark(format: barcode.format)
                            }
                        }
                    }
                    .padding(14)
                }
                .frame(height: 154)
                .overlay {
                    GeometryReader { geo in
                        Circle().fill(Axis.surface).frame(width: 16, height: 16)
                            .position(x: 0, y: 95)
                        Circle().fill(Axis.surface).frame(width: 16, height: 16)
                            .position(x: geo.size.width, y: 95)
                    }
                }
                .clipShape(RoundedRectangle(cornerRadius: 18))

                // Caption
                VStack(alignment: .leading, spacing: 5) {
                    HStack(spacing: 8) {
                        Text(template.name)
                            .font(AxisFont.textSemiBold(15))
                            .tracking(-0.2)
                            .foregroundStyle(Axis.text)
                            .lineLimit(1)
                        Spacer(minLength: 0)
                        Text(lastApplied ? "LAST USED ✓" : "USE TEMPLATE →")
                            .font(AxisFont.monoSemiBold(10))
                            .tracking(0.65)
                            .foregroundStyle(lastApplied ? Axis.success : Axis.link)
                    }
                    Text(template.tagline)
                        .font(AxisFont.text(11))
                        .foregroundStyle(Axis.textSoft)
                        .lineLimit(2)
                        .multilineTextAlignment(.leading)
                        .fixedSize(horizontal: false, vertical: true)
                    if !template.features.isEmpty {
                        WrapLayout(spacing: 5) {
                            ForEach(template.features.prefix(3), id: \.self) { feature in
                                Text(feature)
                                    .font(AxisFont.monoMedium(10))
                                    .foregroundStyle(Axis.textSoft)
                                    .padding(.horizontal, 7)
                                    .padding(.vertical, 4)
                                    .background(Axis.band, in: RoundedRectangle(cornerRadius: Radii.control))
                                    .overlay(
                                        RoundedRectangle(cornerRadius: Radii.control)
                                            .stroke(Axis.border, lineWidth: 0.5)
                                    )
                            }
                        }
                        .padding(.top, 2)
                    }
                    HStack(spacing: 6) {
                        Text(styleLabel)
                        Circle().fill(Axis.borderStrong).frame(width: 3, height: 3)
                        Text("\(template.fields.count) fields")
                        if let barcodeLabel {
                            Circle().fill(Axis.borderStrong).frame(width: 3, height: 3)
                            Text(barcodeLabel)
                        }
                    }
                    .font(AxisFont.monoMedium(10))
                    .foregroundStyle(Axis.dim)
                    .padding(.top, 2)
                }
                .padding(.horizontal, 2)
                .padding(.bottom, 2)
            }
            .padding(9)
            .frame(width: 264)
            .background(lastApplied ? Axis.cardElevated : Axis.surface, in: RoundedRectangle(cornerRadius: Radii.plate))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.plate)
                    .stroke(lastApplied ? Axis.accent : Axis.border, lineWidth: 1)
            )
        }
        .buttonStyle(.plain)
    }
}

private struct TemplateFieldText: View {
    let label: String?
    let value: String
    let valueType: FieldValueType
    let labelColor: Color
    let valueColor: Color
    let primary: Bool

    var body: some View {
        VStack(alignment: .leading, spacing: 1) {
            if let label, !label.isEmpty {
                Text(label.uppercased())
                    .font(.system(size: 7, weight: .black))
                    .tracking(0.7)
                    .foregroundStyle(labelColor)
                    .lineLimit(1)
            }
            Text(displayValue)
                .font(primary
                      ? .system(size: 19, weight: .black)
                      : .system(size: 10, weight: .heavy))
                .tracking(primary ? -0.45 : 0)
                .foregroundStyle(valueColor)
                .lineLimit(1)
        }
    }

    private var displayValue: String {
        guard valueType == .date, let date = EditorState.parseISODate(value) else { return value }
        let formatter = DateFormatter()
        formatter.setLocalizedDateFormatFromTemplate("MMM d")
        return formatter.string(from: date)
    }
}

private struct BarcodeMark: View {
    let format: BarcodeFormat

    var body: some View {
        if format == .code128 || format == .pdf417 {
            HStack(spacing: 1.5) {
                ForEach(Array([2, 1, 3, 1, 2, 4, 1, 3, 2, 1].enumerated()), id: \.offset) { _, width in
                    Rectangle()
                        .fill(Axis.black)
                        .frame(width: CGFloat(width))
                }
            }
            .frame(height: 17)
            .padding(.horizontal, 5)
            .padding(.vertical, 4)
            .background(Axis.white, in: RoundedRectangle(cornerRadius: 4))
        } else {
            ZStack {
                RoundedRectangle(cornerRadius: 4).fill(Axis.white)
                Rectangle().stroke(Axis.black, lineWidth: 2)
                    .frame(width: 7, height: 7)
                    .offset(x: -7, y: -7)
                Rectangle().stroke(Axis.black, lineWidth: 2)
                    .frame(width: 7, height: 7)
                    .offset(x: 7, y: -7)
                Rectangle().stroke(Axis.black, lineWidth: 2)
                    .frame(width: 7, height: 7)
                    .offset(x: -7, y: 7)
                Rectangle().fill(Axis.black)
                    .frame(width: 7, height: 7)
                    .offset(x: 7, y: 7)
            }
            .frame(width: 29, height: 29)
        }
    }
}
