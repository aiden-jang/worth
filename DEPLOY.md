# Deploy Worth

Target: `https://worth.aidenjang.com`. The app uses one Cloudflare Worker, one D1 database, and the existing `accounts.aidenjang.com` session. It has no R2 binding or external font request. Cloudflare's Free limits are usage limits, not an unlimited-storage guarantee. Check the [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) before importing a large archive.

## First deploy

Do this from the repository root after signing in with Wrangler and confirming that `aidenjang.com` is on the same Cloudflare account:

1. The configured `worth` D1 database already has its ID in `wrangler.jsonc`. Confirm it belongs to the intended account; do not create a replacement database for a routine deploy.
2. Run `pnpm run db:migrate:remote`. It applies pending schema migrations before the Worker starts serving data.
3. Build with `pnpm run check`. For a first deployment, if Wrangler says the custom domain cannot attach before a Worker version exists, temporarily remove the `routes` block from `wrangler.jsonc`, run `pnpm exec wrangler deploy`, restore the block, and run `pnpm exec wrangler deploy` again. Do not leave the route removed in Git.
4. Confirm `https://worth.aidenjang.com/api/health` returns `{"status":"ok"}` and `/api/me` returns `{"user":null}` while signed out.
5. Sign in through `accounts.aidenjang.com`, create a test list, add an item and photo, rank it, open Show List, create a share, view that link signed out, and revoke it.

The auth service already allows HTTPS return URLs under `*.aidenjang.com` and shares its `platform_session` cookie across subdomains. Worth calls `/auth/me` server-side, so its API does not need browser CORS access to the accounts origin. If shared login behavior changes, verify that contract before shipping Worth.

## Routine deploys

Pushing a verified commit to `main` is the normal release path. CI runs core checks,
builds once, browser-tests that artifact, then applies pending migrations and deploys
the same complete `dist/` output. The deploy job is serialized and runs a read-only
live smoke check afterward. A failed check blocks deployment.

For an intentional operator release, `pnpm run deploy` runs the full local check,
applies remote D1 migrations, then deploys. `pnpm run deploy:only` builds and releases
without the full checks. `pnpm run release:built` requires an already verified complete
build and runs migrations plus Wrangler with `dist/worth/wrangler.json`; it is used by CI.
Use `pnpm run deploy`, not pnpm's unrelated built-in `pnpm deploy` command.

Before the first automated deployment, add these repository secrets in GitHub Actions:

- `CLOUDFLARE_API_TOKEN`: scoped to the Cloudflare account. It needs Workers Scripts Edit and D1 Edit. Give it Workers Routes Edit for `aidenjang.com` if the custom domain route needs to be created or changed. Wrangler infers the account from this scoped token.

Do not store the token in the repo.

`pnpm run db:migrate:local` changes only the local D1. `pnpm run db:migrate:remote` changes production D1. Neither command runs automatically in `pnpm run dev`.

## Data and privacy

The production D1 database is the source of truth. D1 photos are private BLOBs capped at 900 KB each, not public assets. Public links contain ranked names and types only, expire after seven days, and can be revoked. Back up D1 before destructive schema changes. Deleting a list first moves it to 30-day Trash. Permanent list removal cascades to its items, logs, photos, and shares through database foreign keys.

Do not switch this to R2 just to make uploads easier without revisiting the $0 requirement. R2 requires a subscription setup and can bill overages even though it has a free allowance. If the D1 free limits become too small, make an explicit storage and budget decision rather than letting the app drift into paid usage.

See [release and recovery](RELEASE.md) for post-deployment smoke checks, data portability, request limits, recovery instructions and outstanding external verification.
