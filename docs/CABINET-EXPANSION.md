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

- [ ] Save a link with reviewed identity suggestions and retained source URL.
- [x] Saved filter/search views.
- [x] Tags, personal care labels and custom stamps with useful filtering.
- [ ] Archive/unarchive collections independently of Trash.
- [ ] Duplicate suggestions with open, revisit and keep-both choices; never automatic merging.
- [ ] CSV import with column mapping, preview and duplicate review.
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
- [ ] Optional bookend decorations and physical shelf presentations.
- [ ] Faceless undecided paper creature that never implies a personal call.
- [x] Finite filing/stack animation after successful capture, respecting reduced motion.
- [ ] Collection keepsake independent of rank.
- [ ] Private collection dedication and optional first-record inscription.
- [ ] Caption/arrow annotations stored separately from original photos.
- [ ] Multiple photos, captions, ordering and explicit cover selection.
- [ ] Manually arranged photo collages for covers; original photos retained.
- [ ] Before/after photo slider with a keyboard-accessible alternative.
- [ ] Activity-specific neutral illustrations without scores or call faces.

## Sharing and export

- [ ] Collection booklet/mini zine with exact content preview and downloadable output.
- [ ] Personal field guide with selected records, notes and explicit locations.
- [ ] Individual recommendation card with a user-written reason and exact preview.
- [ ] Private two-person this-or-that with separate choices and a deliberate reveal.
- [ ] Private collaboration and explicit granular sharing controls.
- [ ] Optional reviewed AI extraction only after provider, data disclosure and costs are settled.

Existing seven-day public snapshots keep their original fixed title/type-only
scope. New sharing formats must have their own explicit preview and access rules.
No private notes/photos may silently become part of existing links. Native device
capabilities, external lookups, notifications, AI and collaboration need working
integration and validation; do not replace them with decorative controls.

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
