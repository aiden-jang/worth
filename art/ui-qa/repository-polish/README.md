# Repository polish verification

Captures use synthetic records from `e2e/fixtures.ts`, never a production account.
`e2e/responsive.spec.ts` generates the current screens at 1440×900 and 390×780 and
checks document overflow at 320, 390, 430, 768 and 1440px. Run after `pnpm build`:

```sh
pnpm exec playwright install chromium
pnpm e2e
```

Images are written under `test-results/responsive-*/`; the selected captures are
preserved here. Layout tests check all eight screens at every width. The collection
browse strip intentionally scrolls on phones, as required by the current cabinet contract.

| Screen     | Desktop                     | Phone                     |
| ---------- | --------------------------- | ------------------------- |
| Landing    | [1440](landing-1440.png)    | [390](landing-390.png)    |
| Archive    | [1440](archive-1440.png)    | [390](archive-390.png)    |
| Directory  | [1440](directory-1440.png)  | [390](directory-390.png)  |
| Collection | [1440](collection-1440.png) | [390](collection-390.png) |
| Activity   | [1440](activity-1440.png)   | [390](activity-390.png)   |
| Settings   | [1440](settings-1440.png)   | [390](settings-390.png)   |
| Search     | [1440](search-1440.png)     | [390](search-390.png)     |
| Patterns   | [1440](patterns-1440.png)   | [390](patterns-390.png)   |

The accepted cabinet layout, 192px rail, phone menu, heading scale and cream opinion
slip remain intact. Compare collection captures with the cabinet edition references,
settings with completion, and landing with the illustrated cabinet references.
Different titles/counts and optional queue controls reflect real supported behavior.
The completion extension already added explicit backup limits and account/help below
the original settings reference. Its plainspoken subtitle follows the later voice revision.

Deliberate change: cream-card secondary text is slightly darker (`#626456`) to clear
AA contrast; the old `#67695b` measured 4.44:1. Desktop/phone Axe checks cover the
landing example, collection and settings without excluding contrast rules. These checks
supplement keyboard and visual inspection; they do not establish complete accessibility.

Behavioral verification: 68 unit/component/API tests and 21 Chromium browser tests pass.
New API/share recovery regressions were run against the original implementation and
failed before the fix. Browser checks cover reversible calls independent of rank,
failed capture preserving input, focus restoration, Back navigation, share lookup retry,
account/ranking outage recovery, public snapshot scope, export and invalid restore,
and browsing with blocked local storage. The browser suite passed in 35 seconds locally.

Not exercised here: a real signed-in phone session, native platform share sheet,
Cloudflare account alerting or an actual production database recovery. Those remain
operator checks documented in RELEASE.md.
