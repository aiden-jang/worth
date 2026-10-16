# Worth release and recovery

## Automatic release

Pushes to main run formatting, ESLint/hooks, unused-code detection, unit/component/API
tests, type checks, a production build and desktop/phone browser tests. Both check jobs
must pass before CI applies D1 migrations and deploys the verified build artifact. The user confirmed the GitHub repository's Cloudflare token
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
