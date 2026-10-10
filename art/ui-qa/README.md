# Implemented Worth screens

The latest build references are the [October 9 personality refinement](personality-refinement/README.md),
which responds to the user’s latest request for more dry humor, nonchalance, and a clean, tasteful UI. The screenshots below
record the prior implementation for comparison.

These are browser screenshots of the working app, using an **isolated local D1 database**
with the local preview auth stub. Records are test fixtures; no real account was populated.
The original generated mocks remain in [../ui-mocks](../ui-mocks/README.md).

| Screen                   | Desktop (1440 × 900)              | Mobile (390px wide)             |
| ------------------------ | --------------------------------- | ------------------------------- |
| Signed-out landing       | [Desktop](landing-desktop.png)    | [Mobile](landing-mobile.png)    |
| Archive                  | [Desktop](archive-desktop.png)    | [Mobile](archive-mobile.png)    |
| Selected collection item | [Desktop](collection-desktop.png) | [Mobile](collection-mobile.png) |

Also checked [320px](collection-320.png), [430px](collection-430.png),
[empty archive](archive-empty-mobile.png), [long-name empty collection](collection-empty-mobile.png),
[sharing preview](share-mobile.png), [collections directory](collections-mobile.png),
[Patterns](patterns-mobile.png), [loading](collection-loading-mobile.png),
[collection error](collection-error-mobile.png), and [account error](account-error-mobile.png). Mobile screenshots include the naturally scrolling page;
the browser viewport used for capture was 780px tall.

## Deliberate refinements from the generated mocks

- The user's latest request removes `Private by default.`. Landing copy now says
  `Remember what you tried. Find what’s worth repeating.` and the footer says `Your taste. On record.`.
  Signed-in footers retain account/legal links. Visibility is explained at sharing and photo controls.
- Show list, Share, and settings remain available on mobile; their extra row preserves those working flows.
- Call choices use one shared SVG family. Active choices have a visible rust border and `aria-pressed`.
  The row badge has an accessible call name even where the text label is visually hidden.
- The menu replaces the previous fixed bottom navigation. It supports Enter and Escape and closes on navigation.
- Rank opens an inline disclosure before showing the placement control. Title-only capture remains the primary action.
- The archive shows up to four recent records, three shortlist entries, and the latest activity log.
  Collections use real private covers or eligible bundled starter covers. An activity-only account keeps its directory.
  Counts, record order, and dates always come from the actual archive, so fixture content differs from the mock.
- Unknown collection categories do not receive an unrelated glass illustration. Private uploaded covers take precedence.

## Verification

- Inspected screenshots beside the named desktop/mobile mocks; corrected the mobile title/art grid,
  action wrapping, wordmark scale, collection row spacing, and archive cover strip.
- No horizontal page overflow at 320, 390, or 430px. Long names wrap; empty states remain useful.
- Keyboard selection and clearing of Meh persist to the API, without changing rank.
- Verified Meh filtering, rank movement through the disclosure, and saving a detail edit.
- Type generation, TypeScript, formatting, production build, and all 29 tests pass.
- Title-only capture keeps no-call distinct from Meh. Menu Escape closes navigation.
- Tests cover all three calls, owner scoping, exports, public snapshots, and migration preservation of
  existing calls, ranks, related logs, and item/log/collection photo bytes.

For an isolated preview, set `WORTH_PREVIEW_STATE` to a temporary directory when starting Vite,
apply local migrations with Wrangler's matching `--persist-to` path, and use `tests/fake-auth.mjs`.
No local fixtures or auth bypasses are included in the production Worker.
