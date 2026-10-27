# Worth release and recovery

## Automatic release

Pushes to main run formatting, ESLint/hooks, unused-code detection, unit/component/API
tests, type checks, a production build and desktop/phone browser tests. The core job
and both browser shards must pass before CI applies D1 migrations and deploys the verified build artifact. The user confirmed the GitHub repository's Cloudflare token
is configured. `scripts/verify-live.mjs` then checks health, signed-out account state,
private-export access, browser assets, policy route availability, static HTML
security headers, and no-index headers on public share URLs. A failed smoke check
fails the deployment job; it does not roll back an already-applied migration.

The smoke script does not sign in or create production records. Browser interaction
checks use intercepted synthetic APIs in `e2e/`; historical captures remain in `art/ui-qa/`.
A real signed-in phone test is still required after release.

## Operational protection

- API responses have no-store caching and restrictive security headers. Static
  assets use `public/_headers` for CSP, anti-framing, MIME and referrer protection.
- Authenticated writes are limited to 120 per account per minute. Backup, restore
  and all-data deletion share a six-per-minute limit. Errors return Retry-After.
  Counters older than two minutes are removed on subsequent limited requests.
  This does not establish dashboard-level DDoS/WAF rules or replace them.
- Worker observability is enabled in `wrangler.jsonc`. Application errors log the
  request path and error message, not intentional record/photo dumps. Inspect
  Cloudflare's errors, CPU, D1 storage and quota metrics when investigating a failure.
- Configure/verify provider alerts in the authenticated Cloudflare dashboard;
  dashboard alert delivery and account/plan settings were not accessible here.

## Recovery procedure

Verify the actual Cloudflare account plan, D1 Time Travel retention and available
bookmarks before relying on recovery: [Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/).
This repository does not prove that a production recovery drill has succeeded.

For an incident:

1. Pause shipping; inspect the deployment, errors and affected data. Obtain an
   export of the current database before any recovery that could overwrite data.
2. With Cloudflare authenticated, inspect `wrangler d1 time-travel info worth`.
   Record the pre-incident bookmark and the current bookmark. Use a separate
   database for a recovery rehearsal when possible.
3. Restore production only with explicit operator approval of the bookmark and
   the records that could be lost: `wrangler d1 time-travel restore worth --bookmark=<verified-bookmark>`.
   This is a database-wide operation, not an individual user's undo button.
4. Verify schema compatibility, ownership boundaries and representative records
   and photos. Run the live smoke check; test account access before resuming writes.

Rolling back a Worker version does not roll back D1 migrations. Use additive
migrations and compatible application versions. Backups and recovery copies may
retain deleted records for the provider retention window; public links must remain
revoked after any restoration. Review all shares if restoring an older database.

## User data portability and deletion

Settings offers records-only JSON and photo-inclusive JSON backups. Restore is
validated, previewed and atomic, creates fresh private list/record IDs, preserves
calls/ranks/notes/measurements and relationships, and does not recreate shares.
Limits: 32 MB file, 5,000 total records, 500 lists, 200 photos/covers. Files above
these limits need an operator-assisted transfer, not silent truncation. D1 limits
inform the chunk sizes: [D1 limits](https://developers.cloudflare.com/d1/platform/limits/).
The records-only export remains available for larger archives; it excludes photos.

Worth deletion is implemented inside Worth and leaves the shared account and other
apps alone. The published shared accounts policy offers account deletion by contact;
Worth has no automatic shared-account deletion cascade. Do not claim
that shared account deletion automatically cascades to Worth. For a request to
remove both, arrange Worth data removal and shared-account removal, and verify both.
Do not email anyone or delete their data merely as a verification exercise.

## Remaining external verification

- Confirm the exact merged commit has passing core/browser/security checks, deployment and live smoke checks.
- Real signed-in phone session, session expiration, photos, export and share revocation.
- Authenticated Cloudflare plan, recovery availability, alerting and edge abuse controls.
- Shared account deletion integration; product copy and contact flow explicitly avoid assuming it.

## Archive tools migration

Migration 0011 is additive and preserves existing records. Apply it before the new
Worker. After this version has put records in Trash or merged them, do not roll back
to an older Worker that reads the raw tables: it would display trashed records and
merged originals as active items. Use a fix-forward release or a compatible build
that retains the active-view read boundaries. Never drop the new columns to roll back.

Smoke-check create/Want to try, merge/separate, move with a photo/history, Trash/Undo,
list restoration with revoked public links, and a backup/restore of merged originals.
Use disposable staging records for retention cleanup and permanent account-data deletion.

## Cabinet expansion migrations

The web expansion added additive migrations `0012` (collection
workspace/revision), `0013` (private item context/revision) and `0014` (collection
archive flag). Apply all pending migrations before deploying its Worker. Archiving
keeps the existing non-Trash read views and does not revoke public links. The
feature tracker preserves dated local verification from the former feature branch.
That web expansion was integrated into main in `cefcf56`; verify current CI and
deployment against the release commit rather than those historical notes.
Migration `0015` adds private visit context and log revisions; older logs default
to empty context and no earlier reactions are inferred.

Collection templates use additive migration `0016_collection_templates.sql`.
Verify name-only capture, explicit addition of blank collection detail names,
revision conflicts, template creation/retry/removal and template-based creation.
A template copies only the setup shown in its preview; it creates no records.
Check records and photo backup round trips, including a template-only file and a
restore that would exceed the owner's 50-template limit. The latter must leave
both records and the import receipt unchanged. This migration replaces a removed,
local-only native-widget experiment; that experiment was never deployed.

Web capture adds `/capture`, `/quick`, text/link manifest share-target metadata and
private PWA shortcuts; it needs no extra migration beyond the template migration
above. Verify incoming content is not saved by opening a link, sign-in returns
without forwarding it to Accounts, a duplicate needs explicit keep-both review,
and an interrupted POST retries the same payload/key. Verify private shortcut
choices stay with their account and clearing device data removes them. Share
menu registration/installation varies by browser and OS; manual capture and
bookmark URLs remain the fallback. No native app is built or distributed.

Private browser requests now include an expected account. Check a live account
switch in another tab: old reads/writes must return ACCOUNT_CHANGED before any
mutation, the old shell must be hidden, and Reload Worth must open a fresh cache
without restoring the previous account's draft. Public shares and account
metadata remain usable independently of that header.

### Inbox

- Apply migration `0017_capture_inbox.sql` after earlier migrations before deploying this feature.
- Verify name-only capture into Inbox with no collections, explicit review, source/note retention and duplicate choice.
- Exercise Inbox draft reopen, stale revision/reload, unranked filing, and lost-reply retry after reload.
- Check Trash/Undo, 30-day purge, Inbox-only restore with fresh IDs, and full-capacity rollback.
- Confirm private search links and account changes do not expose a previous account’s finds.
- Check new version 2 exports, version 1/2 restore, and rejection of unsupported future backup formats.
- Inspect drawer/full-page/editor/empty states at desktop and phone sizes, plus 320/430/768px reflow.

### Photo text reading

- Use `pnpm build` so generated recognition assets and supplied license files are included.
- Verify English PNG/JPEG reading, WebP preparation, no early engine download, and no third-party recognition requests.
- Check stop/error/account-change worker cleanup, seven-day source recovery and explicit draft cleanup.
- Confirm only reviewed name/note text reaches capture; source photos, prices, dates, calls and ranks are not inferred/uploaded.
- Keep manual paste usable when workers, WebAssembly or reading assets are unavailable.
- Review desktop/phone contrast/reflow. Physical Safari/iOS and Android behavior needs separate device verification.

Barcode/ISBN capture checks: verify local upright/vertical EAN decoding, a typed
ISBN-10 with X, a bad check digit and a non-ISBN product. Confirm no metadata/image
request precedes explicit book lookup, no credentials/referrer leave with it, and
no remote cover is loaded. Exercise no match, provider rate/error/timeout, Stop,
account changes, manual fallback, exact kept note/source, replacement confirmation,
reload recovery and normal capture Save. Recheck a small live catalog lookup when
changing the provider integration; deterministic CI must not depend on that service.

Retrospective checks: open from Patterns with no automatic recap read, apply a
local-date period spanning daylight-saving offsets, and compare saved finds with
explicitly dated logs. Check all-lists/Inbox versus one owned list, archived opt-in,
Trash/merge exclusions and count/display limits. File an Inbox find and confirm
its saved date/count survive. Test changed-but-unapplied controls, refresh, retry,
empty periods, offline state, note opt-in, account recovery and device drafts.
Do not describe these current-record recaps as past opinion/ranking snapshots.

## Future ranking and opinion history

- Apply `0018_taste_history.sql` after earlier migrations. It records future
  old/new rank and call changes atomically; it does not backfill prior opinions.
- Verify Workbench → Taste history, before/after/current comparison and explicit
  sandbox preview/apply; moved/merged/trashed records must retain appropriate gaps.
- Check optional private reasons/visits, stale revision recovery and device drafts.
- Taste history introduced version 3. Current exports use version 10; restore accepts versions 1–10 and remaps history
  references without creating extra change events. Future versions beyond the current reader fail.
- Restore supports 10,000 history changes and 16 MB of history within the existing 32 MB/batch limits.
  No automatic review reminders, new public projection or native code is included.

## Record connections

- Apply `0019_record_connections.sql` after earlier migrations. Capacity is guarded
  atomically at 1,000 saved links per owner; removing a link frees a slot.
- Check Patterns → Connections with related finds, editions/versions, same thing
  across places, and directional replacements with reasons. Replacement loops
  fail without partial writes. The diagram has a complete readable alternative.
- Verify uncertain-save retry/check, stale reason reload, removal confirmation,
  archived labels and links retained through moves/merge/Trash recovery.
- Connections introduced version 4; current exports use version 10. Restore accepts versions 1–10 and rejects later formats.
  Connections restore with fresh IDs and canonicalized pairs. A capacity error
  rolls back the entire restore and can retry after freeing space.

## Personal field guides

- No migration or backup version change. Open Patterns → Field guide, select records
  from two collections and verify default-off note/location/name/photo choices.
- Prepare, review and download the standalone HTML; open it offline and print/save
  an A5 PDF. Changing included content must disable the old file until prepared again.
- Confirm a missing source blocks partial preparation while retaining its caption.
  Test photo failure/retry and account changes during preparation.
- Shared booklet/guide exports now reencode displayed photo pixels to strip original
  image metadata. Stored originals stay unchanged; visible photo content remains.
  Smoke-check existing booklets and recommendation cards after release too.

## Revisit plans and activity calendar

- No migration or backup version change. Context adds an optional original revisit
  day and snoozed day. Old contexts/backups default to no plan. Use a compatible
  application version when recovering JSON context introduced by this release.
- Save and reopen a plan; verify snooze keeps its original day and Clear snooze
  returns it to that day. Calls, ranks and the existing revisit queue must not change.
- Open Patterns → Activity calendar, choose a month and show it. Check planned
  revisits, logged visits and activity logs have distinct labels and entered dates.
- Check archived inclusion, Trash hiding, Inbox filing, selected-day pagination,
  offline retry and record-backup restore. Worth schedules no notifications.

## Private photo galleries

- Apply `0020_photo_galleries.sql` after earlier migrations. It copies existing
  private item/log photos, including Trash, into saved source assets. Selected
  cover tables remain caches, duplicating one selected source per record.
- Test Manage photos, caption/arrow saves, explicit cover clearing/selection,
  ordering, upload retry after a lost response, and confirmed original removal.
  A late retry of a removed upload must never recreate it.
- Current exports use version 10; restore accepts 1–10. Check all originals and their
  metadata round-trip, selected caches rebuild, old single-photo files still work,
  and records-only restores preserve metadata with unavailable original states.
- Check keyboard comparison and side-by-side views, narrow dialogs, blocked storage,
  account changes, moved/merged records and restored Trash. Existing public shares
  and booklet/card/guide projections must retain their prior opt-in scope.

## Manual cover collages

- Apply `0021_cover_revisions.sql` after earlier migrations. Existing covers remain intact.

- Verify source selection, keyboard geometry/layering, captions, exact prepared
  image/download and private cover save. Sources and independent calls/ranks stay intact.
- Test lost replies, stale versions, current-cover review, and delayed preparation
  cancellation. A retry after cover removal must not recreate it.
- Check draft recovery, unavailable sources, blocked storage, account changes and
  narrow dialogs. Full backups retain covers and source assets through format 5;
  collage layouts stay on the device. Cover revision counters reset on fresh-ID restore.

### Private boards and trips

- Apply additive migration 0022 before serving board routes.
- Check name-only creation, manual cross-collection order and optional source covers.
- Check uncertain create/update recovery, stale review, unavailable source text and
  blocked-storage navigation; account changes must close private editors.
- Check manual archive filters, removal leaving sources intact, keyboard trip replay,
  reduced motion, responsive readable stop lists and accessible errors.
- Check version 6/older backups, fresh-ID reference remapping, all-data deletion and
  capacity rollback with the original restore receipt. Boards do not change public links.

### Reviewed receipts

- Apply additive migration 0023 before serving receipt routes and shared ID guards.
- Check local reading/manual text, literal suggestions, explicit existing/new
  record choices, and no automatic calls/ranks/purchase fields.
- Check the exact prepared image, readability/inclusion choices, stopping a job,
  missing or changed device copies, lost replies, blocked storage and account changes.
- Check owner-only image responses, permanent removal leaving records intact,
  accessible cream controls and 320/430/768px reflow.
- Check version 7/older and receipt-only backups, exact image bytes, fresh-ID
  links/provenance, absent images in records-only restores and atomic capacity rollback.

## Routine plan extension

- Apply migration 0024 before serving version 8 records and target/alias queries.
- Verify future starts snapshot targets without creating results, earlier visits
  retain their plans, unmatched targets require explicit removal and changes use
  independent revisions. Move a workout date with an old log editor open.
- Retry an interrupted creation with its exact key, including after source changes;
  remove a routine/workout and confirm old requests cannot resurrect it.
- Group and ungroup exercise names without rewriting logs or workout completion.
  Check overlap validation, stale-set recovery and an exact lost-response retry.
- Log time-only named measurements, zero and negative values; keep units separate
  in history with gaps for absent values. Check legacy aggregate results.
- Check versions 1–8 restore, fresh alias IDs, measurements, original names and
  independent routine/workout snapshots. All-data deletion clears retry receipts.
- Inspect target, actual-result, comparison, pending-start and alias/history states
  on desktop and phone; test keyboard access, long names and 320/430/768px reflow.

## Capsules, private spaces and offline text

- Apply additive migrations 0025–0027 before serving these routes. Format 10
  accepts 1–10, preserves fixed capsule contents/photos/opening state and restores
  collaboration only as disconnected private copies. Unopened capsule contents
  are intentionally included in owner backups. Invitations/hidden choices never
  restore. Check capsule-only and shared-copy-only restore previews.
- Verify server-clock manual capsule opening, independent photo copies, stale
  source reviews, exact retries and removal tombstones.
- Verify two verified Accounts identities, viewer/editor boundaries, explicit
  selected-text sharing, note conflicts and revocation. Reinvitation must not
  reactivate a round tied to its revoked grant. Choices appear only after both
  exact deliberate reveals, including in exports.
- `pnpm build` now creates a separate offline HTML entry and generates its
  static-only service worker after Vite. Preserve the complete `dist/client`
  output when transferring a build. The worker is scoped to `/offline/`; private
  APIs/media must remain absent from CacheStorage.
- Prepare an encrypted text copy, disconnect and reload the bookmarked offline
  page. Test wrong passphrase/tampering, competing tabs, unavailable storage,
  pending note conflicts, actual account changes, lost replies and cache repair.
  Offline copies exclude images, receipts, capsules, live shared spaces and
  extended context/measurement detail. Sync is explicit; no background saves.
- Reset Worth data while an old queue exists. The rotated owner epoch must block
  both new old-epoch writes and known retries. Never remove reset markers during
  ordinary cleanup or downgrade to a Worker that bypasses these guards.
- Browser copies/downloads remain independent after server reset. Clear device
  drafts and Remove offline copy are separate controls. A locked copy can be
  removed only by its actual connected account. No native applications or
  home-screen widgets are involved.

Browser CI runs two independent Playwright shards against the same verified build
artifact. Deployment depends directly on the core check and every browser shard;
failed or skipped shards block deployment. Failure artifacts identify their shard.
The local `pnpm check` still runs the full core/build/browser sequence.
