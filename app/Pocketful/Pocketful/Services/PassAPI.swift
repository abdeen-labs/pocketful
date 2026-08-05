// POST {server}/api/passes — ported from src/lib/api.ts, same error surface.

import Foundation

nonisolated struct CreatePassResponse: Decodable {
    let id: String
    let url: String
    let expiresAt: String
    /// Present when the pass was created with `updatable: true`.
    let serialNumber: String?
    let updatable: Bool?
}

enum PassAPI {
    static func createPass(serverURL: String, spec: PassSpec, token: String?) async throws -> CreatePassResponse {
        var base = serverURL.trimmed
        while base.hasSuffix("/") { base.removeLast() }
        guard let url = URL(string: "\(base)/api/passes") else {
            throw PassError("Could not reach \(base). Check the server URL and your connection.")
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        if let token, !token.isEmpty {
            request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        }
        request.httpBody = try JSONEncoder().encode(spec)

        let data: Data
        let response: URLResponse
        do {
            (data, response) = try await URLSession.shared.data(for: request)
        } catch {
            throw PassError("Could not reach \(base). Check the server URL and your connection.")
        }

        guard let http = response as? HTTPURLResponse, (200..<300).contains(http.statusCode) else {
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            var message = String(data: data, encoding: .utf8) ?? ""
            if let object = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let serverError = object["error"] as? String {
                message = serverError
            }
            throw PassError(message.isEmpty ? "Server responded with \(status)" : message)
        }
        return try JSONDecoder().decode(CreatePassResponse.self, from: data)
    }
}
