# Cabinet expansion

The user approved the full feature brainstorm on October 15, 2026. This document
tracks that scope across several releases. A listed feature is not a shipping
claim. Each feature needs working persistence where applicable, recovery/error
states, owner-boundary checks, export/restore support, accessible controls and
desktop/phone visual verification before being marked complete.

Current work is isolated on `feat/worth-cabinet-tools`, at the user's request.
Do not create a pull request unless requested. Preserve the other session's cover
framing and layout changes in the original checkout.

## Ranking and choosing

- [x] Ranking sandbox with draft recovery, old/new preview and explicit apply.
- [x] Head-to-head placement with Skip and Undo.
- [x] Blind ranking with explicit old/new reveal.
- [x] Private two-to-four-record comparison table, including notes/photos/history.
- [x] Decision draw from Want to try, revisit queue or Favorites, with type filters.
- [x] Saved contextual rankings such as best value or special occasion.
- [ ] Ranking history and a taste time machine. Record future changes; do not fabricate old orders.
- [ ] Dated opinion history, optional reasons and the visit that changed a call.
- [ ] Optional review of older opinions, without reminders or pressure by default.
- [ ] Quiet retrospectives based on real records and explicitly selected periods.

## Capture and organization

- [x] Save a link with a reviewed address-based name suggestion and retained source URL.
- [x] Saved filter/search views.
- [x] Tags, personal care labels and custom stamps with useful filtering.
- [ ] Archive/unarchive collections independently of Trash.
- [x] Duplicate suggestions with open, revisit and keep-both choices; never automatic merging.
- [x] CSV import with column mapping, preview and duplicate review.
- [x] Optional per-item custom detail fields; name-only capture remains.
- [ ] Collection templates and reusable field definitions.
- [ ] Inbox drawer for records awaiting a collection.
- [ ] Phone/browser capture integrations with reviewed destinations.
- [ ] Barcode/ISBN capture with reviewed external lookup and a manual fallback.
- [ ] Reviewed receipt extraction with attachment and line-to-record mapping.
- [ ] Offline reading and pending saves, account isolation, visible sync state and conflict recovery.
- [ ] Home-screen access to capture, a chosen shortlist or a random saved find. Native widgets require a supported platform integration; a web shortcut is not a widget.

## Memories and relationships

- [x] Why saved, recommendation source and recommendation follow-through.
- [ ] Per-visit location, version, order and reaction, separate from the overall call.
- [ ] Related records and an accessible personal constellation view.
- [ ] Same thing across places and linked editions/versions.
- [ ] Replacement chains with a reason for switching.
- [ ] Cross-collection moments, temporary shortlists, evening boards and trip boards.
- [ ] Trip replay from explicit dates/locations, with a readable stop list.
- [x] Purchase date, price/currency, return deadline and ownership status.
- [x] Borrowed/lent records and optional calendar-file return reminders, imported by the user into their calendar.
- [ ] Revisit dates, snooze and an activity calendar.
- [ ] Richer routine plans, exercise aliases and additional explicit measurements.
- [ ] Time capsules with a chosen opening date and a current-vs-snapshot comparison.

## Artwork and small interactions

- [x] More authored collection objects: ramen, sneakers, plants, camera and other suitable categories.
- [x] Optional bookend decorations and physical shelf presentations.
- [x] Faceless undecided paper creature that never implies a personal call.
- [x] Finite filing/stack animation after successful capture, respecting reduced motion.
- [x] Collection keepsake independent of rank.
- [x] Private collection dedication and optional first-record inscription.
- [ ] Caption/arrow annotations stored separately from original photos.
- [ ] Multiple photos, captions, ordering and explicit cover selection.
- [ ] Manually arranged photo collages for covers; original photos retained.
- [ ] Before/after photo slider with a keyboard-accessible alternative.
- [ ] Activity-specific neutral illustrations without scores or call faces.

## Sharing and export

- [x] Collection booklet/mini zine with exact content preview and downloadable output.
- [ ] Personal field guide with selected records, notes and explicit locations.
- [x] Individual recommendation card with a user-written reason and exact preview.
- [ ] Private two-person this-or-that with separate choices and a deliberate reveal.
- [ ] Private collaboration and explicit granular sharing controls.
- [ ] On-device recognition/extraction assistance with reviewed output; no external AI provider.

Existing seven-day public snapshots keep their original fixed title/type-only
scope. New sharing formats must have their own explicit preview and access rules.
No private notes/photos may silently become part of existing links. Native device
capabilities, external lookups, notifications, AI and collaboration need working
integration and validation; do not replace them with decorative controls.

The user chose widgets for both iOS/iPadOS and Android on October 16. Recognition
and extraction must stay on-device, with no paid external AI provider or uploads
for processing. These integrations remain pending; they are not supplied by the
address-only link suggestion or the existing web-app shortcuts.

## First implementation: collection workbench

The first code increment adds a secondary Workbench action to the existing
collection header. The accepted cabinet composition remains the underlying page.
The workbench uses a dark native scrolling dialog, cream comparison cards, the
existing fonts and labeled 44px controls. Phone layouts stack the cards and tools.
This secondary dialog is a deliberate extension of the collection reference.

Sandbox drafts are account/list scoped on the current device for seven days.
Comparison rounds stay in memory and are explicitly described as unsaved on exit.
Applying a draft uses the existing rank revision check. A conflict must be resolved
by resetting to the latest saved ranking; do not silently overwrite it. Draws and
comparison tables do not mutate records. The draw exhausts a shuffled deck before
starting another one, and uses only records eligible for the selected group/type.

Verification status and captures will be recorded with the implementation. None
of the other sections are complete merely because this plan has been written.

## Local verification of the first group

78 tests across 21 files and all 41 browser checks passed locally. Formatting,
ESLint/hooks, unused-code checks, Worker/TypeScript checks and production build
passed. All 12 final focused browser checks passed after correcting phone button contrast
and adding context-load confirmation. Captures and deliberate layout additions are in
[workbench QA](../art/ui-qa/cabinet-tools/README.md). These changes are on the
separate feature branch and have not been deployed. All unchecked entries above
remain unfinished.

## Second implementation: private context

The item editor adds an optional context disclosure after the existing note/dates.
It stores source URLs, reasons, recommendation/follow-up text, location/version,
personal labels/stamps, named custom fields, purchase details and loan details.
Labels/stamps work in collection filters and saved views. Context is searchable,
preserved with merged originals and included in backup/restore. It stays out of
public snapshots. Source URLs can be entered manually; link identity suggestions
and link-first capture remain pending. Per-visit context and linked editions are
also still pending.

Context saves use an independent revision so a stale draft cannot overwrite newer
context. Incomplete URLs, prices and unnamed detail drafts can recover locally.
Calendar downloads contain a reviewed title/date and a one-day-before alarm; the
user imports them into a calendar. Worth does not send notifications.

82 tests and all 47 browser checks passed locally, with a successful typecheck and
production build. Desktop/phone screenshots are reviewed in
[private-context QA](../art/ui-qa/private-context/README.md). This group remains on
the feature branch and has not been deployed.

## Third implementation: booklets and recommendation cards

Booklets & cards in Workbench prepares a self-contained HTML booklet from up to
12 selected records, or an individual 1080px PNG card. Booklets support captions,
a dedication and explicit opt-ins for ranks, calls, notes and photos. Cards use a
chosen record and the user's own message, with optional recipient, collection name
and photo. Preparation happens on the device. Edits invalidate old files and
failed photos can be retried without losing choices. Export drafts recover on
this device for seven days. Native share cancellation never triggers a download.

85 tests, formatting, lint, unused-code checks and the production build passed
locally. All eight new export browser journeys passed serially. The full browser
run passed 53 of 55 cases; the two timed-out cases passed on subsequent runs.
Further interrupted workbench/storage cases passed serially too. Six A5 PDF pages
(in-app and standalone) were rendered and visually reviewed. Desktop/phone captures
and scope limits are in [publishing QA](../art/ui-qa/publishing/README.md).
This remains on the separate branch, without a pull request or deployment.

## Fourth implementation: personal shelves

Your shelf adds paper pockets/book spines, optional sage arch/plant bookends,
one private keepsake, dedication and a record-bound inscription. The earliest-kept
shortcut chooses an available record once, without claiming to know deleted
history or retargeting the inscription. An optional faceless folded-paper creature
accompanies actual no-call counts; it never assigns an opinion.

Choices persist in the owner-checked workspace, including revision conflicts,
bounded account/list device drafts and backup ID remapping. Missing, moved,
merged and trashed record references are omitted from responses and exports.
Ranks and calls stay independent. This is a secondary Workbench presentation,
preserving the existing primary collection composition.

All 87 tests, formatting, lint, unused-code checks and the production build
passed locally. The final full browser run passed all 61 journeys serially,
including shelf Axe, draft/conflict recovery and narrow/long-name layouts. Eight reviewed desktop/phone
captures are in [shelf QA](../art/ui-qa/shelf/README.md). The larger unchecked scope
above remains unfinished. These features have not been deployed.

## Fifth implementation: reviewed capture

Import & capture accepts CSV with explicit column mapping, exact record previews
and individually reviewed duplicate choices. It supports up to 100 records,
quoted/multiline text, calls, dates and retained source URLs. Invalid rows are
excluded; duplicates start unselected. Existing records and rankings are unchanged.
Link capture suggests a name from the address only, keeps the source, and asks
the user to review it. No destination is fetched and no page identity is claimed.

The import transaction binds its result to the owner, active collection, exact
payload and retry key. A frozen device draft is written before the request starts;
an interrupted response can recover and retry without recreating saved records.
Real D1 tests cover 100-record saves and a parent trashed before the transaction.
All 95 tests, formatting, lint, unused-code and production build checks passed.
The final full browser run passed all 69 journeys, including draft/retry recovery,
Axe and narrow/long-content layouts. Reviewed desktop/phone captures and limitations are
in [capture QA](../art/ui-qa/reviewed-capture/README.md). General existing-record
duplicate review is completed separately below; import checks alone did not complete it.

This work remains on the feature branch. Nothing in this tracker claims that the
unchecked features, native widgets or on-device recognition are finished.

## Sixth implementation: existing-record duplicate review

Possible duplicates in the comparison tool groups matching normalized names and
types. Open and Revisit use existing editors; Revisit does not save automatically.
Keep separate saves an exact, reversible group review across devices. Adding a
matching member requires a new review. Current and obsolete saved reviews can be
reopened or removed. No records are merged, deleted or reassigned by these tools.

Reviews share workspace ownership/revision checks, active-reference filtering and
backup ID remapping. One deduplicated reference guard now covers rankings, shelf
choices and reviews. Record-opening actions protect unfinished sandbox changes
and comparison rounds. The item note label now correctly distinguishes public
ranking links from opt-in booklet exports.

All 98 tests and core checks passed locally. The final full browser run passed
all 79 journeys, including ten duplicate-review cases covering Axe, conflicts,
revisit focus, new-member review and long/narrow layouts. Reviewed captures and limits are in
[duplicate QA](../art/ui-qa/duplicates/README.md). The larger unfinished scope
remains tracked above.
