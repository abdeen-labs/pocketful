import Foundation

/// A user-facing validation or transport error. Messages are ported verbatim
/// from the retired Expo app so behavior stays recognizable.
nonisolated struct PassError: LocalizedError {
    let message: String

    init(_ message: String) {
        self.message = message
    }

    var errorDescription: String? { message }
}

/// Payload for the app-wide alert presenter.
struct AlertMessage: Identifiable {
    let id = UUID()
    var title: String
    var message: String
}

extension String {
    /// Mirrors JavaScript's `String.prototype.trim()`.
    var trimmed: String {
        trimmingCharacters(in: .whitespacesAndNewlines)
    }
}
