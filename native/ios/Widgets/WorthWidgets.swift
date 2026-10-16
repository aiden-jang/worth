import SwiftUI
import WidgetKit

struct WorthEntry: TimelineEntry {
  let date: Date
  let snapshot: SavedSnapshot?
  let collectionId: String
  var collection: SavedCollection? { snapshot?.collections.first { $0.id == collectionId } }
}
struct WorthProvider: TimelineProvider {
  func placeholder(in context: Context) -> WorthEntry {
    WorthEntry(date: Date(), snapshot: nil, collectionId: "")
  }
  func getSnapshot(in context: Context, completion: @escaping (WorthEntry) -> Void) {
    completion(
      WorthEntry(
        date: Date(), snapshot: context.isPreview ? nil : WidgetStore().cached(),
        collectionId: WidgetStore().collectionId))
  }
  func getTimeline(in context: Context, completion: @escaping (Timeline<WorthEntry>) -> Void) {
    Task {
      let snapshot = (try? await WidgetService().refresh()) ?? WidgetStore().cached()
      let now = Date()
      let collectionId = WidgetStore().collectionId
      var entries = [WorthEntry(date: now, snapshot: snapshot, collectionId: collectionId)]
      if let snapshot {
        let expiry = Date(
          timeIntervalSince1970: min(snapshot.expiresAt, snapshot.updatedAt + 86_400_000) / 1000)
        entries.append(
          WorthEntry(date: max(expiry, now.addingTimeInterval(1)), snapshot: nil, collectionId: ""))
      }
      completion(Timeline(entries: entries, policy: .after(now.addingTimeInterval(900))))
    }
  }
}
struct WorthWidgetView: View {
  @Environment(\.widgetFamily) private var family
  let entry: WorthEntry
  let mode: String
  private var destination: URL {
    guard let collection = entry.collection else {
      return URL(string: "com.aidenjang.worth:/open")!
    }
    let query =
      mode == "capture"
      ? [URLQueryItem(name: "capture", value: "1")]
      : mode == "find"
        ? entry.collection?.find.map { [URLQueryItem(name: "focus", value: "item:\($0.id)")] } ?? []
        : []
    return WidgetConfig.web("lists/\(collection.id)", query: query)
  }
  var body: some View {
    VStack(alignment: .leading, spacing: 8) {
      Text("worth / \(mode == "capture" ? "capture" : mode == "find" ? "saved find" : "shortlist")")
        .font(.caption).foregroundStyle(Color(red: 0.91, green: 0.86, blue: 0.62))
      if let collection = entry.collection, let snapshot = entry.snapshot {
        Text(collection.name).font(.headline).lineLimit(2)
        if mode == "capture" {
          Label("Keep a name", systemImage: "plus").font(.title3)
          Text("Opens capture in Worth.").font(.caption)
        } else if mode == "find" {
          if let item = collection.find {
            Text(item.title).font(.title3).lineLimit(3).accessibilityLabel(item.title)
            if !item.type.isEmpty { Text(item.type).font(.caption).lineLimit(1) }
          } else {
            Text("No items in this saved-find group.").font(.caption)
          }
        } else if collection.ranked.isEmpty {
          Text("No ranked items yet.").font(.caption)
        } else {
          ForEach(
            Array(
              collection.ranked.prefix(family == .systemSmall ? 1 : family == .systemMedium ? 3 : 5)
            )
          ) { item in
            Text("\(item.rank ?? 0). \(item.title)").font(.subheadline).lineLimit(1)
              .accessibilityLabel("Rank \(item.rank ?? 0): \(item.title)")
          }
        }
        Spacer(minLength: 0)
        Text("Saved \(snapshot.date.formatted(date: .abbreviated, time: .shortened))").font(
          .caption2
        ).foregroundStyle(.secondary)
      } else {
        Text("Choose a collection in the Worth companion.").font(.headline)
        Text("Open to connect or refresh.").font(.caption)
      }
    }
    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
    .foregroundStyle(Color(red: 0.94, green: 0.93, blue: 0.87))
    .containerBackground(Color(red: 0.094, green: 0.098, blue: 0.082), for: .widget)
    .widgetURL(destination)
  }
}
@MainActor
private func configuration(_ mode: String) -> some WidgetConfiguration {
  StaticConfiguration(kind: "worth.\(mode)", provider: WorthProvider()) {
    WorthWidgetView(entry: $0, mode: mode)
  }
  .configurationDisplayName(
    mode == "capture" ? "Capture" : mode == "find" ? "Saved find" : "Shortlist"
  )
  .description("Approved names and saved order. Choose a collection in the Worth companion.")
  .supportedFamilies([.systemSmall, .systemMedium, .systemLarge])
}
struct CaptureWidget: Widget {
  var body: some WidgetConfiguration { configuration("capture") }
}
struct ShortlistWidget: Widget {
  var body: some WidgetConfiguration { configuration("shortlist") }
}
struct FindWidget: Widget {
  var body: some WidgetConfiguration { configuration("find") }
}
@main struct WorthWidgets: WidgetBundle {
  var body: some Widget {
    CaptureWidget()
    ShortlistWidget()
    FindWidget()
  }
}
