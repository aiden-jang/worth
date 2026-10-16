import Foundation

func equal<T: Equatable>(_ actual: T, _ expected: T) {
  precondition(actual == expected, "Contract mismatch")
}
struct ContractChecks {
  static func testStandardProofAndStrictCallback() {
    let now = Date(timeIntervalSince1970: 10000)
    let proof = ConnectionProof(
      verifier: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      state: String(repeating: "B", count: 43), startedAt: now)
    equal(proof.challenge, "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM")
    let code = String(repeating: "A", count: 43)
    let url = "com.aidenjang.worth:/widget-callback?code=\(code)&state=\(proof.state)"
    equal(proof.code(from: URL(string: url)!, now: now), code)
    isNil(proof.code(from: URL(string: url + "&state=elsewhere")!, now: now))
    isNil(
      proof.code(
        from: URL(string: url.replacingOccurrences(of: ":/", with: "://attacker/"))!, now: now))
    isNil(proof.code(from: URL(string: url)!, now: now.addingTimeInterval(900)))
    isNil(proof.code(from: URL(string: url + "#fragment")!, now: now))
  }
  static func testSnapshotExpiresEvenWithoutNetworkRefresh() {
    let snapshot = SavedSnapshot(
      schemaVersion: 1, updatedAt: 100000, expiresAt: 200_000_000, collections: [])
    isTrue(snapshot.usable(at: Date(timeIntervalSince1970: 100)))
    isFalse(snapshot.usable(at: Date(timeIntervalSince1970: 86500)))
    isFalse(snapshot.usable(at: Date(timeIntervalSince1970: 0)))
    let expires = SavedSnapshot(
      schemaVersion: 1, updatedAt: 100000, expiresAt: 200000, collections: [])
    isFalse(expires.usable(at: Date(timeIntervalSince1970: 200)))
  }
  static func testWebCaptureKeepsARealQueryAndNativeSecretsOutOfURL() {
    let url = WidgetConfig.web("lists/owned-id", query: [URLQueryItem(name: "capture", value: "1")])
    equal(url.absoluteString, "https://worth.aidenjang.com/lists/owned-id?capture=1")
  }
}

func isNil<T>(_ value: T?) { precondition(value == nil) }
func isTrue(_ value: Bool) { precondition(value) }
func isFalse(_ value: Bool) { precondition(!value) }
ContractChecks.testStandardProofAndStrictCallback()
ContractChecks.testSnapshotExpiresEvenWithoutNetworkRefresh()
ContractChecks.testWebCaptureKeepsARealQueryAndNativeSecretsOutOfURL()
print("Swift widget contract: 3 checks passed")
