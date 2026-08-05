// Bundled artwork for the two templates that ship it. Ported from
// src/lib/templateArtwork.ts. The PNGs live in Resources/TemplateArtwork,
// renamed "<template>-<base>-<n>x.png" because bundle resources are flat.

import UIKit

enum TemplateArtwork {
    /// slot name in the spec -> base file name on disk. The `logo` slot
    /// deliberately reuses the primary-logo renditions, as the old app did.
    private static let slotBases: [(slot: String, base: String)] = [
        ("icon", "icon"),
        ("primaryLogo", "primary-logo"),
        ("logo", "primary-logo"),
        ("secondaryLogo", "secondary-logo"),
        ("artwork", "artwork"),
    ]

    private static let bundledTemplateIDs: Set<String> = ["midnight-live", "harbor-fc"]

    private static var cache: [String: [String: ProcessedImage]] = [:]

    /// Returns [:] for templates without bundled artwork.
    static func load(templateID: String) throws -> [String: ProcessedImage] {
        guard bundledTemplateIDs.contains(templateID) else { return [:] }
        if let cached = cache[templateID] { return cached }

        var result: [String: ProcessedImage] = [:]
        for entry in slotBases {
            var files: [String: String] = [:]
            var preview: UIImage? = nil
            for scale in 1...3 {
                let resource = "\(templateID)-\(entry.base)-\(scale)x"
                guard let url = Bundle.main.url(forResource: resource, withExtension: "png"),
                      let data = try? Data(contentsOf: url) else {
                    throw PassError("Bundled \(entry.slot) artwork could not be loaded.")
                }
                files[scale == 1 ? entry.slot : "\(entry.slot)@\(scale)x"] = data.base64EncodedString()
                if scale == 3 { preview = UIImage(data: data) }
            }
            guard let preview else {
                throw PassError("Bundled \(entry.slot) artwork could not be loaded.")
            }
            result[entry.slot] = ProcessedImage(preview: preview, files: files)
        }
        cache[templateID] = result
        return result
    }
}
