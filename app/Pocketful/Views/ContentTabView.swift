// Content tab: pass fields, additional formats, and barcodes.

import SwiftUI

struct ContentTabView: View {
    @Bindable var state: EditorState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PocketfulSection(title: "Fields") {
                FieldsEditorView(fields: $state.fields, style: state.style)
            }

            PocketfulSection(
                title: "Additional formats",
                description: "Extra style dictionaries inside the same pass. Wallet renders the newest one it understands, which keeps a poster generic pass installable on iOS 26 and earlier."
            ) {
                AdditionalStylesEditorView(state: state)
            }

            PocketfulSection(title: "Barcodes") {
                BarcodesEditorView(barcodes: $state.barcodes)
            }
        }
    }
}
