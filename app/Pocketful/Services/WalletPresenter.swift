// Downloads a signed pass and presents Apple's add-to-Wallet sheet.
// Ported from modules/wallet-pass/ExpoWalletPassModule.swift with the same
// error taxonomy. Pass URLs are short-lived (production TTL 120 s), so this
// runs immediately after the create call.

import Foundation
import PassKit
import UIKit

final class WalletPresenter: NSObject, PKAddPassesViewControllerDelegate {
    static let shared = WalletPresenter()

    private weak var presentedController: PKAddPassesViewController?

    private override init() {
        super.init()
    }

    func present(passURL: URL) async throws {
        guard PKAddPassesViewController.canAddPasses() else {
            throw PassError("Apple Wallet cannot add passes on this device.")
        }
        guard presentedController == nil else {
            throw PassError("The add-to-Wallet sheet is already open.")
        }

        var request = URLRequest(url: passURL)
        request.cachePolicy = .reloadIgnoringLocalCacheData

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw PassError("Could not download the pass: \(error.localizedDescription)")
        }
        guard let http = response as? HTTPURLResponse else {
            throw PassError("The pass server returned an invalid response.")
        }
        guard (200..<300).contains(http.statusCode) else {
            let serverMessage = (try? JSONSerialization.jsonObject(with: data) as? [String: Any])
                .flatMap { $0["error"] as? String }
            throw PassError(serverMessage ?? "The pass server returned HTTP \(http.statusCode).")
        }

        let pass: PKPass
        do {
            pass = try PKPass(data: data)
        } catch {
            throw PassError("Wallet could not read the signed pass: \(error.localizedDescription)")
        }

        guard let controller = PKAddPassesViewController(pass: pass) else {
            throw PassError("Wallet could not create an add-pass sheet for this pass.")
        }
        guard let presenter = Self.topViewController() else {
            throw PassError("Pocketful could not open the add-to-Wallet sheet.")
        }

        controller.delegate = self
        presentedController = controller
        await withCheckedContinuation { (continuation: CheckedContinuation<Void, Never>) in
            presenter.present(controller, animated: true) {
                continuation.resume()
            }
        }
    }

    func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
        controller.dismiss(animated: true) { [weak self] in
            self?.presentedController = nil
        }
    }

    /// Presents a plain informational alert above whatever is frontmost —
    /// including the add-to-Wallet sheet — mirroring the old RN Alert.
    static func presentInfoAlert(title: String, message: String) {
        guard let presenter = topViewController() else { return }
        let alert = UIAlertController(title: title, message: message, preferredStyle: .alert)
        alert.addAction(UIAlertAction(title: "OK", style: .default))
        presenter.present(alert, animated: true)
    }

    private static func topViewController() -> UIViewController? {
        let scenes = UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
        let windows = scenes.flatMap(\.windows)
        let window = windows.first(where: \.isKeyWindow) ?? windows.first
        var top = window?.rootViewController
        while let presented = top?.presentedViewController {
            top = presented
        }
        return top
    }
}
