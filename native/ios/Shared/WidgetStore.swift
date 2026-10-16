import Foundation
import Security

struct WidgetStore {
  private let defaults = UserDefaults(suiteName: WidgetConfig.group)!
  private var keychainQuery: [String: Any] {
    [
      kSecClass as String: kSecClassGenericPassword,
      kSecAttrService as String: "worth-widget-connection",
      kSecAttrAccount as String: "current",
      kSecAttrAccessGroup as String: Bundle.main.object(forInfoDictionaryKey: "WidgetKeychainGroup")
        as? String ?? "",
    ]
  }
  func credential() -> WidgetCredential? {
    var query = keychainQuery
    query[kSecReturnData as String] = true
    query[kSecMatchLimit as String] = kSecMatchLimitOne
    var result: CFTypeRef?
    guard SecItemCopyMatching(query as CFDictionary, &result) == errSecSuccess,
      let data = result as? Data
    else { return nil }
    return try? JSONDecoder().decode(WidgetCredential.self, from: data)
  }
  func save(_ credential: WidgetCredential) throws {
    let data = try JSONEncoder().encode(credential)
    let attributes: [String: Any] = [
      kSecValueData as String: data,
      kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlockThisDeviceOnly,
    ]
    let status = SecItemUpdate(keychainQuery as CFDictionary, attributes as CFDictionary)
    if status == errSecItemNotFound {
      let insert = keychainQuery.merging(attributes) { _, new in new }
      guard SecItemAdd(insert as CFDictionary, nil) == errSecSuccess else {
        throw StoreError.keychain
      }
    } else if status != errSecSuccess {
      throw StoreError.keychain
    }
    clearCache()
    defaults.removeObject(forKey: "collection")
  }
  @discardableResult
  func forget(expected: String? = nil) -> Bool {
    // A late response for a previous account must not erase a new connection.
    if let expected, credential()?.deviceId != expected { return false }
    let status = SecItemDelete(keychainQuery as CFDictionary)
    clearCache()
    defaults.removeObject(forKey: "collection")
    return status == errSecSuccess || status == errSecItemNotFound
  }
  var collectionId: String {
    get { defaults.string(forKey: "collection") ?? "" }
    nonmutating set { defaults.set(newValue, forKey: "collection") }
  }
  var filter: String {
    get {
      let value = defaults.string(forKey: "filter") ?? "all"
      return WidgetConfig.filters.contains(value) ? value : "all"
    }
    nonmutating set {
      defaults.set(WidgetConfig.filters.contains(newValue) ? newValue : "all", forKey: "filter")
      clearCache()
    }
  }
  private var cacheURL: URL? {
    FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: WidgetConfig.group)?
      .appendingPathComponent("snapshot.json")
  }
  func cached() -> SavedSnapshot? {
    guard let credential = credential(), let url = cacheURL, let data = try? Data(contentsOf: url),
      let cached = try? JSONDecoder().decode(CachedSnapshot.self, from: data),
      cached.deviceId == credential.deviceId, cached.filter == filter,
      cached.snapshot.expiresAt <= credential.expiresAt, cached.snapshot.usable()
    else { return nil }
    return cached.snapshot
  }
  func cache(
    _ snapshot: SavedSnapshot, for connection: WidgetCredential, filter requestedFilter: String
  ) throws {
    guard credential()?.deviceId == connection.deviceId, filter == requestedFilter,
      snapshot.usable()
    else { return }
    guard let url = cacheURL else { throw StoreError.group }
    let data = try JSONEncoder().encode(
      CachedSnapshot(deviceId: connection.deviceId, filter: requestedFilter, snapshot: snapshot))
    try data.write(
      to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
  }
  func clearCache() { if let url = cacheURL { try? FileManager.default.removeItem(at: url) } }
  enum StoreError: Error { case keychain, group }
}
