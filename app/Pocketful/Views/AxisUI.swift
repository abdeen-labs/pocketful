// Axis-styled controls, ported from src/components/ui.tsx.

import SwiftUI
import UIKit

// MARK: - Wrapping layout for chip rows and pill clusters

struct WrapLayout: Layout {
    var spacing: CGFloat = 8

    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        let maxWidth = proposal.width ?? .infinity
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        var usedWidth: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
            usedWidth = max(usedWidth, x - spacing)
        }
        let width = maxWidth.isFinite ? maxWidth : usedWidth
        return CGSize(width: width, height: y + rowHeight)
    }

    func placeSubviews(in bounds: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let maxWidth = bounds.width
        var x: CGFloat = 0
        var y: CGFloat = 0
        var rowHeight: CGFloat = 0
        for subview in subviews {
            let size = subview.sizeThatFits(.unspecified)
            if x > 0, x + size.width > maxWidth {
                x = 0
                y += rowHeight + spacing
                rowHeight = 0
            }
            subview.place(
                at: CGPoint(x: bounds.minX + x, y: bounds.minY + y),
                anchor: .topLeading,
                proposal: ProposedViewSize(size)
            )
            x += size.width + spacing
            rowHeight = max(rowHeight, size.height)
        }
    }
}

// MARK: - Section

struct AxisSection<Content: View>: View {
    let title: String
    var description: String? = nil
    var badge: String? = nil
    var collapsed: Binding<Bool>? = nil
    @ViewBuilder let content: () -> Content

    private var isCollapsed: Bool {
        collapsed?.wrappedValue ?? false
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            heading
            if !isCollapsed {
                VStack(alignment: .leading, spacing: 14) {
                    content()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(16)
                .background(Axis.card, in: RoundedRectangle(cornerRadius: Radii.plate))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.plate)
                        .stroke(Axis.border, lineWidth: 0.5)
                )
            }
        }
        .padding(.bottom, 28)
    }

    private var heading: some View {
        HStack(alignment: .top, spacing: 12) {
            VStack(alignment: .leading, spacing: 4) {
                Text(title.uppercased())
                    .font(AxisFont.monoSemiBold(13))
                    .tracking(Tracking.micro)
                    .foregroundStyle(Axis.text)
                if let description {
                    Text(description)
                        .font(AxisFont.text(13))
                        .foregroundStyle(Axis.dim)
                }
            }
            Spacer(minLength: 0)
            HStack(spacing: 8) {
                if let badge {
                    AxisBadge(badge)
                }
                if let collapsed {
                    Text(collapsed.wrappedValue ? "+" : "−")
                        .font(.system(size: 20))
                        .foregroundStyle(Axis.textSoft)
                        .frame(width: 28, height: 28)
                        .background(Axis.surface, in: RoundedRectangle(cornerRadius: Radii.control))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.control)
                                .stroke(Axis.borderStrong, lineWidth: 0.5)
                        )
                }
            }
        }
        .padding(.horizontal, 2)
        .contentShape(Rectangle())
        .onTapGesture {
            if let collapsed {
                withAnimation(.easeInOut(duration: 0.18)) {
                    collapsed.wrappedValue.toggle()
                }
            }
        }
    }
}

// MARK: - Disclosure

struct AxisDisclosure<Content: View>: View {
    let title: String
    var description: String? = nil
    @State private var open: Bool
    private let content: () -> Content

    init(_ title: String, description: String? = nil, defaultOpen: Bool = false, @ViewBuilder content: @escaping () -> Content) {
        self.title = title
        self.description = description
        self.content = content
        _open = State(initialValue: defaultOpen)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Button {
                withAnimation(.easeInOut(duration: 0.18)) {
                    open.toggle()
                }
            } label: {
                HStack(spacing: 12) {
                    VStack(alignment: .leading, spacing: 2) {
                        Text(title)
                            .font(AxisFont.monoMedium(13))
                            .foregroundStyle(Axis.textSoft)
                            .multilineTextAlignment(.leading)
                        if let description {
                            Text(description)
                                .font(AxisFont.text(12))
                                .foregroundStyle(Axis.dim)
                                .multilineTextAlignment(.leading)
                        }
                    }
                    Spacer(minLength: 0)
                    Text(open ? "−" : "+")
                        .font(AxisFont.mono(22))
                        .foregroundStyle(Axis.link)
                }
                .padding(14)
                .background(Axis.surface)
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)

            if open {
                VStack(alignment: .leading, spacing: 13) {
                    content()
                }
                .frame(maxWidth: .infinity, alignment: .leading)
                .padding(14)
                .overlay(alignment: .top) {
                    Rectangle().fill(Axis.border).frame(height: 0.5)
                }
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: Radii.plate))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.plate)
                .stroke(Axis.border, lineWidth: 0.5)
        )
    }
}

// MARK: - Input

struct AxisInput: View {
    let label: String?
    @Binding var text: String
    var placeholder = ""
    var helper: String? = nil
    var multiline = false
    var secure = false
    var keyboard: UIKeyboardType = .default
    var capitalization: TextInputAutocapitalization = .never

    init(
        _ label: String?,
        text: Binding<String>,
        placeholder: String = "",
        helper: String? = nil,
        multiline: Bool = false,
        secure: Bool = false,
        keyboard: UIKeyboardType = .default,
        capitalization: TextInputAutocapitalization = .never
    ) {
        self.label = label
        self._text = text
        self.placeholder = placeholder
        self.helper = helper
        self.multiline = multiline
        self.secure = secure
        self.keyboard = keyboard
        self.capitalization = capitalization
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            if let label {
                Text(label.uppercased())
                    .font(AxisFont.monoMedium(11))
                    .tracking(Tracking.micro)
                    .foregroundStyle(Axis.textSoft)
            }
            field
                .font(AxisFont.mono(14))
                .foregroundStyle(Axis.text)
                .tint(Axis.link)
                .keyboardType(keyboard)
                .textInputAutocapitalization(capitalization)
                .autocorrectionDisabled(true)
                .padding(.horizontal, 13)
                .padding(.vertical, 11)
                .frame(minHeight: multiline ? 104 : 0, alignment: .topLeading)
                .background(Axis.surface, in: RoundedRectangle(cornerRadius: Radii.control))
                .overlay(
                    RoundedRectangle(cornerRadius: Radii.control)
                        .stroke(Axis.border, lineWidth: 1)
                )
            if let helper {
                Text(helper)
                    .font(AxisFont.text(12))
                    .foregroundStyle(Axis.dim)
            }
        }
    }

    @ViewBuilder
    private var field: some View {
        if secure {
            SecureField(placeholder, text: $text)
        } else if multiline {
            TextField(placeholder, text: $text, axis: .vertical)
                .lineLimit(4...12)
        } else {
            TextField(placeholder, text: $text)
        }
    }
}

// MARK: - Chips

struct ChipRow<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    let value: Value
    let onChange: (Value) -> Void

    var body: some View {
        WrapLayout(spacing: 8) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let selected = option.value == value
                Button {
                    onChange(option.value)
                } label: {
                    Text(option.label)
                        .font(AxisFont.monoMedium(13))
                        .foregroundStyle(selected ? Axis.text : Axis.dim)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(selected ? Axis.band : Axis.surface, in: RoundedRectangle(cornerRadius: Radii.control))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.control)
                                .stroke(selected ? Axis.accent : Axis.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

struct MultiChipRow<Value: Hashable>: View {
    let options: [(value: Value, label: String)]
    let values: [Value]
    let onChange: ([Value]) -> Void

    var body: some View {
        WrapLayout(spacing: 8) {
            ForEach(options.indices, id: \.self) { index in
                let option = options[index]
                let selected = values.contains(option.value)
                Button {
                    if selected {
                        onChange(values.filter { $0 != option.value })
                    } else {
                        onChange(values + [option.value])
                    }
                } label: {
                    Text(option.label)
                        .font(AxisFont.monoMedium(13))
                        .foregroundStyle(selected ? Axis.text : Axis.dim)
                        .padding(.horizontal, 12)
                        .padding(.vertical, 8)
                        .background(selected ? Axis.band : Axis.surface, in: RoundedRectangle(cornerRadius: Radii.control))
                        .overlay(
                            RoundedRectangle(cornerRadius: Radii.control)
                                .stroke(selected ? Axis.accent : Axis.border, lineWidth: 1)
                        )
                }
                .buttonStyle(.plain)
            }
        }
    }
}

// MARK: - Toggle row

struct AxisToggleRow: View {
    let label: String
    var description: String? = nil
    @Binding var value: Bool

    init(_ label: String, description: String? = nil, value: Binding<Bool>) {
        self.label = label
        self.description = description
        self._value = value
    }

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 2) {
                Text(label)
                    .font(AxisFont.monoMedium(13))
                    .foregroundStyle(Axis.textSoft)
                if let description {
                    Text(description)
                        .font(AxisFont.text(12))
                        .foregroundStyle(Axis.dim)
                }
            }
            Spacer(minLength: 0)
            Toggle("", isOn: $value)
                .labelsHidden()
                .tint(Axis.accent)
        }
        .frame(minHeight: 44)
    }
}

// MARK: - Notice

struct AxisNotice: View {
    enum Tone {
        case info, warning
    }

    var title: String? = nil
    var tone: Tone = .info
    let text: String

    init(_ text: String, title: String? = nil, tone: Tone = .info) {
        self.text = text
        self.title = title
        self.tone = tone
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let title {
                Text(title)
                    .font(AxisFont.textSemiBold(13))
                    .foregroundStyle(tone == .warning ? Axis.warning : Axis.text)
            }
            Text(text)
                .font(AxisFont.text(12))
                .foregroundStyle(Axis.textSoft)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Axis.surface, in: RoundedRectangle(cornerRadius: Radii.control))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.control)
                .stroke(Axis.border, lineWidth: 0.5)
        )
        .overlay(alignment: .leading) {
            if tone == .warning {
                RoundedRectangle(cornerRadius: 1)
                    .fill(Axis.warning)
                    .frame(width: 2)
            }
        }
    }
}

// MARK: - Badge, divider, micro label

struct AxisBadge: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .font(AxisFont.monoMedium(11))
            .tracking(1)
            .foregroundStyle(Axis.textSoft)
            .padding(.horizontal, 9)
            .padding(.vertical, 4)
            .background(Axis.band, in: RoundedRectangle(cornerRadius: Radii.control))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.control)
                    .stroke(Axis.border, lineWidth: 0.5)
            )
    }
}

struct AxisDivider: View {
    var body: some View {
        Rectangle()
            .fill(Axis.border)
            .frame(height: 0.5)
    }
}

struct MicroLabel: View {
    let text: String

    init(_ text: String) {
        self.text = text
    }

    var body: some View {
        Text(text.uppercased())
            .font(AxisFont.monoMedium(11))
            .tracking(Tracking.micro)
            .foregroundStyle(Axis.textSoft)
    }
}

// MARK: - Button

struct AxisButton: View {
    enum Kind {
        case primary, secondary, danger, ghost
    }

    let title: String
    var kind: Kind = .primary
    var disabled = false
    var loading = false
    var compact = false
    let action: () -> Void

    init(
        _ title: String,
        kind: Kind = .primary,
        disabled: Bool = false,
        loading: Bool = false,
        compact: Bool = false,
        action: @escaping () -> Void
    ) {
        self.title = title
        self.kind = kind
        self.disabled = disabled
        self.loading = loading
        self.compact = compact
        self.action = action
    }

    var body: some View {
        Button(action: action) {
            ZStack {
                if loading {
                    ProgressView()
                        .tint(kind == .primary ? Axis.white : Axis.text)
                } else {
                    Text(title)
                        .font(AxisFont.monoMedium(13))
                        .foregroundStyle(textColor)
                }
            }
            .padding(.horizontal, compact ? 12 : 17)
            .frame(maxWidth: compact ? nil : .infinity)
            .frame(minHeight: compact ? 38 : 48)
            .background(background, in: RoundedRectangle(cornerRadius: Radii.control))
            .overlay(
                RoundedRectangle(cornerRadius: Radii.control)
                    .stroke(borderColor, lineWidth: borderColor == .clear ? 0 : 1)
            )
            .opacity(disabled || loading ? 0.45 : 1)
        }
        .buttonStyle(.plain)
        .disabled(disabled || loading)
    }

    private var background: Color {
        switch kind {
        case .primary: return Axis.accent
        case .secondary, .danger, .ghost: return .clear
        }
    }

    private var borderColor: Color {
        switch kind {
        case .primary, .ghost: return .clear
        case .secondary: return Axis.border
        case .danger: return Axis.accent
        }
    }

    private var textColor: Color {
        switch kind {
        case .primary: return Axis.white
        case .secondary, .ghost: return Axis.textSoft
        case .danger: return Axis.link
        }
    }
}
