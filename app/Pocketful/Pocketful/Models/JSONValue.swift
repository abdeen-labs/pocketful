import Foundation

/// Arbitrary JSON — used for semantics, userInfo, and upcoming pass entries.
/// Encodes exactly the shape it holds; literals make template data readable.
nonisolated indirect enum JSONValue: Codable, Equatable {
    case string(String)
    case number(Double)
    case bool(Bool)
    case null
    case array([JSONValue])
    case object([String: JSONValue])

    init(from decoder: Decoder) throws {
        let container = try decoder.singleValueContainer()
        if container.decodeNil() {
            self = .null
        } else if let value = try? container.decode(Bool.self) {
            self = .bool(value)
        } else if let value = try? container.decode(Double.self) {
            self = .number(value)
        } else if let value = try? container.decode(String.self) {
            self = .string(value)
        } else if let value = try? container.decode([JSONValue].self) {
            self = .array(value)
        } else if let value = try? container.decode([String: JSONValue].self) {
            self = .object(value)
        } else {
            throw DecodingError.dataCorruptedError(in: container, debugDescription: "Unsupported JSON value.")
        }
    }

    func encode(to encoder: Encoder) throws {
        var container = encoder.singleValueContainer()
        switch self {
        case .string(let value): try container.encode(value)
        case .number(let value): try container.encode(value)
        case .bool(let value): try container.encode(value)
        case .null: try container.encodeNil()
        case .array(let value): try container.encode(value)
        case .object(let value): try container.encode(value)
        }
    }
}

extension JSONValue: ExpressibleByStringLiteral, ExpressibleByIntegerLiteral,
    ExpressibleByFloatLiteral, ExpressibleByBooleanLiteral,
    ExpressibleByArrayLiteral, ExpressibleByDictionaryLiteral {

    init(stringLiteral value: String) { self = .string(value) }
    init(integerLiteral value: Int) { self = .number(Double(value)) }
    init(floatLiteral value: Double) { self = .number(value) }
    init(booleanLiteral value: Bool) { self = .bool(value) }
    init(arrayLiteral elements: JSONValue...) { self = .array(elements) }
    init(dictionaryLiteral elements: (String, JSONValue)...) {
        self = .object(Dictionary(uniqueKeysWithValues: elements))
    }
}

nonisolated enum JSONText {
    /// Ports `parseJsonObject` from the Expo editor: distinguishes invalid
    /// JSON from valid JSON that is not an object.
    static func parseObject(_ text: String, label: String) throws -> [String: JSONValue] {
        guard let data = text.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else {
            throw PassError("\(label) is not valid JSON.")
        }
        guard raw is [String: Any] else {
            throw PassError("\(label) must be a JSON object.")
        }
        do {
            return try JSONDecoder().decode([String: JSONValue].self, from: data)
        } catch {
            throw PassError("\(label) is not valid JSON.")
        }
    }

    /// Ports `parseJsonArray`: a JSON array whose entries are all objects.
    static func parseObjectArray(_ text: String, label: String) throws -> [[String: JSONValue]] {
        guard let data = text.data(using: .utf8),
              let raw = try? JSONSerialization.jsonObject(with: data, options: [.fragmentsAllowed]) else {
            throw PassError("\(label) is not valid JSON.")
        }
        guard let array = raw as? [Any], array.allSatisfy({ $0 is [String: Any] }) else {
            throw PassError("\(label) must be a JSON array of objects.")
        }
        do {
            return try JSONDecoder().decode([[String: JSONValue]].self, from: data)
        } catch {
            throw PassError("\(label) is not valid JSON.")
        }
    }

    /// Pretty-prints a semantics object back into the raw-JSON escape hatch.
    static func prettyPrinted(_ object: [String: JSONValue]) -> String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.prettyPrinted, .sortedKeys]
        guard let data = try? encoder.encode(object) else { return "" }
        return String(data: data, encoding: .utf8) ?? ""
    }
}
