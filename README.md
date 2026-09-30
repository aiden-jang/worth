# Worth

Worth is a private archive for things you've tried, watched, done, owned, and want to remember. It is deliberately not a feed or a streak tracker.

Collections hold repeatable things such as drinks, films, restaurants, and cars. You can log each revisit and optionally give an item a rank within its collection. Activities hold dated entries such as runs, gym sessions, haircuts, and upkeep. The archive brings recent entries and last-time reminders together without requiring a photo for every record.

## What works

- Create, edit, and delete collections, activities, items, and logs.
- Search your own records. Filter and sort collections in Gallery, List, or Compact view.
- Rank a collection manually. Sorting the screen does not rewrite your ranking.
- Open a large, private Show List view when you want to hand someone your phone.
- Preview a ranked-list snapshot before making a share link. Links expire after seven days and can be revoked. Notes, dates, history, and photos are never in the public snapshot.
- Upload one private photo per item or log. Photos stay behind the same account check as the record.

The mocks in [`art/ui-mocks`](art/ui-mocks/README.md) are design references, not bundled example content. Worth starts empty for a new account.

## Run locally

Use Node 22 and pnpm 9. From this directory:

```bash
pnpm install --frozen-lockfile
pnpm run db:migrate:local
pnpm run dev
```

The app opens at `http://localhost:34300`. Development points at an auth service on `http://localhost:34100`. Run the real shared accounts service there, or run `node tests/fake-auth.mjs` for a local-only UI preview. The preview stub signs in through `http://localhost:34100/preview-login`; it is not included in the production Worker. Stop the stub before testing real sign-in.

```bash
pnpm run check
```

That runs formatting, tests against a migrated local D1, typechecking, and a production build. Use `pnpm run deploy`, not `pnpm deploy`: the latter is pnpm's unrelated built-in command. See [DEPLOY.md](DEPLOY.md) before the first production deploy.

## Boundaries

One Cloudflare Worker serves the React app and `/api/*` on the same origin. D1 stores lists, entries, ranking, share snapshots, and small photos. The Worker verifies the shared `accounts.aidenjang.com` session on private routes. Public share tokens expose only a fixed snapshot; editing your private list does not silently change what a shared link shows.

Photos are capped at 900 KB after client-side compression. This keeps storage simple on the free plan, but D1 is not a photo-library backend. If photo volume grows, move the same private photo route to a dedicated storage service after reviewing its billing model. Worth does not require R2 or a paid Cloudflare subscription today.
