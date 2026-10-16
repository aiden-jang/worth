# Worth product pass

The original ten-step pass and completion notes below are historical. Current
archive-tool behavior and the proposed next releases are tracked in the
[feature roadmap](docs/FEATURE-ROADMAP.md).

Approved: all ten steps, on main.

- [x] Active/resumable workouts, rest timer, next exercise, finish recap
- [x] Faster set logging and keyboard save
- [x] Reorder/swap a visit and skip without deleting
- [x] Unified search with exercise scope and note context
- [x] Revisit queue independent of calls and rankings
- [x] Photos while capturing a new record
- [x] Added-date and revisit filters; no-call remains separate
- [x] Interrupted draft recovery and clear saving status
- [x] Empty-account collection/routine setup
- [ ] Release: local checks passed; verify the latest GitHub deployment, remote migrations and live smoke tests

Keep the October 10 cabinet composition. Workout flow reference: art/ui-mocks/taste-cabinet/workouts/flow.html. Collection, search and empty-state compositions remain their existing references; new controls belong inside existing disclosures/actions.

## Verification

46 tests passed, including migration preservation, owner boundaries, export completeness, call/rank/queue independence and safe single-record retries. Desktop/mobile captures and 320/430/768px overflow checks cover workouts, editors, collection filters/queue, search and first-routine setup. Photos and text restore from account-scoped storage on the same device; save/discard removes the draft.

The GitHub workflow deploys successful pushes to main and applies remote migrations. The user confirmed the repository has its Cloudflare token; local Wrangler login is not needed for that workflow. The latest production run and live behavior have not been verified in this audit. The additive migration was applied to the isolated local preview during the product pass.

## Product completion backlog

The feature pass above is not a complete product-readiness checklist. These items
remain open. Preserve the accepted cabinet design and keep policy/data copy factual.

### Privacy, support and data controls — implemented locally

- [x] Add accessible Privacy and Terms links to the signed-out landing. The signed-in footer already links to the shared accounts policies.
- [x] Verify the shared policies and provide Worth-specific privacy information covering records, photos, account identity, Cloudflare hosting/logs, public snapshots, local drafts, retention and deletion. Confirm operator/contact details and actual practices before publishing claims.
- [x] Add a Worth settings/data page: export, clear account-scoped device drafts/photos/timers, and delete all Worth data with explicit confirmation. Clearly distinguish Worth data deletion from shared account deletion; account settings already link to the shared service.
- [x] Add visible help/contact and a bug-report path, using a verified contact destination. Explain essential tasks and sharing limits concisely.
- [x] Show the records-only export scope before download, including that photos are excluded. Handle download failures in the app; the existing exclusion is only in a hover title.

### Further gaps confirmed in source

- [x] Add a real unknown-page screen with a useful return action. Unknown signed-in routes currently open Archive; unknown signed-out routes show the landing.
- [x] Make batch capture safe to retry after an uncertain network response. Single-record item/log creation has idempotency keys; batch item creation does not.
- [x] Define and implement expired device-draft cleanup. Text drafts older than seven days are ignored but remain stored; photo drafts are removed only when that particular draft is opened. Coordinate this with the clear-device-data control and retention copy.
- [x] Provide a validated restore/import path for exported records, and decide how photo-inclusive portability should work. The current JSON export cannot restore an archive through the app and does not back up photos. This is a later data-ownership feature, not a claim that the current export is a complete backup.

### Readiness checks still unverified

- [ ] Verify live deployment/migrations, signed-in phone flows, session expiry, account-service failures, photo saves, exports and shared-link revocation.
- [ ] Verify the shared account service's deletion flow and whether deleting that account also deletes Worth records; do not assume it does.
- [ ] Review production recovery and abuse protection: confirm D1 recovery/retention, monitoring, deployed HTML security headers and hosting-level request limits. Repo-only inspection does not establish which protections are configured in Cloudflare.

Audit scope: repository routes, footer wiring, export handling, creation retries and
device-draft storage. The shared policies were read in the browser during implementation and omit Worth.
Worth now has its own policy/terms/help pages with the user-provided contact address.
Cloudflare/GitHub authenticated production settings remain inaccessible. This list distinguishes
confirmed source gaps from checks that need external verification; it is not an
exhaustive certification of product readiness.

## Completion pass verification

Implemented the five product-facing gaps and four further source gaps. Settings
includes photo-inclusive backup and atomic restore in addition to records export,
with a 32 MB / 5,000-record / 500-list / 200-photo limit. Source behavior, owner
boundaries and desktop/mobile verification are documented in art/ui-qa/completion.
Restore retry keys survive a reload on this device until completion or cleanup.

Added static HTML security headers, account-scoped request limits and automatic
post-deploy smoke checks. The existing live API responds healthily and rejects
signed-out exports. The new code is local pending push; full production checks,
shared-account deletion integration, recovery drills and dashboard alert/edge
settings remain open. See RELEASE.md for evidence, recovery steps and limits.
