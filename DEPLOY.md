# Deploy Worth

Target: `https://worth.aidenjang.com`. The app uses one Cloudflare Worker, one D1 database, and the existing `accounts.aidenjang.com` session. It has no R2 binding or external font request. Cloudflare's Free limits are usage limits, not an unlimited-storage guarantee. Check the [D1 limits](https://developers.cloudflare.com/d1/platform/limits/) and [Workers limits](https://developers.cloudflare.com/workers/platform/limits/) before importing a large archive.

## First deploy

Do this from `apps/worth` after signing in with Wrangler and confirming that `aidenjang.com` is on the same Cloudflare account:

1. Run `pnpm exec wrangler d1 create worth`. Replace the all-zero `database_id` in `wrangler.jsonc` with the returned ID.
2. Run `pnpm run db:migrate:remote`. It applies both schema migrations before the Worker starts serving data.
3. Build with `pnpm run check`. For a first deployment, if Wrangler says the custom domain cannot attach before a Worker version exists, temporarily remove the `routes` block from `wrangler.jsonc`, run `pnpm exec wrangler deploy`, restore the block, and run `pnpm exec wrangler deploy` again. Do not leave the route removed in Git.
4. Confirm `https://worth.aidenjang.com/api/health` returns `{"status":"ok"}` and `/api/me` returns `{"user":null}` while signed out.
5. Sign in through `accounts.aidenjang.com`, create a test list, add an item and photo, rank it, open Show List, create a share, view that link signed out, and revoke it.

The auth service already allows HTTPS return URLs under `*.aidenjang.com` and shares its `platform_session` cookie across subdomains. Worth calls `/auth/me` server-side, so its API does not need browser CORS access to the accounts origin. If shared login behavior changes, verify that contract before shipping Worth.

## Routine deploys

`pnpm run deploy` runs the full check, applies remote D1 migrations, then deploys the built Worker. It changes production data, so use it only when you mean to ship. The GitHub workflow checks in one job and runs `pnpm run deploy:only` in a dependent job on pushes to `main`; it is gated by the repository variable `WORTH_READY=true`. Set that variable only after the first deploy and smoke test. Add a `CLOUDFLARE_API_TOKEN` secret with Workers Scripts Edit and D1 Edit permissions. Do not store the token in the repo.

`pnpm run db:migrate:local` changes only the local D1. `pnpm run db:migrate:remote` changes production D1. Neither command runs automatically in `pnpm run dev`.

## Data and privacy

The production D1 database is the source of truth. D1 photos are private BLOBs capped at 900 KB each, not public assets. Public links contain ranked names and types only, expire after seven days, and can be revoked. Back up D1 before destructive schema changes. Deleting a list removes its items, logs, photos, and shares through database foreign keys.

Do not switch this to R2 just to make uploads easier without revisiting the $0 requirement. R2 requires a subscription setup and can bill overages even though it has a free allowance. If the D1 free limits become too small, make an explicit storage and budget decision rather than letting the app drift into paid usage.
