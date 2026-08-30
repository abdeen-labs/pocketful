// Content tab: pass fields and barcodes.

import SwiftUI

struct ContentTabView: View {
    @Bindable var state: EditorState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PocketfulSection(title: "Fields") {
                FieldsEditorView(state: state)
            }

            PocketfulSection(title: "Barcodes") {
                BarcodesEditorView(barcodes: $state.barcodes)
            }
        }
    }
}
