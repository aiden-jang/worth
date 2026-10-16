import AuthenticationServices
import Security
import SwiftUI
import WidgetKit

@MainActor
final class Companion: NSObject, ObservableObject, ASWebAuthenticationPresentationContextProviding {
  @Published var snapshot = WidgetStore().cached()
  @Published var credential = WidgetStore().credential()
  @Published var status = ""
  @Published var busy = false
  @Published var canRetry = false
  private var session: ASWebAuthenticationSession?
  private var proof: ConnectionProof?
  private var code: String?
  func presentationAnchor(for session: ASWebAuthenticationSession) -> ASPresentationAnchor {
    UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }
      .flatMap(\.windows).first(where: \.isKeyWindow) ?? ASPresentationAnchor()
  }
  private func secret() throws -> String {
    var bytes = [UInt8](repeating: 0, count: 32)
    guard SecRandomCopyBytes(kSecRandomDefault, bytes.count, &bytes) == errSecSuccess else {
      throw WidgetService.Failure.invalid
    }
    return ConnectionProof.base64url(Data(bytes))
  }
  func connect() {
    guard !busy, credential == nil else { return }
    do {
      let proof = ConnectionProof(verifier: try secret(), state: try secret(), startedAt: Date())
      self.proof = proof
      code = nil
      canRetry = false
      busy = true
      status = "Choose collections in your browser, then return to Worth."
      session = ASWebAuthenticationSession(url: proof.url, callbackURLScheme: WidgetConfig.scheme) {
        [weak self] url, error in
        Task { @MainActor in
          guard let self else { return }
          self.session = nil
          self.busy = false
          guard error == nil, let url else {
            self.status = "Connection canceled."
            self.proof = nil
            return
          }
          guard let code = proof.code(from: url) else {
            self.status = "Couldn’t confirm this return. Start a fresh connection."
            self.proof = nil
            return
          }
          self.code = code
          await self.finishConnection()
        }
      }
      session?.presentationContextProvider = self
      if session?.start() != true {
        busy = false
        status = "Couldn’t open your browser. Try again."
        self.proof = nil
      }
    } catch { status = "Couldn’t prepare a secure connection. Try again." }
  }
  func finishConnection() async {
    guard !busy, let proof, let code else { return }
    guard Date().timeIntervalSince(proof.startedAt) < 900 else {
      canRetry = false
      self.proof = nil
      self.code = nil
      status = "Start a fresh connection."
      return
    }
    busy = true
    defer { busy = false }
    do {
      let next = try await WidgetService().exchange(code: code, proof: proof)
      try WidgetStore().save(next)
      credential = next
      snapshot = nil
      canRetry = false
      self.proof = nil
      self.code = nil
      status = "Connected. Refreshing approved collections…"
      await refreshConnected()
    } catch WidgetService.Failure.reconnect {
      canRetry = false
      self.proof = nil
      self.code = nil
      status = "Connection request expired or canceled. Start again."
    } catch {
      canRetry = true
      status = "Couldn’t finish connecting. Retry within five minutes, or start again."
    }
  }
  private func refreshConnected() async {
    do {
      snapshot = try await WidgetService().refresh()
      status = "Updated."
    } catch {
      credential = WidgetStore().credential()
      snapshot = WidgetStore().cached()
      status = error.localizedDescription
    }
    WidgetCenter.shared.reloadAllTimelines()
  }
  func refresh() async {
    guard !busy else { return }
    busy = true
    defer { busy = false }
    await refreshConnected()
  }
  func disconnect() async {
    guard !busy else { return }
    busy = true
    defer { busy = false }
    do {
      try await WidgetService().disconnect()
      credential = nil
      snapshot = nil
      status = "Widget access revoked."
    } catch {
      status =
        "Couldn’t revoke access. Retry, or revoke this connection in Worth’s website settings."
    }
    WidgetCenter.shared.reloadAllTimelines()
  }
  func forget() {
    guard WidgetStore().forget() else {
      status = "Couldn’t clear secure storage. Revoke access in website Settings and try again."
      return
    }
    snapshot = nil
    credential = nil
    canRetry = false
    code = nil
    proof = nil
    status = "Removed from this phone. Revoke any remaining connection in website Settings."
    WidgetCenter.shared.reloadAllTimelines()
  }
}

@main struct WorthCompanionApp: App {
  @StateObject private var model = Companion()
  @State private var collection = WidgetStore().collectionId
  @State private var filter = WidgetStore().filter
  @State private var confirmForget = false
  var body: some Scene {
    WindowGroup {
      NavigationStack {
        Form {
          Section {
            Text(
              "Names, types and saved order from collections you approve. Notes, photos and visit details stay in the website."
            )
            Text("Widget names can be visible to anyone who sees your home screen.").font(.footnote)
          }
          Section("Connection") {
            if let connection = model.credential {
              Text(connection.name)
              Text(
                "Expires \(Date(timeIntervalSince1970: connection.expiresAt / 1000).formatted())"
              ).font(.footnote)
              Button("Refresh now") { Task { await model.refresh() } }
              Button("Revoke widget access", role: .destructive) {
                Task { await model.disconnect() }
              }
              Button("Forget on this phone", role: .destructive) { confirmForget = true }
            } else {
              Button("Connect collections in browser") { model.connect() }
              if model.canRetry {
                Button("Retry connection") { Task { await model.finishConnection() } }
              }
            }
            if !model.status.isEmpty {
              Text(model.status).accessibilityAddTraits(.updatesFrequently)
            }
          }.disabled(model.busy)
          if let snapshot = model.snapshot, model.credential != nil {
            Section("Widgets") {
              Picker("Collection", selection: $collection) {
                Text("Choose a collection").tag("")
                ForEach(snapshot.collections) { Text($0.name).tag($0.id) }
              }
              Picker("Saved find", selection: $filter) {
                Text("All saved items").tag("all")
                Text("Want to try").tag("want")
                Text("Revisit queue").tag("queue")
                Text("Favorites").tag("favorites")
              }
              Text(
                "Saved \(snapshot.date.formatted()). Widgets refresh when iOS allows. Old copies are discarded after 24 hours or access expiry when the widget redraws."
              ).font(.footnote)
              Text(
                "These choices apply to all Worth widgets on this device. Add Capture, Shortlist or Saved find from your home screen’s widget gallery."
              ).font(.footnote)
            }.disabled(model.busy)
          }
          Section {
            Link("Open Worth", destination: WidgetConfig.origin)
            Link("Manage connections on the website", destination: WidgetConfig.web("settings"))
            Text(
              "Disconnect before changing accounts. Website sign-out alone does not revoke this device’s widget access."
            ).font(.footnote)
          }
        }
        .navigationTitle("Worth widgets")
        .tint(Color(red: 0.91, green: 0.86, blue: 0.62))
        .preferredColorScheme(.dark)
        .task { if model.credential != nil { await model.refresh() } }
        .onChange(of: collection) { _, next in
          WidgetStore().collectionId = next
          WidgetCenter.shared.reloadAllTimelines()
        }
        .onChange(of: filter) { _, next in
          WidgetStore().filter = next
          Task { await model.refresh() }
        }
        .confirmationDialog(
          "Forget on this phone?", isPresented: $confirmForget, titleVisibility: .visible
        ) {
          Button("Forget this connection", role: .destructive) {
            model.forget()
            collection = ""
          }
        } message: {
          Text(
            "Clears local credentials and saved names. This does not revoke server access; you can revoke the device in website Settings."
          )
        }
      }
    }
  }
}
