// Artwork slot rows with PhotosPicker-driven selection, ported from
// src/components/ImagesSection.tsx. The system photo picker runs
// out-of-process, so no photo-library permission strings are needed.

import Foundation
import PhotosUI
import SwiftUI
import UIKit

struct ImagesSectionView: View {
    let slots: [ImageSlot]
    @Bindable var state: EditorState

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            ForEach(slots) { slot in
                ImageSlotRow(slot: slot, state: state)
            }
        }
    }
}

private struct ImageSlotRow: View {
    let slot: ImageSlot
    @Bindable var state: EditorState
    @State private var pickerItem: PhotosPickerItem? = nil

    var body: some View {
        let picked = state.images[slot.name]

        VStack(alignment: .leading, spacing: 8) {
            VStack(alignment: .leading, spacing: 2) {
                HStack(spacing: 8) {
                    Text(slot.label)
                        .font(AxisFont.textSemiBold(14))
                        .foregroundStyle(Axis.text)
                    Spacer(minLength: 0)
                    if slot.required {
                        AxisBadge("Required")
                    } else if slot.recommended {
                        AxisBadge("Recommended")
                    }
                }
                Text(slot.hint)
                    .font(AxisFont.text(12))
                    .foregroundStyle(Axis.dim)
            }

            if let picked {
                Rectangle()
                    .fill(Axis.bg)
                    .aspectRatio(slot.aspect, contentMode: .fit)
                    .overlay(
                        Image(uiImage: picked.preview)
                            .resizable()
                            .scaledToFill()
                    )
                    .clipShape(RoundedRectangle(cornerRadius: Radii.control))
                    .frame(maxHeight: 160)
            }

            HStack(spacing: 8) {
                PhotosPicker(selection: $pickerItem, matching: .images) {
                    ZStack {
                        if state.busySlot == slot.name {
                            ProgressView()
                                .tint(Axis.text)
                        } else {
                            Text(picked != nil ? "Replace artwork" : "Choose artwork")
                                .font(AxisFont.monoMedium(13))
                                .foregroundStyle(Axis.textSoft)
                        }
                    }
                    .frame(maxWidth: .infinity)
                    .frame(minHeight: 48)
                    .overlay(
                        RoundedRectangle(cornerRadius: Radii.control)
                            .stroke(Axis.border, lineWidth: 1)
                    )
                }
                .disabled(state.busySlot != nil)

                if picked != nil {
                    AxisButton("Clear", kind: .danger) {
                        state.images[slot.name] = nil
                    }
                }
            }
        }
        .onChange(of: pickerItem) { _, item in
            guard let item else { return }
            Task {
                await load(item)
            }
        }
    }

    private func load(_ item: PhotosPickerItem) async {
        state.busySlot = slot.name
        defer {
            state.busySlot = nil
            pickerItem = nil
        }
        do {
            guard let data = try await item.loadTransferable(type: Data.self),
                  let image = UIImage(data: data) else {
                throw PassError("The selected image could not be read.")
            }
            state.images[slot.name] = try ImagePipeline.process(image, for: slot)
        } catch {
            state.alert = AlertMessage(title: "Artwork error", message: error.localizedDescription)
        }
    }
}
