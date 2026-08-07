// Content tab: pass fields and barcodes.

import SwiftUI

struct ContentTabView: View {
    @Bindable var state: EditorState

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            PocketfulSection(
                title: "Pass fields",
                description: "Header, primary, secondary, auxiliary, back, and modern event-details fields.",
                badge: "Rich content"
            ) {
                FieldsEditorView(state: state)
            }

            PocketfulSection(
                title: "Barcodes",
                description: "Add ordered fallback formats with their own encodings and visible text.",
                badge: "Up to 4"
            ) {
                BarcodesEditorView(barcodes: $state.barcodes)
            }
        }
    }
}
