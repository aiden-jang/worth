# Product completion verification

Settings matches the authored [completion reference](../../ui-mocks/taste-cabinet/completion/README.md)
and existing dark cabinet. Public policies/help use the simple wordmark header,
one readable column, shared fonts/palette and factual privacy/deletion copy.
Desktop is 1440 × 900; phone is 390 × 780 with natural scrolling. Reflow was also
checked at 320/430/768px. No signed-in fixtures are bundled into production.

## Implemented

- Public Worth Privacy/Terms/Help, user-supplied support email, and links in both footers.
- Settings with visible export scope/error handling, photo-inclusive backup, validated
  restore preview, account-scoped device cleanup and explicit all-Worth-data deletion.
- Unknown-page screen; shared-login deletion is explicitly separate.
- Atomic, owner-scoped batch retries and restore retries. Restore identity survives
  page reload/reselecting the same file until completion or seven-day device cleanup.
- Expired text/photo draft cleanup across unopened editors for the signed-in account.
- Authenticated write/heavy-operation limits, static security headers and share no-index.
- Post-deploy smoke checks and documented production recovery steps in RELEASE.md.

## Evidence

50 tests pass. Worker integration covers photo bytes, relationship/rank/call/queue
preservation, private owner boundaries, invalid-reference/photo rejection before
writes, all-data deletion, concurrent batch retries, rate-limit Retry-After and a
400-item restore split into bounded SQL batches. User-written note whitespace survives.

`verify.cjs` exercises export failure/retry and download, invalid file and restore
preview, restore retry across reload, expired text/photo cleanup, other-account
preservation, cancel/confirm of cleanup/deletion, public pages/contact links, missing
pages, account outage/retry and viewport overflow. It intercepts every API call;
fixture writes never reach a production archive. PNGs are inspected beside the
reference. The deletion capture waits for the finite dialog entrance to finish.

Production build, type check, formatting and diff checks pass. The production
preview parses all six static-header rules, and `scripts/verify-live.mjs` passes
against it. It checks health, signed-out identity, private-export protection,
browser assets, policy route availability, HTML CSP/security headers and share indexing.
The original live deployment's health/identity/private-export boundary were also
checked; the new source has not been pushed or deployed by this task.

## Deliberate adaptations and limits

The running Settings includes essential backup limits, preview and retention/account
copy beyond the shorter reference. Its page is consequently longer; spacing, type,
rules, button shapes and rail remain the cabinet composition. Public policies use
plain text without reaction faces. Destructive confirmations start focus on Cancel
and cannot close while their operation is pending.

Restore creates new lists rather than overwriting; it never restores public links.
Limit: 32 MB, 5,000 total records, 500 lists and 200 photos/covers. Unsupported larger
archives fail clearly instead of truncating. SQL chunks respect D1's query, parameter
and value limits; large production CPU/quota behavior remains a live verification.
Records-only export excludes photos; photo backup includes photos and covers.

No production account data was created/deleted for testing. Real signed-in phone,
shared account deletion integration, authenticated Cloudflare recovery/plan/alerts
and edge abuse configuration remain unverified and are open in PRODUCT-PLAN.md.
