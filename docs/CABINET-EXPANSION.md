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
- [x] Archive/unarchive collections independently of Trash.
- [x] Duplicate suggestions with open, revisit and keep-both choices; never automatic merging.
- [x] CSV import with column mapping, preview and duplicate review.
- [x] Optional per-item custom detail fields; name-only capture remains.
- [x] Collection templates and reusable field definitions.
- [x] Inbox drawer for records awaiting a collection.
- [x] Reviewed web capture, desktop bookmark code and optional installed-browser text/link Share target, with manual paste fallback.
- [ ] Barcode/ISBN capture with reviewed external lookup and a manual fallback.
- [ ] Reviewed receipt extraction with attachment and line-to-record mapping.
- [ ] Offline reading and pending saves, account isolation, visible sync state and conflict recovery.
- [x] Private web/PWA shortcut entry points for capture, a chosen shortlist and a random saved find, with account-specific remembered choices. Browser/OS menu availability varies.

## Memories and relationships

- [x] Why saved, recommendation source and recommendation follow-through.
- [x] Per-visit location, version, order and reaction, separate from the overall call.
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
- [x] Activity-specific neutral illustrations without scores or call faces.

## Sharing and export

- [x] Collection booklet/mini zine with exact content preview and downloadable output.
- [ ] Personal field guide with selected records, notes and explicit locations.
- [x] Individual recommendation card with a user-written reason and exact preview.
- [ ] Private two-person this-or-that with separate choices and a deliberate reveal.
- [ ] Private collaboration and explicit granular sharing controls.
- [x] On-device recognition/extraction assistance with reviewed output; no external AI provider.

Existing seven-day public snapshots keep their original fixed title/type-only
scope. New sharing formats must have their own explicit preview and access rules.
No private notes/photos may silently become part of existing links. Device
capabilities, external lookups, notifications, AI and collaboration need working
integration and validation; do not replace them with decorative controls.

The user clarified on October 16 that Worth must remain a web app. Native iOS and
Android companions, widget-specific approvals/APIs, migration and CI have been
removed from this branch. Home-screen access will use web/PWA shortcuts instead.
Recognition and extraction must stay on-device, without paid external AI or
processing uploads.

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
public snapshots. Source URLs can be entered manually. Reviewed address-based link
capture and per-visit context are completed separately below. Linked editions
remain pending.

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
unchecked web features or on-device recognition are finished.

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

## Seventh implementation: collection archiving

Collection settings can archive/unarchive a collection independently of Trash.
Archived collections leave home, the sidebar and everyday choices. Collections →
Archived and explicitly labeled Search results retain access; owners can still
edit records. Calls, ranks, photos, workspace choices and existing link access/
expiry are unchanged. Patterns and both backup formats include archived content.
Trash restoration retains archive state while keeping its separate link revocation.

Migration 0014 adds one flag, defaulting older collections to current. Backups
preserve it with fresh IDs on restore; old files default to current and archived
activities are rejected. Archive-only updates touch supplied fields and cannot
overwrite a concurrent rename/artwork change. Unsaved settings block the action;
failed saves recover in place. Directory status supports Back navigation. Current
empty copy points to Archived without claiming records disappeared.

All 101 tests and core checks passed locally. The full browser regression passed
all 87 journeys; all eight archiving cases passed again against the final copy/build.
Final formatting/lint checks passed. Eight desktop/phone captures were reviewed
alongside the cabinet references; see [archiving QA](../art/ui-qa/collection-archiving/README.md).
This work remains local on the feature branch. The unchecked scope above,
including web capture integrations and on-device recognition, is unfinished.

## Eighth implementation: private visit details

Each collection revisit can keep an optional location, edition/version, order/setup
and reaction independently of the overall call and ranking. The existing date/note
capture stays simple and opens its detail editor after saving. Private history and
comparison readouts expose preserved text; Search can find it. Public snapshots,
booklets and recommendation cards keep their prior projections.

Migration 0015 adds visit context and log revisions. The detail editor recovers
account/list/log-scoped device drafts for seven days and protects its original
revision. Conflicts keep the draft, with an explicitly confirmed reload of current
saved data. Updates guard owner, original list, revision and active membership.
Older activity clients preserve their existing draft behavior and gain a server
read/write-interval guard; this is not a claim of new activity sync conflict UI.

Context follows original logs through merges, moves, Trash and backup ID remapping.
Old logs/backups remain empty; no earlier reaction is fabricated. Activity entries
reject nonempty collection visit context. All 104 tests and core checks passed
locally. The full browser regression passed 95 journeys; all eight visit-detail
cases passed again after the final spacing adjustment. The final build, formatting
and lint passed, and all four desktop/phone captures were visually reviewed in
[visit QA](../art/ui-qa/visit-context/README.md). The larger unchecked scope remains
unfinished, including web capture integrations and on-device recognition.

## Scope correction: website only

The native companion experiment was removed at the user's request. No native
source, SDK build workflow, widget access tokens, consent screen or related
database migration remains in the repository. Nothing was pushed or deployed.
The completed web features above remain; unchecked web features are still pending.

## Ninth implementation: reusable collection setup

Workbench → Collection setup saves up to 12 unique, optional detail names with
account/list-specific seven-day drafts and revision conflict recovery. Item
editors add missing blank fields explicitly, preserving existing names/values.
Changing definitions never edits records. Name-only capture remains available.

Private setup templates copy a reviewed collection name, description, authored
artwork and saved field names into a new creation draft. Existing creation drafts
need replacement confirmation. Templates never copy records, notes, photos, calls,
ranks or shelf keepsakes. Removal preserves existing collections and creation
drafts. Up to 50 templates are stored per owner; stable creation receipts recover
interrupted requests and prevent late retries from resurrecting removals.

Additive migration 0016 enforces the capacity atomically, including concurrent
saves and restore. Templates and field names round-trip through records and photo
backups; template-only restore is supported. A capacity failure rolls back the
entire restore, including records and its receipt. All-data deletion clears both
templates and retry receipts. Older backups default to no templates.

All 110 unit/component/API checks passed, including real D1 concurrency and
rollback tests. The full 111-journey browser regression passed. Desktop/phone
captures, narrow-width checks and Axe are recorded in
[collection setup QA](../art/ui-qa/collection-templates/README.md). The larger
unchecked web feature list remains unfinished. Work remains on the separate
branch; no push, pull request, merge or deployment was made.

## Tenth implementation: reviewed web capture and private shortcuts

`/capture` receives a reviewed name, source and optional note, including incoming
text/link shares. Applying a share, replacing a draft, choosing a collection,
reviewing duplicates and saving are separate explicit choices. A GET never saves
a record. Incoming content uses short-lived tab staging, stays out of Accounts
return URLs, and becomes an account-scoped recoverable draft only when applied.
A frozen destination/payload and retry identity survive lost responses. The
existing reviewed-import transaction supplies ownership and parent-race guards.
No source page is fetched and no external AI is used.

`/quick` opens a real top-five shortlist or draws once through eligible saved
items, Want to try, revisit queue or Favorites. Archive inclusion is explicit.
Private bookmark URLs expose no public token; optional remembered choices contain
only a collection ID/group and remain scoped to the account on this device. The
manifest provides capture/shortlist/find/workout entries and an optional text/link
Share target. Actual installation and OS menu registration have not been tested;
support varies, so normal web navigation and manual paste remain available. This
is a website feature, with no native companion source or distribution.

A shared account-bound request precondition now rejects stale private reads and
writes if Accounts changes user in another tab. The old app shell is hidden and
a document reload opens a fresh cache; delayed requests retain the old account
binding. Metadata/public snapshots remain independent. This protects drafts and
uncertain saves without claiming to complete full offline reading or queued sync.

All 117 core tests passed, including real D1 account-mismatch checks. The full
129-journey browser regression passed after correcting cream-button hover contrast.
Desktop/phone captures, keyboard review focus, Axe and 320/430/768px reflow checks
are recorded in [web capture QA](../art/ui-qa/web-capture/README.md). The Inbox,
history, OCR, offline sync and other unchecked web features remain unfinished.
No push, pull request, merge, installation or deployment was performed.

## Eleventh implementation: web Inbox

Inbox keeps up to 500 private, unfiled finds without requiring a collection. Web
capture defaults here; applying shared content and saving still require review.
Navigation opens a scrolling overlay over the current page, with a full-page
route for ordinary/private links. The editor preserves notes, context, optional
calls, plans and dates; photos and visits can be added after filing. Explicit
filing moves one saved find into an owned current collection, unranked. Exact
name/type matches require keeping a separate record; no merging is inferred.

Creation and filing use immutable retry payloads and atomic owner/capacity/source/
destination guards. A filing receipt survives independently of the removed source,
so a lost reply can recover after reload. Editing uses a revision and explicit
conflict reload. Unavailable device storage requires confirmation before closing
unfinished changes. A draft for a find filed or removed elsewhere can reopen for
copying, while saving and filing stay disabled. Account changes retain the shared
request precondition and full-document cache boundary.

Inbox context is privately searchable. Trash/Undo recovers finds unfiled for
30 days; restore capacity is guarded atomically. Records/photo backups read Inbox
and collection records in one transaction, avoiding gaps during filing. Restore
supports old version 1 files and new version 2 Inbox-only files, remaps IDs and rolls back all records and the import
receipt on capacity failure. Purge cannot resurrect a late creation/filing retry;
all-data deletion clears both Inbox and its operation receipts.

All 126 tests across 30 files, formatting, lint, unused-code checks, TypeScript
and the production build passed. The full 149-journey browser regression passed;
subsequent isolated recovery fixes passed 40 capture/Inbox journeys and all 22
final Inbox journeys. The versioned backup change then passed six affected
legacy/new-format restore and reflow journeys. Twelve desktop/phone captures
were visually reviewed, with Axe and 320/430/768px checks recorded in
[Inbox QA](../art/ui-qa/inbox/README.md).

History, OCR, full offline sync, relationships, additional artwork/sharing
features and all other unchecked scope remain unfinished. Nothing is pushed or
deployed.

## Twelfth implementation: neutral activity objects

Empty activity logs use a notebook/pencil in the cabinet’s existing empty-state
layout. Empty workout visits use a small bottle/towel beside their original
first-exercise guidance. Both are authored SVG objects, static, decorative and
faceless. No score, call or achievement is inferred, and no data model changes.
The activity shortcut also respects open dialogs, preventing an underlying log
editor from opening behind Inbox or another modal.

Lint, unused-code checks, TypeScript and production build passed. Both desktop/
phone interaction and Axe journeys passed, followed by all five broader layout
regressions at 320, 390, 430, 768 and 1440px. Four captures were inspected in
[activity artwork QA](../art/ui-qa/activity-art/README.md). Other unchecked
features remain unfinished; this work remains local to the feature branch.

## Thirteenth implementation: on-device photo text

Read a photo recognizes English printed text from a bounded JPEG, PNG or WebP
entirely in browser workers, using Worth-hosted engine/language assets. Reading
starts only after an explicit action. Text stays editable; a literal line may
be chosen as the name, and copying text into a private note is optional. A clean,
account-bound handoff opens normal capture review. No record, date, price, call
or rank is inferred or saved automatically; the photo is not uploaded or attached.
The manual paste/name path remains usable when recognition or storage is unavailable.

Source photos and text drafts recover on this account/device for seven days.
Cancellation, failure, timeout, page exit and account changes terminate recognition
workers. Owned handoffs are withheld while signed out and discarded for a different
account, without placing private words in a URL. Draft owners remain fixed during
metadata transitions. The build prepares local assets and supplied notices; its
CSP allows self-hosted WebAssembly without JavaScript string evaluation.

All 134 tests across 33 files, formatting, lint, unused-code checks, TypeScript
and the production build passed. The full browser regression passed all 165
journeys. Real-engine PNG/JPEG reading, WebP cancellation, failed assets, manual
fallback, blocked storage, account boundaries, Axe and narrow reflow are covered.
Reviewed desktop/phone captures are in [photo text QA](../art/ui-qa/photo-text/README.md).
Receipt attachment/line-to-record mapping, full offline sync and all other
unchecked web scope remain unfinished. This is local feature-branch work, with
no native companion, push, pull request or deployment.
