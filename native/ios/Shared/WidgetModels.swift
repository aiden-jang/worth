import CryptoKit
import Foundation

// Mirrors src/shared/widgets.ts. IDs belong to the approved snapshot, never device guesses.
struct SavedEntry: Codable, Equatable, Identifiable {
  let id: String
  let title: String
  let type: String
  var rank: Int?
}
struct SavedCollection: Codable, Equatable, Identifiable {
  let id: String
  let name: String
  let ranked: [SavedEntry]
  let find: SavedEntry?
}
struct SavedSnapshot: Codable, Equatable {
  let schemaVersion: Int
  let updatedAt: Double
  let expiresAt: Double
  let collections: [SavedCollection]
  var date: Date { Date(timeIntervalSince1970: updatedAt / 1000) }
  func usable(at now: Date = Date()) -> Bool {
    let millis = now.timeIntervalSince1970 * 1000
    return schemaVersion == 1 && updatedAt <= millis + 60000
      && millis < min(expiresAt, updatedAt + 86_400_000)
  }
}
struct WidgetCredential: Codable, Equatable {
  let accessToken: String
  let deviceId: String
  let expiresAt: Double
  let name: String
}
struct CachedSnapshot: Codable {
  let deviceId: String
  let filter: String
  let snapshot: SavedSnapshot
}
enum WidgetConfig {
  static let origin = URL(string: "https://worth.aidenjang.com")!
  static let group = "group.com.aidenjang.worth"
  static let scheme = "com.aidenjang.worth"
  static let filters = ["all", "want", "queue", "favorites"]
  static func web(_ path: String, query: [URLQueryItem] = []) -> URL {
    var parts = URLComponents(
      url: origin.appendingPathComponent(path), resolvingAgainstBaseURL: false)!
    parts.queryItems = query.isEmpty ? nil : query
    return parts.url!
  }
}
struct ConnectionProof {
  let verifier: String
  let state: String
  let startedAt: Date
  static func base64url(_ data: Data) -> String {
    data.base64EncodedString().replacingOccurrences(of: "+", with: "-")
      .replacingOccurrences(of: "/", with: "_").replacingOccurrences(of: "=", with: "")
  }
  static func digest(_ string: String) -> String {
    base64url(Data(SHA256.hash(data: Data(string.utf8))))
  }
  var challenge: String { Self.digest(verifier) }
  func code(from url: URL, now: Date = Date()) -> String? {
    guard now.timeIntervalSince(startedAt) >= 0, now.timeIntervalSince(startedAt) < 900,
      let parts = URLComponents(url: url, resolvingAgainstBaseURL: false),
      parts.scheme == WidgetConfig.scheme, parts.host == nil, parts.path == "/widget-callback",
      parts.fragment == nil, let query = parts.queryItems, query.count == 2,
      query.filter({ $0.name == "state" }).count == 1,
      query.first(where: { $0.name == "state" })?.value == state,
      let code = query.first(where: { $0.name == "code" })?.value,
      code.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil
    else { return nil }
    return code
  }
  var url: URL {
    WidgetConfig.web(
      "widgets/connect",
      query: [
        URLQueryItem(name: "challenge", value: challenge),
        URLQueryItem(name: "state", value: state),
        URLQueryItem(name: "platform", value: "ios"),
        URLQueryItem(name: "name", value: "Worth iPhone / iPad"),
      ])
  }
}
