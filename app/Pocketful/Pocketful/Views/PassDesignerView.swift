// The single-screen editor: hero, live preview, tab bar, tab content, and
// the create-and-add flow. Ported from src/app/index.tsx.

import Foundation
import SwiftUI

struct PassDesignerView: View {
    @State private var state = EditorState()
    @State private var pendingTemplate: PassTemplate? = nil
    @State private var confirmingTemplate = false

    private static let tabOptions: [(value: EditorState.Tab, label: String)] = [
        (.design, "Design"),
        (.content, "Content"),
        (.smart, "Smart"),
        (.advanced, "Advanced"),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                hero
                    .padding(.bottom, 24)
                PassPreviewView(state: state)
                tabBar
                    .padding(.bottom, 28)

                switch state.tab {
                case .design:
                    DesignTabView(state: state, onTemplate: handleTemplate)
                case .content:
                    ContentTabView(state: state)
                case .smart:
                    SmartTabView(state: state)
                case .advanced:
                    AdvancedTabView(state: state)
                }

                submitCard
                Color.clear.frame(height: 52)
            }
            .padding(.horizontal, 16)
            .padding(.top, 12)
        }
        .background(Axis.bg.ignoresSafeArea())
        .scrollDismissesKeyboard(.interactively)
        .preferredColorScheme(.dark)
        .alert(
            state.alert?.title ?? "",
            isPresented: Binding(
                get: { state.alert != nil },
                set: { if !$0 { state.alert = nil } }
            )
        ) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(state.alert?.message ?? "")
        }
        .alert(
            "Start from “\(pendingTemplate?.name ?? "")”?",
            isPresented: $confirmingTemplate
        ) {
            Button("Cancel", role: .cancel) {
                pendingTemplate = nil
            }
            Button("Apply template") {
                if let template = pendingTemplate {
                    applyTemplate(template)
                }
                pendingTemplate = nil
            }
        } message: {
            Text("This replaces the pass format, identity, colors, fields, barcode, relevant dates, semantic data, style-specific actions, and any bundled template artwork. Other artwork, NFC credentials, and server settings stay as they are.")
        }
    }

    // MARK: - Chrome

    private var hero: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 12) {
                Image("SealKey")
                    .resizable()
                    .scaledToFit()
                    .frame(width: 24, height: 24)
                Rectangle()
                    .fill(Axis.border)
                    .frame(width: 0.5, height: 16)
                Text("ABDEEN LABS")
                    .font(AxisFont.monoMedium(11))
                    .tracking(2.42)
                    .foregroundStyle(Axis.textSoft)
            }
            Text("POCKETFUL")
                .font(AxisFont.displayHeavy(28))
                .tracking(28 * Tracking.display)
                .foregroundStyle(Axis.text)
            Text("A complete, visual editor for signed Apple Wallet passes.")
                .font(AxisFont.text(13))
                .foregroundStyle(Axis.textSoft)
        }
        .frame(maxWidth: .infinity, minHeight: 148, alignment: .leading)
        .padding(22)
        .background(Axis.card, in: RoundedRectangle(cornerRadius: Radii.shell))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.shell)
                .stroke(Axis.border, lineWidth: 0.5)
        )
    }

    private var tabBar: some View {
        VStack(alignment: .leading, spacing: 11) {
            ChipRow(options: Self.tabOptions, value: state.tab) { state.tab = $0 }
            WrapLayout(spacing: 6) {
                AxisBadge("\(state.fields.count) fields")
                AxisBadge("\(state.images.count) artwork")
                AxisBadge("\(state.localizations.count) languages")
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(12)
        .background(Axis.card, in: RoundedRectangle(cornerRadius: Radii.plate))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.plate)
                .stroke(Axis.border, lineWidth: 0.5)
        )
    }

    private var submitCard: some View {
        VStack(alignment: .leading, spacing: 16) {
            VStack(alignment: .leading, spacing: 3) {
                Text("Ready for Wallet?")
                    .font(AxisFont.textSemiBold(17))
                    .foregroundStyle(Axis.text)
                Text("The server will validate, sign, and return the finished pass.")
                    .font(AxisFont.text(12))
                    .foregroundStyle(Axis.dim)
            }
            AxisButton("Create pass & add to Wallet", loading: state.submitting, action: submit)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(18)
        .background(Axis.cardElevated, in: RoundedRectangle(cornerRadius: Radii.plate))
        .overlay(
            RoundedRectangle(cornerRadius: Radii.plate)
                .stroke(Axis.borderStrong, lineWidth: 1)
        )
    }

    // MARK: - Actions

    private func handleTemplate(_ template: PassTemplate) {
        if !state.hasContent {
            applyTemplate(template)
            return
        }
        pendingTemplate = template
        confirmingTemplate = true
    }

    private func applyTemplate(_ template: PassTemplate) {
        do {
            try state.applyTemplate(template)
        } catch {
            state.alert = AlertMessage(title: "Template artwork error", message: error.localizedDescription)
        }
    }

    private func submit() {
        let spec: PassSpec
        do {
            spec = try state.createSpec()
        } catch {
            state.alert = AlertMessage(title: "Check your pass", message: error.localizedDescription)
            return
        }

        state.submitting = true
        Task {
            defer { state.submitting = false }
            do {
                let created = try await PassAPI.createPass(
                    serverURL: state.serverUrl.trimmed,
                    spec: spec,
                    token: state.apiToken.trimmed.isEmpty ? nil : state.apiToken.trimmed
                )
                guard let url = URL(string: created.url) else {
                    throw PassError("The server returned an invalid pass URL.")
                }
                try await WalletPresenter.shared.present(passURL: url)
                if let serial = created.serialNumber {
                    // Shown over the add-to-Wallet sheet, like the old RN Alert.
                    WalletPresenter.presentInfoAlert(
                        title: "Updatable pass created",
                        message: "Serial number:\n\(serial)\n\nUse it with PUT /api/passes/<serial> (or the MCP update_pass tool) to push changes to Wallet."
                    )
                }
            } catch {
                state.alert = AlertMessage(title: "Could not create pass", message: error.localizedDescription)
            }
        }
    }
}

#Preview {
    PassDesignerView()
}
