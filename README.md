# Worth

[![Check and deploy](https://github.com/aiden-jang/worth/actions/workflows/ci.yml/badge.svg)](https://github.com/aiden-jang/worth/actions/workflows/ci.yml)

A private place to remember what you tried, what you like and what you did.
[Open Worth](https://worth.aidenjang.com).

Save a name before deciding where it belongs. Add optional opinions, notes, photos
and dated experiences later. Keep workout sets and progress alongside the rest.
New accounts start empty. The signed-out interactive example is explicitly labeled
and never writes to a private archive.

![Worth Home with example entries](public/screenshots/app-desktop.png)

## Everyday use

- **Add** keeps a name in Unfiled, or an explicitly selected collection. Notes and
  opinions are optional. Add details can keep a date and photo even in Unfiled.
  Saving a name or photo alone does not create a visit.
- **Home** puts search and recent entries first, including Unfiled finds. Collections
  and activity shortcuts stay within reach, with a compact memory to rediscover.
- **Collections** open directly to names, quick capture, search and a browse/filter
  row. Choose an item for its optional call, an experience or editing. Phone item
  details open in a focused sheet. Collection and entry menus hold advanced tools.
- **Look back** brings **Memories** and **Insights** together. Find a dated outing,
  search a saved name or read patterns with links to their supporting records.
- **Gym and activity** put current workouts ahead of optional routines, progress
  and history. Previous sets remain references until explicitly copied and saved.
- **Settings & data → Take a copy** offers Excel for readable records, JSON for
  restoring Worth, and an image-inclusive JSON backup.

Calls (**Favorite**, **Meh**, **Not again**, or no call), rankings, Want to try and
visit reactions stay independent. No streaks, completion quotas or mandatory
organization. Existing shared links, exports and advanced tools remain supported.
See the [full capabilities](docs/FEATURES.md) and [everyday flow](docs/EVERYDAY.md).

## Local development

Use Node 22.22.2 and pnpm 9.15.0, as pinned in `.nvmrc` and `package.json`.

```sh
pnpm install --frozen-lockfile
pnpm db:migrate:local
pnpm dev
```

Open `http://localhost:34300`. The local Worker expects Accounts at
`http://localhost:34100`. Run that service, or use `node tests/fake-auth.mjs` and
visit `http://localhost:34100/preview-login` for a local-only preview. Stop the stub
before testing real sign-in. Never use it in production.

```sh
pnpm exec playwright install chromium
pnpm check
```

`check` runs formatting, ESLint/hooks, unused-code detection, unit/component/API tests,
Worker/TypeScript checks, a production build, and desktop/phone browser journeys.
The D1 tests and browser preview use isolated local state. Browser API fixtures stay
in `e2e/`; they are not shipped. See [contributing](CONTRIBUTING.md) for individual checks.

See [archive tools](docs/ARCHIVE-TOOLS.md) for move, merge, recovery and export behavior.

The [October 16 flow review](art/ui-qa/flow-audit-oct16/README.md) records phone journeys, shared sign-in checks, loading measurements and physical-device limits across the apps.

`ActivityView` owns browsing and editor selection. `ActivityEditor` owns drafts, saving and confirmations; controlled exercise-set, legacy measurement and named measurement fields receive only their part of the draft.

## Repository guide

| Document                                                                                 | Purpose                                                            |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| [Architecture](docs/ARCHITECTURE.md)                                                     | Module ownership, data invariants, auth/sharing/storage boundaries |
| [Contributing](CONTRIBUTING.md)                                                          | Setup, tests, UI verification and commit conventions               |
| [Design](DESIGN.md), [voice](VOICE.md), [build contract](art/ui-mocks/BUILD-CONTRACT.md) | Current visual and product requirements                            |
| [Deploy](DEPLOY.md)                                                                      | Automatic deployment and operator commands                         |
| [Release and recovery](RELEASE.md)                                                       | Smoke checks, backups, incidents and external verification limits  |
| [Security](SECURITY.md)                                                                  | Private reporting and maintained branch                            |

One Cloudflare Worker serves React and `/api/*` on the same origin. D1 stores
owner-scoped records and bounded private photos; shared Accounts verifies sessions.
Public links expose a fixed snapshot, never live private notes, dates, history or photos.
Downloaded images and exported backups cannot be revoked and should be kept private.

The accepted cabinet compositions and historical QA live in `art/`; latest sections of
the build contract take precedence over earlier designs. Installed-app shortcuts open
capture or the workout chooser. Manifest previews live in `public/screenshots/`.

Pushing a verified commit to `main` triggers CI and the existing automatic deployment. See [DEPLOY.md](DEPLOY.md)
before using any manual release or remote database command.

[Quality and visitor review](docs/QUALITY.md) describes the current verification
boundaries and links to dated visual evidence.

Offline preparation is verified against the built local Worker (the same server
used by browser tests). The development server does not install a persistent
service-worker cache of development modules. Bookmark the prepared `/offline/`
page for disconnected reading; the connected app keeps its normal sign-in flow.

Aggregate traffic and feature-event coverage, privacy boundaries and queries: [Analytics](docs/ANALYTICS.md).
