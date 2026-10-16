# Native widget companions — development

These are native iOS/iPadOS and Android companions for Worth, with Capture,
Shortlist and Saved find widgets. **They are not published or verified on a
simulator/device yet.** The web approval/API foundation is separately tested.
Native code does not ship in the website bundle. Do not mark home-screen widgets
complete merely because the source or connection endpoint exists.

Both use an external system browser for account sign-in and explicit approval of
one to five collections. Read tokens last 30 days and cannot write archive records
or access notes, photos or visits. Widget taps open existing reviewed website
routes; Capture focuses name entry and creates nothing automatically. Choose a
single approved collection and saved-find group in the companion; all widgets on
that device use those choices. Shortlist uses actual saved order, with fewer rows
on smaller sizes. Names can be visible to anyone who sees the home screen.

[Protocol, projection, retry boundaries and retention](../docs/WIDGET-CONNECTIONS.md)
are the integration contract. Native endpoints are fixed to
`https://worth.aidenjang.com`; an untrusted callback cannot choose an API host.
The matching Worker and migration 0016 must be available before a real connection
can complete. No deployment or app distribution was performed during this work.

## iOS / iPadOS

Targets iOS 17+, using SwiftUI, WidgetKit and ASWebAuthenticationSession. The app
and extension share an App Group and an AfterFirstUnlockThisDeviceOnly Keychain
access group. Tokens are kept in Keychain; cached names use a protected App Group
file, bound to the connection ID and filter. Replacing or forgetting a connection
clears cached names. Timeline entries include a local expiry entry; WidgetKit
controls the actual update schedule. Apps must be launched once before their
widgets become available in the gallery.

Requires full Xcode with an iOS SDK and XcodeGen 2.46.0. Generate the project:

```sh
cd native/ios
xcodegen generate
open WorthCompanion.xcodeproj
```

Choose your own Development Team for both targets. Register/enable
`group.com.aidenjang.worth` and the shared keychain entitlement in that team.
The app bundle ID is `com.aidenjang.worth`; its extension is
`com.aidenjang.worth.widgets`. The project uses automatic signing but contains no
team ID, signing keys or credentials. A developer account/capabilities are needed
for signed-device testing; this document does not authorize an enrollment or fee.
Generated plists, entitlements and projects are ignored; `project.yml` is their source.

Build without signing, using an installed simulator SDK:

```sh
xcodebuild -project WorthCompanion.xcodeproj -scheme WorthCompanion \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData \
  CODE_SIGNING_ALLOWED=NO build
```

`./native/ios/check-contract.sh` runs three portable Swift contract checks and a
syntax parse with Command Line Tools. It validates S256, strict callback/state,
stale/expired copies and capture URLs. It **does not** compile SwiftUI/WidgetKit
for iOS or exercise keychain access, browser callbacks or installed widgets.

## Android

Targets Android 8+ (API 26), compile/target SDK 36, JDK 17, Android Gradle plugin
8.13.2 and Gradle 8.13. The checked-in wrapper pins and verifies the Gradle ZIP
checksum. Use Android Studio or the official Android SDK tools; install platform
36 and build tools 35.0.0 after accepting Google's SDK agreement yourself.

```sh
cd native/android
./gradlew testDebugUnitTest lintDebug assembleDebug
```

No app signing secrets are checked in. This produces a local debug build, not an
app store release. The system browser handles approval; pending verifier/state and
callback codes stay encrypted with an Android Keystore AES-GCM key. The same
vault encrypts access tokens and cached names. Cloud backup and device transfer
are disabled for this data. No embedded WebView, telemetry or external AI SDK is used.

Three classic RemoteViews providers share explicit collection/filter choices.
JobScheduler refreshes in the background on an available network; local inexact
alarms can redraw an expired copy without a network call. Android controls and
may delay both. The app offers manual refresh. On a redraw, data older than 24
hours or access expiry is discarded. A saved timestamp remains visible; do not
promise real-time sync, exact refresh periods or immediate remote erasure.

## Disconnecting and changing accounts

Revoke widget access in the app while online, or in website Settings → Widget
connections. A failed network revocation keeps the local credential so it can be
retried. Forget on this phone explicitly clears local credentials/cache and explains
that server access may remain until revoked/expired. Website logout does not
revoke a separate widget connection. Disconnect before connecting another account;
new connections never reuse the previous connection's cache.

## Verification status and release gate

Completed locally:

- Web/API: 113 tests, including real D1 ownership, projection, expiry, concurrency,
  parent-race, cancellation, limits and all-data deletion cases.
- Website: 107 full browser journeys; the 12 widget-specific journeys passed again
  after layout corrections. Desktop/phone captures and Axe are in
  [web QA](../art/ui-qa/widget-connections/README.md).
- Swift shared contract: three executable checks passed. Remaining iOS source parsed.
  Shared and widget source also type-check against the available macOS 14 SDK;
  this does not verify an iOS build or the iOS window anchor/signing integration.
- Java shared contract: two JUnit checks passed with a temporary JDK 17.
- Android XML parsed; Gradle wrapper generated from the pinned distribution.
- XcodeGen generated both targets, plists and entitlements successfully.

The separate `Native companions` workflow checks iOS compilation and Android
unit/lint/assembly when native files change, or when manually dispatched. It has
not run remotely on this local-only branch and cannot replace device QA. The iOS
privacy manifest declares App Group user-defaults access (reason 1C8F.1); store
disclosures still need their release review.

Pending before calling native widgets finished:

- [ ] Full iOS SDK build; simulator/device install and valid App Group/Keychain signing.
- [ ] Android unit/lint/assembly with the SDK; install on emulator/device.
- [ ] Browser login and exact return on both platforms, including canceled, expired,
      intercepted, repeated and process-interrupted callbacks.
- [ ] Add/resize all three widgets, empty/unranked/long names, Dynamic Type/font scale,
      VoiceOver/TalkBack, dark/light host appearance and phone/tablet layouts.
- [ ] Change collection/filter, offline manual/background refresh, delayed OS redraw,
      24-hour/credential expiry and server 401; verify timestamps and stale removal.
- [ ] Revoke/forget/reconnect across two accounts with refreshes in flight; verify
      no old names or tokens survive in a new connection.
- [ ] Trash/restore approved collections; website all-data deletion; recovery/revocation.
- [ ] Platform privacy manifests/data safety, icons, signing, distribution and release
      review appropriate to whichever distribution route the owner chooses.

The current Mac has only Apple's Command Line Tools, without an iOS SDK or XCTest.
Android SDK license/setup approval is pending. Native builds and visual behavior
are therefore unverified; these are explicit remaining tasks, not passing checks.

Implementation references:
[Apple widgets](https://developer.apple.com/documentation/widgetkit/creating-a-widget-extension),
[Apple refresh scheduling](https://developer.apple.com/documentation/widgetkit/keeping-a-widget-up-to-date),
[Android app widgets](https://developer.android.com/develop/ui/views/appwidgets),
[Android Keystore](https://developer.android.com/privacy-and-security/keystore),
[AGP compatibility](https://developer.android.com/build/releases/agp-8-13-0-release-notes).
