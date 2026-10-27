# Contributing

Use Node 22.22.2 (see `.nvmrc`) and pnpm 9.15.0. Install with
`pnpm install --frozen-lockfile`. See [README](README.md) for local database/auth setup.

Before committing:

1. Read [architecture](docs/ARCHITECTURE.md). For UI work, also read [AGENTS.md](AGENTS.md),
   [DESIGN.md](DESIGN.md), [VOICE.md](VOICE.md) and the latest [build contract](art/ui-mocks/BUILD-CONTRACT.md).
2. Make a focused change. Keep calls optional and independent from rank. Preserve
   ownership checks, existing records and account boundaries. New schema changes
   need an additive numbered migration and a migration/API regression test.
3. Add a regression test for a behavioral fix; verify it detects the original problem.
   Update documentation when commands, boundaries or behavior change.
4. Run `pnpm exec playwright install chromium` once, then `pnpm run check`.
   For UI work, capture desktop/phone views with synthetic data and inspect narrow
   layouts, keyboard access, empty/error states and reduced motion.
5. Use Conventional Commits without a scope: `fix: explain failed share lookups`.
   The maintainer’s current workflow is verified direct commits to `main`, without
   a PR. Push only after the local checks pass; follow that exact commit through
   GitHub CI and automatic deployment. Contributors without write access can use a PR.

## Useful checks

| Command                   | Purpose                                                                 |
| ------------------------- | ----------------------------------------------------------------------- |
| `pnpm format`             | Apply repository formatting                                             |
| `pnpm lint`               | Check source, hooks, tests and configuration                            |
| `pnpm deadcode`           | Find unused files, exports and dependencies                             |
| `pnpm test`               | Run unit/component tests and isolated migrated-D1 API tests             |
| `pnpm build`              | Generate Worker types, check TypeScript and build production assets     |
| `pnpm e2e`                | Test the existing production build on desktop and phone Chromium        |
| `pnpm check:core`         | Dependency audit, formatting, lint, unused-code checks, tests and build |
| `pnpm check`              | All core checks followed by browser checks                              |
| `pnpm run security:check` | Check the full dependency graph and fail on known advisories            |

Browser checks use port 34320 and intercepted APIs; the ordinary dev server uses
34300 and local auth uses 34100. They never sign in to a production account. A failed
CI browser job uploads its HTML report, screenshots and traces for seven days.
Run `pnpm exec playwright show-report` or `pnpm exec playwright show-trace <trace.zip>`.

Keep comments for non-obvious invariants, recovery or tradeoffs. Avoid comments that
repeat the code. Historical design/QA artifacts remain under `art/`; they are not
production fixtures. Never commit `.dev.vars`, credentials, private exports or real QA records.

See [quality and visitor review](docs/QUALITY.md) for the review matrix, fixture
boundaries and checks that require a real device.
