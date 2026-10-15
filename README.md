# Worth

Worth is a private archive for things you've tried, watched, done, owned, and want to remember. It is deliberately not a feed or a streak tracker.

Collections hold repeatable things such as drinks, films, restaurants, and cars. You can log each revisit and optionally give an item a rank within its collection. Activities hold dated entries such as runs, gym sessions, haircuts, and upkeep. The archive brings recent entries and last-time reminders together without requiring a photo for every record.

## What works

- Create, edit, and delete collections, activities, items, and logs.
- Open Settings & data for records export, photo-inclusive backup, validated restore, device cleanup and deletion of all Worth data.
- Read Worth-specific Privacy, Terms and Help before signing in or from the footer.
- Search collection names, records, and logs across your private archive.
- Keep a title-only collection index, then optionally rank, revisit, or add context later.
- Make an optional personal call: Favorite, Meh, or Not again. Selecting it again clears the call.
- Rank a collection manually. Sorting the screen does not rewrite your ranking.
- Add a private cover when creating a collection or later from list settings. Built-in starter covers are only used
  for the optional Drinks, Movies, Places, and Cars starting points; an uploaded cover always takes precedence.
- Read Patterns, a quiet summary of real records, revisits, calls, collection recency, and archive shape.
- Open a large, private Show List view when you want to hand someone your phone.
- Preview a ranked-list snapshot before making a share link. Links expire after seven days and can be revoked. Notes, dates, history, and photos are never in the public snapshot.
- Upload one private photo per item or log, plus one private cover per collection. Photos stay behind the same
  account check as the record and are excluded from exports and public shares.

The current mocks in [`art/ui-mocks`](art/ui-mocks/README.md) guide the implemented landing, archive,
and collection layouts. [Actual screenshots and verification](art/ui-qa/taste-cabinet/README.md) document the build
and the October 10 taste cabinet redesign. Mock fixtures are not bundled into the app. Worth starts empty for a new account.

[`DESIGN.md`](DESIGN.md) is the current visual and product-direction source of truth. Use it before changing primary screens or generating new mocks.

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

Photos and collection covers are capped at 900 KB after client-side compression. They are served privately with
no-store caching and are never included in exports or public shares. This keeps storage simple on the free plan,
but D1 is not a photo-library backend. If photo volume grows, move the same private photo route to a dedicated
storage service after reviewing its billing model. Worth does not require R2 or a paid Cloudflare subscription today.

Installed-app shortcuts open **Add something** or the activity list chooser for
**Log a workout**. Choosing an activity list from that shortcut opens a new workout.
Collection and workout editors identify their browser tabs.

**Save ranking image** in Share downloads a cover with the collection name and up
to five ranked titles and types from the preview. Calls, notes, photos and history
are excluded. Saved images cannot be revoked; expiring links remain a separate action.
The renderer lives in `src/shared/ranking-image.ts`.

Current signed-out phone and desktop captures in `public/screenshots/` supply the
manifest's install previews. Capture the actual landing again when its layout changes.
