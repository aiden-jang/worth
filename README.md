# Worth

[![Check and deploy](https://github.com/aiden-jang/worth/actions/workflows/ci.yml/badge.svg)](https://github.com/aiden-jang/worth/actions/workflows/ci.yml)

A private archive for what you try, keep, rank and revisit.
[Open Worth](https://worth.aidenjang.com).

Collections keep names first, with optional types, calls, ranks, notes, photos and
revisit history. Activities hold dated entries, exercise sets, workouts and reusable
routines. New accounts start empty. The signed-out interactive example is explicitly
labeled and never writes to a private archive.

![Worth](public/screenshots/app-desktop.png)

## Features

- Capture one name or a batch; add context later. Drafts can recover on the same device.
- Make a reversible call: **Favorite**, **Meh**, **Not again**, or no call. Calls,
  manual rank and the revisit queue remain independent.
- Browse collections, search private records, view Patterns, and review workout history.
- Add private item/log photos and collection covers, or choose optional built-in artwork.
- Present a private ranking, create a seven-day revocable snapshot link, or download/share
  a ranking image. Only the collection name and ranked titles/types leave the archive.
- Export records or a photo-inclusive backup; preview a validated restore as new lists.
  Worth-only data deletion leaves the shared account and other apps alone.

## Local development

Use Node 22 and pnpm 9.15.0, as pinned in `.nvmrc` and `package.json`.

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

Merging to `main` triggers CI and the existing automatic deployment. See [DEPLOY.md](DEPLOY.md)
before using any manual release or remote database command.
