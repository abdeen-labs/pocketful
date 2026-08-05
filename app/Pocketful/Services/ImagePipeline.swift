// Photo → center-crop to the slot's aspect → 1x/2x/3x PNG renditions as
// bare base64, keyed `name`, `name@2x`, `name@3x`. Ported from src/lib/images.ts.

import UIKit

struct ProcessedImage {
    /// The 3x rendition, kept for editor previews.
    let preview: UIImage
    /// e.g. ["icon": <b64>, "icon@2x": <b64>, "icon@3x": <b64>]
    let files: [String: String]
}

enum ImagePipeline {
    /// Center-crops the picked image to the slot's aspect ratio and exports
    /// PNG renditions at 1x/2x/3x of the slot's point size — exactly what
    /// Wallet expects to find in the .pkpass.
    static func process(_ source: UIImage, for slot: ImageSlot) throws -> ProcessedImage {
        let sourceSize = source.size
        guard sourceSize.width > 0, sourceSize.height > 0 else {
            throw PassError("The selected image could not be read.")
        }
        let crop = centeredCrop(sourceSize, targetAspect: slot.width / slot.height)

        var files: [String: String] = [:]
        var preview: UIImage? = nil

        for scale in 1...3 {
            let target = CGSize(width: slot.width * CGFloat(scale), height: slot.height * CGFloat(scale))
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            format.opaque = false
            let renderer = UIGraphicsImageRenderer(size: target, format: format)

            let scaleX = target.width / crop.width
            let scaleY = target.height / crop.height
            let drawRect = CGRect(
                x: -crop.minX * scaleX,
                y: -crop.minY * scaleY,
                width: sourceSize.width * scaleX,
                height: sourceSize.height * scaleY
            )
            let png = renderer.pngData { _ in
                source.draw(in: drawRect)
            }
            files[scale == 1 ? slot.name : "\(slot.name)@\(scale)x"] = png.base64EncodedString()
            if scale == 3 { preview = UIImage(data: png) }
        }

        guard let preview else { throw PassError("Image conversion returned no data.") }
        return ProcessedImage(preview: preview, files: files)
    }

    /// The largest rect with the target aspect that fits centered in the source.
    private static func centeredCrop(_ size: CGSize, targetAspect: CGFloat) -> CGRect {
        let sourceAspect = size.width / size.height
        let width: CGFloat
        let height: CGFloat
        if sourceAspect > targetAspect {
            height = size.height
            width = (height * targetAspect).rounded()
        } else {
            width = size.width
            height = (width / targetAspect).rounded()
        }
        return CGRect(
            x: ((size.width - width) / 2).rounded(),
            y: ((size.height - height) / 2).rounded(),
            width: width,
            height: height
        )
    }
}
