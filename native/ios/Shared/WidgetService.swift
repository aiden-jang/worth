import Foundation

struct WidgetService {
  enum Failure: LocalizedError {
    case reconnect, unavailable, invalid
    var errorDescription: String? {
      switch self {
      case .reconnect: "Connection expired or revoked. Reconnect in the companion."
      case .unavailable: "Couldn’t refresh. Check your connection and try again."
      case .invalid: "Couldn’t read this connection. Start again."
      }
    }
  }
  // No cookies, third-party endpoints, analytics, redirects or shared URL cache.
  private final class NoRedirects: NSObject, URLSessionTaskDelegate {
    func urlSession(
      _ session: URLSession, task: URLSessionTask,
      willPerformHTTPRedirection response: HTTPURLResponse,
      newRequest request: URLRequest, completionHandler: @escaping (URLRequest?) -> Void
    ) { completionHandler(nil) }
  }
  private func request(
    _ path: String, method: String = "GET", token: String? = nil, body: [String: String]? = nil,
    query: [URLQueryItem] = []
  ) async throws -> Data {
    let config = URLSessionConfiguration.ephemeral
    config.httpCookieStorage = nil
    config.httpShouldSetCookies = false
    config.urlCache = nil
    config.timeoutIntervalForRequest = 20
    config.timeoutIntervalForResource = 25
    let session = URLSession(configuration: config, delegate: NoRedirects(), delegateQueue: nil)
    defer { session.invalidateAndCancel() }
    var request = URLRequest(url: WidgetConfig.web("api/widgets/\(path)", query: query))
    request.httpMethod = method
    if let token { request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization") }
    if let body {
      request.httpBody = try JSONSerialization.data(withJSONObject: body)
      request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    }
    let (data, response) = try await session.data(for: request)
    guard let response = response as? HTTPURLResponse else { throw Failure.unavailable }
    if [401, 403].contains(response.statusCode) { throw Failure.reconnect }
    guard (200..<300).contains(response.statusCode), data.count <= 262144 else {
      throw Failure.unavailable
    }
    return data
  }
  func exchange(code: String, proof: ConnectionProof) async throws -> WidgetCredential {
    let data = try await request(
      "token", method: "POST", body: ["code": code, "verifier": proof.verifier])
    let credential = try JSONDecoder().decode(WidgetCredential.self, from: data)
    guard
      credential.accessToken.range(of: "^[A-Za-z0-9_-]{43}$", options: .regularExpression) != nil,
      UUID(uuidString: credential.deviceId) != nil,
      credential.expiresAt > Date().timeIntervalSince1970 * 1000
    else { throw Failure.invalid }
    return credential
  }
  func refresh() async throws -> SavedSnapshot {
    let store = WidgetStore()
    guard let credential = store.credential() else { throw Failure.reconnect }
    if credential.expiresAt <= Date().timeIntervalSince1970 * 1000 {
      store.forget(expected: credential.deviceId)
      throw Failure.reconnect
    }
    let filter = store.filter
    do {
      let data = try await request(
        "snapshot", token: credential.accessToken,
        query: [URLQueryItem(name: "find", value: filter)])
      let snapshot = try JSONDecoder().decode(SavedSnapshot.self, from: data)
      guard snapshot.usable(), snapshot.expiresAt <= credential.expiresAt,
        snapshot.collections.count <= 5
      else { throw Failure.invalid }
      guard store.credential()?.deviceId == credential.deviceId, store.filter == filter else {
        throw Failure.invalid
      }
      try store.cache(snapshot, for: credential, filter: filter)
      return snapshot
    } catch Failure.reconnect {
      store.forget(expected: credential.deviceId)
      throw Failure.reconnect
    }
  }
  func disconnect() async throws {
    let store = WidgetStore()
    guard let credential = store.credential() else { return }
    do {
      _ = try await request("connection", method: "DELETE", token: credential.accessToken)
    } catch Failure.reconnect {
      // Already unusable at the server.
    }
    // Network failures keep the token so the user can retry revocation.
    guard store.forget(expected: credential.deviceId) else { throw WidgetStore.StoreError.keychain }
  }
}
