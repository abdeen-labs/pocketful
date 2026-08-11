// Live pass preview — a stylized approximation of Wallet, not a pixel clone.
// Ported from src/components/PassPreview.tsx.

import Foundation
import SwiftUI

struct PassPreviewView: View {
    var state: EditorState

    private static let styleLabels: [PassStyle: String] = [
        .generic: "Generic pass",
        .storeCard: "Store card",
        .coupon: "Coupon",
        .eventTicket: "Event ticket",
        .boardingPass: "Boarding pass",
        .posterGeneric: "Poster generic",
    ]

    private func validHex(_ value: String, fallback: String) -> String {
        value.range(of: EditorState.hexColorPattern, options: .regularExpression) != nil ? value : fallback
    }

    var body: some View {
        let background = Color(hex: validHex(state.bgColor, fallback: "#131822"))
        let foreground = Color(hex: validHex(state.fgColor, fallback: "#ffffff"))
        let labels = Color(hex: validHex(state.labelColor, fallback: "#a9b2c0"))
        let posterArtwork = state.style == .eventTicket
            ? state.images["artwork"]
            : state.style == .posterGeneric ? state.images["background"] : nil
        let strip = posterArtwork ?? state.images["strip"] ?? state.images["background"]

        VStack(alignment: .leading, spacing: 12) {
            heading
            passCard(
                background: background,
                foreground: foreground,
                labels: labels,
                strip: strip,
                isPoster: posterArtwork != nil
            )
        }
        .padding(.bottom, 22)
    }

    private var heading: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 2) {
                Text("LIVE PREVIEW")
                    .font(PocketfulFont.monoMedium(11))
                    .tracking(Tracking.micro)
                    .foregroundStyle(PocketfulTheme.dim)
                Text(Self.styleLabels[state.style] ?? "")
                    .font(PocketfulFont.textSemiBold(17))
                    .foregroundStyle(PocketfulTheme.text)
            }
            Spacer()
            HStack(spacing: 6) {
                Circle().fill(PocketfulTheme.success).frame(width: 6, height: 6)
                Text("Draft")
                    .font(PocketfulFont.monoMedium(11))
                    .foregroundStyle(PocketfulTheme.textSoft)
            }
            .padding(.horizontal, 10)
            .padding(.vertical, 6)
            .background(PocketfulTheme.card, in: RoundedRectangle(cornerRadius: Radii.control))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.control)
                    .stroke(PocketfulTheme.border, lineWidth: 0.5)
            )
        }
        .padding(.horizontal, 4)
    }

    private func passCard(
        background: Color,
        foreground: Color,
        labels: Color,
        strip: ProcessedImage?,
        isPoster: Bool
    ) -> some View {
        let primary = Array(state.fields.filter { $0.category == .primary && !$0.value.isEmpty }.prefix(2))
        let detail = Array(state.fields.filter {
            [.header, .secondary, .auxiliary].contains($0.category) && !$0.value.isEmpty
        }.prefix(4))

        return VStack(alignment: .leading, spacing: 18) {
            HStack(spacing: 9) {
                if let logo = isPoster
                    ? (state.images["primaryLogo"] ?? state.images["logo"])
                    : state.images["logo"] {
                    Image(uiImage: logo.preview)
                        .resizable()
                        .scaledToFit()
                        .frame(maxWidth: 112, maxHeight: 28, alignment: .leading)
                } else {
                    Text("P")
                        .font(.system(size: 14, weight: .heavy))
                        .foregroundStyle(foreground)
                        .frame(width: 28, height: 28)
                        .overlay(
                            RoundedRectangle(cornerRadius: 8)
                                .stroke(Color.white.opacity(0.34), lineWidth: 1)
                        )
                }
                // Wallet shows logoText beside the logo image only when it is
                // set — no org-name fallback.
                Text(logoLineText(isPoster: isPoster))
                    .font(.system(size: 15, weight: .bold))
                    .foregroundStyle(foreground)
                    .lineLimit(1)
                Spacer(minLength: 0)
                Text(state.style == .boardingPass ? "✈︎" : "◆")
                    .font(.system(size: 20))
                    .foregroundStyle(labels)
            }
            .frame(minHeight: 30)

            HStack(alignment: .top, spacing: 16) {
                if primary.isEmpty {
                    VStack(alignment: .leading, spacing: 3) {
                        Text("DESCRIPTION")
                            .font(.system(size: 9, weight: .heavy))
                            .tracking(0.7)
                            .foregroundStyle(labels)
                        Text(state.descriptionText.isEmpty
                             ? "Your pass description appears here."
                             : state.descriptionText)
                            .font(.system(size: 25, weight: .heavy))
                            .tracking(-0.5)
                            .foregroundStyle(foreground)
                            .lineLimit(2)
                    }
                } else {
                    ForEach(primary) { field in
                        PreviewFieldView(field: field, labelColor: labels, valueColor: foreground, primary: true)
                    }
                }
            }
            .frame(minHeight: 52, alignment: .top)

            if !detail.isEmpty {
                WrapLayout(spacing: 12) {
                    ForEach(detail) { field in
                        PreviewFieldView(field: field, labelColor: labels, valueColor: foreground, primary: false)
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .topLeading)
        .padding(18)
        .padding(.bottom, 56)   // reserve room for the pinned bottom row
        .frame(minHeight: 225, alignment: .topLeading)
        .background {
            ZStack {
                background
                if let strip {
                    Image(uiImage: strip.preview)
                        .resizable()
                        .scaledToFill()
                        .opacity(isPoster ? 0.72 : 0.36)
                }
                Color.black.opacity(0.08)
            }
        }
        .overlay(alignment: .bottom) {
            HStack(alignment: .bottom) {
                if state.activeBarcodeCount > 0 {
                    HStack(spacing: 2) {
                        ForEach(Array([2, 1, 3, 1, 2, 4, 1, 3, 2, 1, 4, 2, 1].enumerated()), id: \.offset) { _, width in
                            Rectangle()
                                .fill(PocketfulTheme.black)
                                .frame(width: CGFloat(width))
                        }
                    }
                    .frame(height: 18)
                    .padding(5)
                    .background(PocketfulTheme.white, in: RoundedRectangle(cornerRadius: 4))
                } else {
                    Text("NO BARCODE")
                        .font(.system(size: 9, weight: .heavy))
                        .tracking(0.7)
                        .foregroundStyle(labels)
                }
                Spacer()
                Text("◉")
                    .font(.system(size: 22))
                    .foregroundStyle(foreground)
            }
            .padding(18)
        }
        .overlay {
            if state.voided {
                ZStack {
                    Color(red: 70 / 255, green: 0, blue: 10 / 255).opacity(0.42)
                    Text("VOID")
                        .font(PocketfulFont.displayHeavy(42))
                        .tracking(5)
                        .foregroundStyle(PocketfulTheme.white)
                        .rotationEffect(.degrees(-12))
                }
            }
        }
        .overlay {
            GeometryReader { geo in
                let y = geo.size.height * 0.58 + 11
                Circle()
                    .fill(PocketfulTheme.bg)
                    .frame(width: 22, height: 22)
                    .position(x: 0, y: y)
                Circle()
                    .fill(PocketfulTheme.bg)
                    .frame(width: 22, height: 22)
                    .position(x: geo.size.width, y: y)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: 24))
        .overlay(
            RoundedRectangle(cornerRadius: 24)
                .stroke(PocketfulTheme.border, lineWidth: 0.5)
        )
    }

    private func logoLineText(isPoster: Bool) -> String {
        if !state.logoText.isEmpty { return state.logoText }
        let resolvedLogo = isPoster
            ? (state.images["primaryLogo"] ?? state.images["logo"])
            : state.images["logo"]
        if resolvedLogo != nil { return "" }
        return state.organizationName.isEmpty ? "Pocketful" : state.organizationName
    }
}

private struct PreviewFieldView: View {
    let field: EditableField
    let labelColor: Color
    let valueColor: Color
    var primary = false

    var body: some View {
        VStack(alignment: .leading, spacing: 2) {
            if !field.label.isEmpty {
                Text(field.label.uppercased())
                    .font(.system(size: 9, weight: .heavy))
                    .tracking(0.7)
                    .foregroundStyle(labelColor)
                    .lineLimit(1)
            }
            Text(field.value)
                .font(primary
                      ? .system(size: 25, weight: .heavy)
                      : .system(size: 14, weight: .bold))
                .tracking(primary ? -0.5 : 0)
                .foregroundStyle(valueColor)
                .lineLimit(primary ? 2 : 1)
        }
    }
}
