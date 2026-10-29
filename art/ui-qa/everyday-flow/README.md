# Everyday flow verification — October 28, 2026

Implementation captures use synthetic browser fixtures and never write to a real
account. The primary references are [the authored everyday mockups](../../ui-mocks/everyday/README.md),
with identity and behavior governed by [the build contract](../../ui-mocks/BUILD-CONTRACT.md).

| Screen          | Desktop                           | Phone                           |
| --------------- | --------------------------------- | ------------------------------- |
| Home            | [Capture](home-desktop.png)       | [Capture](home-phone.png)       |
| Empty Home      | [Capture](home-empty-desktop.png) | [Capture](home-empty-phone.png) |
| Add             | [Capture](add-desktop.png)        | [Capture](add-phone.png)        |
| Collection      | [Capture](collection-desktop.png) | [Capture](collection-phone.png) |
| Selected item   | [Capture](item-desktop.png)       | [Capture](item-phone.png)       |
| Current workout | [Capture](gym-desktop.png)        | [Capture](gym-phone.png)        |
| Memories        | [Capture](look-back-desktop.png)  | [Capture](look-back-phone.png)  |
| Insights        | [Capture](insights-desktop.png)   | [Capture](insights-phone.png)   |

Desktop starts at 1440 × 900; phone at 390 × 780. Full-page captures show the
fixed phone navigation at the initial viewport edge, with scrollable content
continuing beneath. They are not composites with an extra navigation row in the
page. Viewport versions of populated Home supply the README/install screenshots.

## Visual review

The captures were opened and compared with the references. They retain the dark
canvas, 192px desktop rail, DM Sans/Mono, warm yellow action, ivory opinion slip,
large names and recognizable reaction faces. The first collection entry is visible
within 600px on a phone, without opening optional tools or details.

Deliberate implementation differences:

- Real icons, collection artwork, account links, footer and accessible focus rings
  replace the prototype's simple placeholders. Sparse fixtures remain sparse;
  counts and reactions are not filled with decorative data.
- Inline name capture keeps a joined input/Save control. The real search input and
  browse select remain visible, avoiding a separate search-opening interaction.
- The memory card starts with an invitation until an actual draw occurs. It never
  invents a past outing to match the prototype's example card.
- Start workout and Add activity remain above current workouts, so an independent
  visit or plain activity entry stays reachable. Current workouts still precede
  routines, history and past filters. The existing rest timer is folded.
- Phone exercise identity sits above its Log exercise/Skip controls at narrow
  widths to preserve readable names and adequate targets.
- Clear draft, pending save, retry, validation and recovery controls remain in the
  real composer. They are required for safe editing and were absent from the static
  prototype. Save and Trash notices replace each other and clear phone navigation.
- Memories and Insights use the existing search/results and source-backed summaries
  within the new Look back composition. Overall calls and visit reactions remain
  separate, including for Unfiled names.

## Checks

All 262 unit/database checks passed, along with dependency auditing, formatting,
lint, unused-code checks, type checking and the release build.

`e2e/everyday.spec.ts` passed all 18 Chromium desktop/phone cases and all nine touch
WebKit phone cases. Coverage includes name-only Unfiled capture, lost-reply recovery,
exact retry identity, first-record visibility, sheet selection without row shifting,
keyboard focus/escape, explicit dated experiences and existing-name reuse, precise
Undo for a new name versus a repeat visit, save/Trash notice replacement, real
Unfiled source links, plain activity without invented measurements, and current
workouts surviving a historical filter. Reflow checks cover 320, 430, 768 and
1440px; automated accessibility checks cover the affected primary flows.

The existing browser tests navigate through the new menus explicitly; there is no
global helper that silently expands hidden controls. Existing timeouts, assertions
and retry policy are retained. The database regression checks Unfiled owner
isolation, real saved dates, literal search, opinion counts, no invented visits,
Trash exclusion, filing without duplicate recall and 50-record pagination.

The Back-navigation regression waits for ranking-only controls before returning;
the collection and ranking screens share their heading. It then checks that the
fresh collection selection is closed before opening the saved item. Ten repeated
desktop/phone runs passed without changing timeouts or retries.

This is browser automation and screenshot inspection. A physical phone, its
software keyboard, spoken screen-reader output and an independent usability study
were not tested. Actual ease of everyday use still needs observation with real
users; passing checks cannot establish that on its own.
