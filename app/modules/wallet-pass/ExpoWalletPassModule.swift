internal import ExpoModulesCore
import Foundation
import PassKit
import UIKit

/** Downloads a signed pass and presents Apple's add-to-Wallet sheet in Pocketful. */
internal final class ExpoWalletPassModule: Module, PKAddPassesViewControllerDelegate {
  private weak var presentedController: PKAddPassesViewController?

  func definition() -> ModuleDefinition {
    Name("ExpoWalletPass")

    AsyncFunction("present") { (url: URL, promise: Promise) in
      guard PKAddPassesViewController.canAddPasses() else {
        promise.reject("ERR_WALLET_UNAVAILABLE", "Apple Wallet cannot add passes on this device.")
        return
      }

      guard self.presentedController == nil else {
        promise.reject("ERR_WALLET_ALREADY_PRESENTED", "The add-to-Wallet sheet is already open.")
        return
      }

      var request = URLRequest(url: url)
      request.cachePolicy = .reloadIgnoringLocalCacheData

      URLSession.shared.dataTask(with: request) { [weak self] data, response, error in
        if let error {
          promise.reject("ERR_PASS_DOWNLOAD", "Could not download the pass: \(error.localizedDescription)")
          return
        }

        guard let httpResponse = response as? HTTPURLResponse else {
          promise.reject("ERR_PASS_DOWNLOAD", "The pass server returned an invalid response.")
          return
        }

        guard (200..<300).contains(httpResponse.statusCode), let data else {
          let serverMessage = data
            .flatMap { try? JSONSerialization.jsonObject(with: $0) as? [String: Any] }
            .flatMap { $0["error"] as? String }
          let message = serverMessage ?? "The pass server returned HTTP \(httpResponse.statusCode)."
          promise.reject("ERR_PASS_DOWNLOAD", message)
          return
        }

        let pass: PKPass
        do {
          pass = try PKPass(data: data)
        } catch {
          promise.reject("ERR_INVALID_PASS", "Wallet could not read the signed pass: \(error.localizedDescription)")
          return
        }

        DispatchQueue.main.async { [weak self] in
          guard let self else {
            promise.reject("ERR_WALLET_UNAVAILABLE", "The Wallet presenter is no longer available.")
            return
          }
          guard let presenter = self.appContext?.utilities?.currentViewController() else {
            promise.reject("ERR_WALLET_UNAVAILABLE", "Pocketful could not open the add-to-Wallet sheet.")
            return
          }
          guard let controller = PKAddPassesViewController(pass: pass) else {
            promise.reject("ERR_INVALID_PASS", "Wallet could not create an add-pass sheet for this pass.")
            return
          }

          self.presentedController = controller
          controller.delegate = self
          presenter.present(controller, animated: true) {
            promise.resolve(nil)
          }
        }
      }.resume()
    }
    .runOnQueue(DispatchQueue.main)
  }

  func addPassesViewControllerDidFinish(_ controller: PKAddPassesViewController) {
    controller.dismiss(animated: true) { [weak self] in
      self?.presentedController = nil
    }
  }
}
