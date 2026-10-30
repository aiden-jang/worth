# Cabinet expansion

Verification follows [quality checks](QUALITY.md). Per-run audit records, test totals
and screenshots remain in Git history. The feature and data contracts below remain current.

The user approved the full feature brainstorm on October 15, 2026. This document
tracks that scope across several releases. A listed feature is not a shipping
claim. Each feature needs working persistence where applicable, recovery/error
states, owner-boundary checks, export/restore support, accessible controls and
desktop/phone visual verification before being marked complete.

The web expansion was integrated into main in `cefcf56`. The checked inventory
below records its implemented scope; dated implementation/verification sections
are historical notes from that work, including its former feature branch.
Current maintenance uses verified direct commits to main, without a PR.

## Ranking and choosing

- [x] Ranking sandbox with draft recovery, old/new preview and explicit apply.
- [x] Head-to-head placement with Skip and Undo.
- [x] Blind ranking with explicit old/new reveal.
- [x] Private two-to-four-record comparison table, including notes/photos/history.
- [x] Decision draw from Want to try, revisit queue or Favorites, with type filters.
- [x] Saved contextual rankings such as best value or special occasion.
- [x] Ranking history and a taste time machine. Record future changes; do not fabricate old orders.
- [x] Dated opinion history, optional reasons and the visit that changed a call.
- [x] Optional review of older opinions, without reminders or pressure by default.
- [x] Quiet retrospectives based on real records and explicitly selected periods.

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
- [x] Barcode/ISBN capture with reviewed external lookup and a manual fallback.
- [x] Reviewed receipt extraction with attachment and line-to-record mapping.
- [x] Offline reading and pending saves, account isolation, visible sync state and conflict recovery.
- [x] Private web/PWA shortcut entry points for capture, a chosen shortlist and a random saved find, with account-specific remembered choices. Browser/OS menu availability varies.

## Memories and relationships

- [x] Why saved, recommendation source and recommendation follow-through.
- [x] Per-visit location, version, order and reaction, separate from the overall call.
- [x] Related records and an accessible personal constellation view.
- [x] Same thing across places and linked editions/versions.
- [x] Replacement chains with a reason for switching.
- [x] Cross-collection moments, temporary shortlists, evening boards and trip boards.
- [x] Trip replay from explicit dates/locations, with a readable stop list.
- [x] Purchase date, price/currency, return deadline and ownership status.
- [x] Borrowed/lent records and optional calendar-file return reminders, imported by the user into their calendar.
- [x] Revisit dates, snooze and an activity calendar.
- [x] Richer routine plans, exercise aliases and additional explicit measurements.
- [x] Time capsules with a chosen opening date and a current-vs-snapshot comparison.

## Artwork and small interactions

- [x] More authored collection objects: ramen, sneakers, plants, camera and other suitable categories.
- [x] Optional bookend decorations and physical shelf presentations.
- [x] Faceless undecided paper creature that never implies a personal call.
- [x] Finite filing/stack animation after successful capture, respecting reduced motion.
- [x] Collection keepsake independent of rank.
- [x] Private collection dedication and optional first-record inscription.
- [x] Caption/arrow annotations stored separately from original photos.
- [x] Multiple photos, captions, ordering and explicit cover selection.
- [x] Manually arranged photo collages for covers; original photos retained.
- [x] Before/after photo slider with a keyboard-accessible alternative.
- [x] Activity-specific neutral illustrations without scores or call faces.

## Sharing and export

- [x] Collection booklet/mini zine with exact content preview and downloadable output.
- [x] Personal field guide with selected records, notes and explicit locations.
- [x] Individual recommendation card with a user-written reason and exact preview.
- [x] Private two-person this-or-that with separate choices and a deliberate reveal.
- [x] Private collaboration and explicit granular sharing controls.
- [x] On-device recognition/extraction assistance with reviewed output; no external AI provider.

Existing seven-day public snapshots keep their original fixed title/type-only
scope. New sharing formats must have their own explicit preview and access rules.
No private notes/photos may silently become part of existing links. Device
capabilities, external lookups, notifications, AI and collaboration need working
integration and validation; do not replace them with decorative controls.

The user clarified on October 16 that Worth must remain a web app. Native iOS and
Android companions, widget-specific approvals/APIs, migration and CI have been
removed before integration. Home-screen access uses web/PWA shortcuts instead.
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

## Third implementation: booklets and recommendation cards

Booklets & cards in Workbench prepares a self-contained HTML booklet from up to
12 selected records, or an individual 1080px PNG card. Booklets support captions,
a dedication and explicit opt-ins for ranks, calls, notes and photos. Cards use a
chosen record and the user's own message, with optional recipient, collection name
and photo. Preparation happens on the device. Edits invalidate old files and
failed photos can be retried without losing choices. Export drafts recover on
this device for seven days. Native share cancellation never triggers a download.

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
General existing-record duplicate review is completed separately below.

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
reject nonempty collection visit context.

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

## Eleventh implementation: web Inbox

Inbox keeps up to 500 private, unfiled finds without requiring a collection. Web
capture defaults here; applying shared content and saving still require review.
Navigation opens a scrolling overlay over the current page, with a full-page
route for ordinary/private links. The editor preserves notes, context, optional
calls, plans and dates. The later Unfiled-memory extension also keeps one optional
experience and photo before filing; see [everyday flow](EVERYDAY.md). Explicit
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

## Fourteenth implementation: barcode and ISBN capture

Read a code decodes EAN-8/EAN-13/UPC-A photos in a bounded on-device browser worker,
with typed ISBN-10/ISBN-13 and manual naming available. Source photos stay in the
page and are discarded on exit. An optional, explicit Open Library JSON lookup
sends a checked ISBN, without photos, notes, credentials or referrer. Returned
images/URLs are ignored; bounded plain metadata stays an unapplied suggestion.
Users check the edition before copying a title or details, with confirmation
before replacing filled fields. This is free catalog metadata, not an AI provider.

The review shows exactly which code, note and optional source will enter the
existing account-bound capture flow. No record/call/rank is inferred or saved
here. Owner-scoped text drafts recover for seven days; photos do not. Failed or
unsupported reading, no match, provider errors, offline lookup and cancellation
retain the manual path. Account recovery aborts both lookup and decoding.

## Fifteenth implementation: quiet period retrospectives

Patterns → Look back reads a chosen one-to-366-day period of currently kept finds,
Inbox entries, collection visits and activity logs. Presets only fill controls;
Show this period is explicit, including after draft recovery. Saved finds use
actual local calendar boundaries and dated logs retain their entered days. One
owned list excludes Inbox; archived collections require an explicit choice.
Counts remain complete while each group shows the latest 50 with a narrowing
message. Names/notes are current saved text; no earlier call, rank, trial or
deleted history is fabricated. Private notes appear only after selection.

Owner/list/active-parent guards and the shared account precondition protect each
source. Counts and both record groups share one D1 snapshot, including Inbox
filing. Query cancellation/account recovery removes old results. Control drafts
recover for seven days without automatically querying or reopening a recap.
Failures, blocked storage and offline state retain useful controls/retry. No
persistent record table, backup format or public sharing projection changes.

A reproduced device-zone change initially shifted displayed saved days without
applying a new period. The applied calendar now governs rendering too, with a
readable zone label. Native calendar checks also cover Santiago’s midnight gap,
Apia’s skipped day, historical second-level boundaries and the final supported
date. The broad run exposed an activity test reloading before close navigation
finished; it now waits for the hidden dialog and clean route rather than sleeping
or weakening checks.

## Sixteenth implementation: future ranking and opinion history

Workbench → Taste history records future old/new ranking and call changes in the
same database transaction as the change. Existing records, creation/import and
restore do not invent earlier events. Moves/merge/Trash rank removals are covered;
unchanged values add nothing. Opinion history follows its original record across
moves, retains merged originals and is hidden with unavailable parents. Rank
snapshots retain missing positions as gaps and show current names explicitly.
Before/after/current comparisons remain read-only; reusing an older order enters
the existing sandbox and still requires preview and revision-checked apply.

Reasons and a visit that changed a call are optional, private and independently
revision checked. Saved-detail reload keeps an unfinished draft for deliberate
review. Account/device drafts recover for seven days; blocked storage requires
explicit close confirmation. Older-opinion review uses an optional date cutoff
and has no reminders. History reads paginate 50 changes with date-tied cursors.

Migration `0018_taste_history.sql` adds event storage and atomic SQLite triggers.
Item patches also guard the row read during the request; ranking applies recheck
active references in the update. Version 3 exports include history in the records
snapshot. Restore accepts versions 1/2/3, remaps all references and preserves gaps,
dates and reasons without creating extra events. History exports support 10,000
changes and 16 MB of history within existing backup constraints; oversized history
returns an explicit error without omitting events. Public projections are unchanged.

## Seventeenth implementation: private record connections

Patterns → Connections links related finds, editions/versions, the same thing
across places and directional replacement chains. Each record keeps its own call,
rank and content. Replacement links require a reason and reject loops inside the
write. Symmetric pairs canonicalize, with duplicate protection. Current location/
version labels distinguish similarly named records. The faceless constellation
shows up to 12 real neighbors with legible numbered nodes and a readable legend;
the full list pages 25 matching connections, preserving type, direction and reason.

Creation freezes an account/device payload before sending. Lost replies can retry
exactly or check the saved ID; another review is explicit. Reasons use independent
revisions, preserve stale drafts and show saved details before a deliberate retry.
Blocked storage, offline controls and route changes retain visible recovery.
Archived collections are labeled and explicit in creation choices. Moves retain
links; merged originals remain identifiable; Trash hides affected links until
restoration. Removal retains its retry identity, so old requests cannot resurrect
it. Purging a source cascades its connections.

Migration `0019_record_connections.sql` adds storage, uniqueness and atomic
1,000-link capacity enforcement. Version 4 exports include connections in the
same records snapshot. Restore accepts versions 1–4, checks references, duplicate
pairs and replacement cycles, and canonicalizes after fresh ID remapping. Capacity
failure rolls back all records and its receipt; freeing space permits the same
restore retry. Public projections remain unchanged. A small history editor fix
also compares a recovered draft against newly loaded saved details.

## Eighteenth implementation: personal field guides

Patterns → Field guide assembles up to 12 records across owned collections in a
manual order, with captions and an introduction. Notes, literal saved locations,
collection names and photos are independent default-off choices. Calls, ranks,
visits and other context stay out. Source records remain unchanged. Exact
preparation creates an offline HTML file with embedded fonts/license and optional
photos, plus an isolated A5 print preview. Edits invalidate the prior file.

Account/device seven-day drafts retain captions and fallback names if a source
becomes unavailable; partial preparation stays blocked until recovery/removal.
Blocked storage, route changes and account switches have explicit recovery. The
shared photo exporter now checks image dimensions before decode and reencodes
displayed pixels without original EXIF/XMP, leaving stored sources untouched.
Visible photo content is not redacted. There is no schema or backup version change.

## Nineteenth implementation: revisit plans and activity calendar

Record context keeps an optional original revisit day and a later snoozed day,
with normal revision-checked saves and seven-day draft recovery. Clearing snooze
returns to the original date. Calls, ranks and the manual revisit queue stay
independent; logging a visit never clears a plan automatically. Worth schedules
no reminders. Plans follow Inbox filing and record moves, and are hidden by Trash.

Patterns → Activity calendar reads complete monthly day counts and a 50-entry
keyset page for a selected day in one owned D1 snapshot. Actual entered visits and
activity logs have separate labels from plans. Archived collections are explicit.
Desktop days use an ordered month grid; phone dates use full-width rows. Choosing
a day focuses its loaded agenda, with a direct return to the month. Failed refresh
feedback stays beside the day controls and identifies retained entries. Context
backs up through the existing format, with no migration/version change; old files
default to no plan. Public/export projections keep their existing scope.

## Twentieth implementation: photo galleries and comparisons

Manage photos keeps up to 12 stored sources per record or visit, with manual
ordering, separate captions/arrows and an explicit cover choice. Keyboard position
controls and readable arrow labels accompany overlays. Before/after compares two
chosen originals with a keyboard slider or full side-by-side view; chronology is
never inferred. Source removal requires confirmation and clears only that source,
without silently choosing another cover. Calls and ranks remain independent.

Migration `0020_photo_galleries.sql` preserves existing sources, including Trash,
and retains selected-cover caches for existing displays. Immutable upload IDs,
content hashes, owner/parent/revision guards and removal tombstones protect exact
retries. Prepared bytes and identity recover on the same account/device for seven
days. Metadata conflicts keep drafts and an explicitly replaced previous copy.
The gallery lives outside its parent disclosure, closes on account changes and
returns focus to Manage photos. Missing sources retain captions and arrows.

Version 5 backups include source metadata and original bytes once, remap IDs and
restore old single-photo formats. Records-only restores retain metadata while
clearly identifying absent image files. Stored sources stay unchanged by captions,
arrows and comparisons; uploads may resize before storage. Existing public and
opt-in export projections remain selected-cover-only and omit gallery metadata.

## Twenty-first implementation: manual cover collages

Workbench → Cover collage arranges up to six owned record/visit sources in a manual
layer order, with keyboard position/size controls, optional typed captions and a
chosen cabinet background. Sources fit without cropping. The arrangement sketch
and exact 1280 × 800 prepared image are separate. Only the inspected WebP/PNG saves
or downloads; edits invalidate older prepared files. Original sources, gallery
metadata, calls and ranks remain unchanged.

Account/list drafts recover on this device for seven days. Prepared images remain
in the current tab. Missing sources retain captions/geometry; stopped or superseded
preparation cannot replace a later preview. Lost save replies retry the same bytes.
Changed covers require a current image review and another explicit save. Failed
review images have a retry path before replacement. Account changes remove the
body-level dialog. Close and browser Back protect unfinished arrangements, including
blocked storage, with focus restored on closing. Confirmation targets are 44px.

Migration `0021_cover_revisions.sql` preserves existing images and adds an independent
cover counter. Every current cover writer supplies it. Active owner and counter
checks share the write transaction. Concurrent/stale writes, repeated timestamps,
unrelated collection edits and cover removal cannot permit a stale replacement.
Identical current bytes can confirm an exact retry without another write. Cover
cache URLs use the counter. It resets with fresh IDs on restore; saved covers and
sources retain format 5 backup support, with no public projection change.

## Twenty-second implementation: private boards and trip replay

Patterns → Boards keeps moments, shortlists, evenings and trips across owned
collections or visits, plus unlinked entries. Name-only creation remains. Each
board supports 40 manually ordered entries with separate names, notes, dates,
times, literal locations and explicit current-cover choices. Records retain their
content, calls and ranks. Dates never infer visits, geography, travel time,
completion or automatic archiving. The directory discloses filters so real boards
remain visible on a phone. Four authored faceless objects distinguish the kinds.

Trip replay has keyboard Previous/Next, a complete index and readable stop list,
and an explicit finite Play that stops when hidden or unmounted. Reduced motion
removes arrival animation. Moves retain links; merged or unavailable sources
leave entered board text readable. Removal affects only the board. Seven-day
account/device drafts freeze uncertain saves, compare current saved details and
keep one previous copy with its original revision. Missing boards have a readable
draft copy; blocked storage, route changes and account changes have explicit
recovery. No board or photo enters public links.

Migration 0022 adds independent revisions, removal tombstones and atomic 100-board
capacity. Source ownership/activity and revision checks run in the write batch.
Existing unavailable references may stay only on their original entry identity.
Version 6 exports read boards with the records snapshot, preserving missing-link
text. Restore accepts versions 1–6, remaps board/entry/source IDs, and rolls back
all data and its receipt on capacity failure. Board-only backups work. A shared
creation guard also prevents client-chosen board/gallery IDs from colliding with
other backup record kinds, including Trash. Exact prior retries still work.

## Twenty-third implementation: reviewed receipts

Capture → Receipts supports on-device English text recognition, manual text,
up to 30 reviewed lines and an optional exact prepared image. Each line stays
unlinked, links an owned record, or creates an explicitly named unranked record.
Amounts stay literal strings; no prices, currency, purchases, dates, calls or ranks
are inferred. Existing records stay intact. Saved reviews are fixed; removal
clears their content and image while preserving linked and created records.

The image is re-encoded on-device to strip source metadata, with dimension and
size bounds. Visible information is not automatically redacted. Inclusion and
readability are explicit choices. Preview and upload use the same prepared file.
Seven-day account/device drafts freeze uncertain saves, check saved results,
verify recovered image hashes, handle missing copies and stop late preparation
jobs. Blocked storage and account/route changes have explicit recovery states.

Migration 0023 adds atomic owner/source/destination/identity guards, stable hashed
creation retries, removal tombstones and a 100-review capacity. Version 7 backups
read reviews with their sources, preserve originally entered record names,
normalize moved/missing links, restore fresh IDs without extra linked records,
validate optional image bytes, and roll back the whole restore on capacity failure.
All-data deletion clears receipts and tombstones. Public snapshots remain unchanged.

## Twenty-fourth implementation: activity plans and measurements

Routines now keep optional target sets, reps, weight/unit, rest, duration,
distance/unit and notes. Starting a workout copies names and plans while results
stay blank. Later routine edits/removal preserve prior visits. The editors show
plans separately from actual results, allow unmatched plans to be removed
explicitly, and offer the chosen rest duration without starting a timer.
Time-only exercise entries can save named measurements without invented reps,
weight or individual sets. Up to 12 literal measurements keep zero/negative values
and entered units. History separates measurement/unit choices and leaves gaps.

Each activity supports up to 30 preferred-name groups with eight alternate names.
Grouping changes history and last-time recall only. Original names, saved results,
plans and workout completion remain intact; removing a group separates history.
Overlapping normalized names are rejected. The collapsed history directory keeps
these tools optional and retains its original-name entry index.

Migration 0024 adds independent plan/alias revisions and exact creation receipts.
Owner, source, activity, identity and revision guards run inside writes. Known
creation retries work after source changes; removed creations cannot return from
old retries. Workout date changes advance attached log revisions, and atomic log
source/date guards refuse races with parent deletion or date changes. Older
clients preserve omitted targets/measurements. Version 8 backups preserve separate
routine/workout snapshots, literal measurements and aliases with fresh IDs.

Account/device drafts recover partial input. Pending creations freeze their request
and identity. Saved-plan comparisons ask before replacing a draft and keep its
previous text readable while open. New log drafts retain their original revision
through reloads; older unversioned drafts remain copyable and block stale saves.

## Time capsule implementation

Web-only capsules store a fixed message and up to six explicitly reviewed owned
record/visit projections, with up to four independent photo copies. Optional
notes/photos are off by default. Closed summaries never contain message/source
content; manual Open checks the actual server instant against the chosen day and
timezone. Opened capsules can explicitly compare the same fields with current
sources; removed originals never erase the fixed copy. Raw owner backups include
unopened contents, with visible privacy copy. Version 9 restores fresh identities,
closed/opened state, missing-source flags and full/records-only photo behavior.

## Private collaboration and two-person choices

Migration 0026 adds verified-email invitations bound to Accounts IDs, viewer/editor
roles, revision-checked shared notes and explicitly reviewed text snapshots.
Private originals/photos/later edits remain private. Members can keep disconnected
copies. Revocation is checked inside writes and permanently invalidates rounds
tied to that grant; reinvitation does not revive them. Two-person rounds fix two
options and participants; exact individual Reveal seals each choice. Partner
choices stay absent from responses and exports until both reveal.

Format 10 preserves current authorized shared text, private copies and revealed
participant outcomes as inactive archives with fresh IDs. Invitations, live access
and unrevealed choices do not restore. Capsule-only and shared-copy-only files have
explicit previews.

Collaboration verification completed: the full 215-test suite passed, followed by
two targeted real-D1 regression checks. Ten private-space browser journeys and
two capsule-picker regression journeys passed on desktop/phone. Nine captures
were inspected. Offline reading and pending sync remain the only unchecked group.

## Offline text completion and final validation

The separate bookmarked Offline page stores an encrypted account-bound text copy
and up to 100 explicit pending Inbox captures/note edits. It reloads disconnected,
uses a separate unrecoverable passphrase, and checks account/reset/source state
inside atomic server writes. It never caches private API/media responses. Quota
failures, competing tabs, wrong passphrases, tampering, stale notes and uncertain
replies retain useful recovery. Static cache eviction can be repaired explicitly.
Locked-copy removal requires the actual signed-in owner.

Scope is names, notes, recorded dates, calls and ranks; images, receipts, capsules,
collaboration and extended context/measurements stay in connected Worth. Initial
copies support 2,000 records, 500 collections and 4 MB text. No automatic syncing,
rebase, native companion, home-screen widget or paid AI provider was added.

Final local verification: 223 core tests across 47 files passed. The complete
browser run covered 329 cases: 326 passed, one deliberate phone skip repeats the
desktop narrow/tablet sweep, and two test-only assertions needed correction.
Both corrected cases then passed on desktop and phone (four targeted passes):
a duplicate Cancel-button locator and a 0.00002px rectangle rounding difference.
All 328 applicable browser cases are verified. Formatting, lint, unused-code
checks, types and production build passed. Nine offline captures were inspected.

Browser CI now splits all cases once into disjoint 165/164-case shards. The
existing required browser-check gate still requires every shard to succeed.
These are local branch changes; no PR, push, merge or deployment occurred. The
approved web expansion checklist is complete within the documented scopes.
