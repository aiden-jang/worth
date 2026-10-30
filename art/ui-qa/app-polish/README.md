# App-wide styling review — October 30

The user asked for the compact directory treatment across Worth. This pass began
with a fresh capture of 29 working and presentation screens on desktop and phone.
The [authored references](../../ui-mocks/app-polish/README.md) were rendered and
opened before implementation. All implementation captures use isolated synthetic
fixtures, never the production account or private records.

## Screen review

The final inventory covers 25 working-page states plus landing, offline, Help,
Privacy, Terms, private ranked display and public snapshot: 32 screens at
1440 × 900 and 390 × 780. [Capture inventory](inventory.json) lists their files.
The `before` overviews record the earlier mismatched scales and spacing.

| Flow               | Desktop                                   | Phone                                   |
| ------------------ | ----------------------------------------- | --------------------------------------- |
| Home               | [Capture](screens/home-desktop.png)       | [Capture](screens/home-phone.png)       |
| Collections        | [Capture](screens/directory-desktop.png)  | [Capture](screens/directory-phone.png)  |
| Collection         | [Capture](screens/collection-desktop.png) | [Capture](screens/collection-phone.png) |
| Activity           | [Capture](screens/activity-desktop.png)   | [Capture](screens/activity-phone.png)   |
| Search             | [Capture](screens/search-desktop.png)     | [Capture](screens/search-phone.png)     |
| Unfiled            | [Capture](screens/inbox-desktop.png)      | [Capture](screens/inbox-phone.png)      |
| Look back          | [Capture](screens/look-back-desktop.png)  | [Capture](screens/look-back-phone.png)  |
| Settings           | [Capture](screens/settings-desktop.png)   | [Capture](screens/settings-phone.png)   |
| Capture and review | [Capture](screens/read-desktop.png)       | [Capture](screens/read-phone.png)       |
| Offline            | [Capture](screens/offline-desktop.png)    | [Capture](screens/offline-phone.png)    |

All screen captures were inspected in overviews; the primary patterns and the
densest phone controls were also opened individually. The changes unify working
titles, insets, header spacing, labels, controls and empty states. Home cards now
group artwork and text. Settings puts downloads and restore before housekeeping.
Unfiled has the proper active navigation state and a smaller drawer title.

## Native dialogs and populated tools

| State            | Desktop                                                   | Phone                                                   |
| ---------------- | --------------------------------------------------------- | ------------------------------------------------------- |
| Add              | [Capture](dialogs/add-desktop.png)                        | [Capture](dialogs/add-phone.png)                        |
| Optional details | [Capture](dialogs/add-details-desktop.png)                | [Capture](dialogs/add-details-phone.png)                |
| Item editor      | [Capture](dialogs/item-editor-desktop.png)                | [Capture](dialogs/item-editor-phone.png)                |
| Sharing          | [Capture](dialogs/share-desktop.png)                      | [Capture](dialogs/share-phone.png)                      |
| Unfiled drawer   | [Capture](dialogs/unfiled-drawer-desktop.png)             | [Capture](dialogs/unfiled-drawer-phone.png)             |
| Receipt lines    | [Capture](features/receipts/lines-desktop.png)            | [Capture](features/receipts/lines-phone.png)            |
| Board editor     | [Capture](features/boards/editor-top-desktop.png)         | [Capture](features/boards/editor-top-phone.png)         |
| Connections      | [Capture](features/connections/constellation-desktop.png) | [Capture](features/connections/constellation-phone.png) |
| Calendar agenda  | [Capture](features/calendar/agenda-desktop.png)           | [Capture](features/calendar/agenda-phone.png)           |
| Field guide      | [Capture](features/guide/choices-desktop.png)             | [Capture](features/guide/choices-phone.png)             |
| Period summary   | [Capture](features/summary/results-desktop.png)           | [Capture](features/summary/results-phone.png)           |

These viewport captures intentionally scroll to the feature under review. Native
dialogs scroll inside their own bounds. The phone navigation stays fixed and page
content has clearance below it. No capture implies that below-fold content is absent.

## Deliberate differences from the schematic references

- Production keeps real icons, original artwork, counts, descriptions, account
  links and all loading/error/retry states. Reference symbols are placeholders.
- Factual status kickers and existing return links remain where they provide
  context. The compact collection options menu stays beside the heading on phones.
- Look back retains its established underline tabs, distinct from the inset
  Experiences/Saved things capsule. Phone selection retains the native item sheet.
- Settings keeps its complete export scopes, privacy explanations and limits;
  the reference uses shorter illustrative paragraphs. The order of actions changes,
  not their scope. Destructive confirmations remain explicit.
- Multiple collections keep a compact two-column phone shelf. A single collection
  uses a horizontal card. Private covers keep their original framing and precedence.
- Presentation pages and generated objects keep their specialized layouts. Public
  Help/policy and offline entry pages have their own headers and readable title scale.

## Verification and limits

The new working-page regression checks title scale and overflow on all 25 working
states, phone field legibility, common control corners, Unfiled's active link and
the Home card after returning from a lazy page. Browsing performs no record writes.

The wider checks exercise capture and Undo, call/rank independence, keyboard focus,
native sheets/dialogs, sharing privacy, exports and restore validation. Reflow
includes 320, 390, 430, 768 and 1440px; the checked flows include automated
accessibility analysis. Populated feature checks exercise receipts, OCR/barcodes,
boards, connections, calendar, retrospective summaries and field guides.

Verification passed: production build/type checks, lint, unused-code checks, 49
main-flow Chromium cases, the final 18 populated-feature/page-style cases and
four desktop/phone state-review cases. The clean phone WebKit run passed all 29
cases; the working-page regression also passed again on the final control-corner
build. No CI pipeline was added; the new regression adds one case per viewport.

An initial Safari run overlapped a local rebuild and one capture save stalled;
that run was discarded. The isolated flow then passed, followed by a clean full
29-case phone WebKit run against a completed build. The existing capture test kept
its original timeout and retry policy, with no application workaround. The screenshot-enabled Connections
test also exposed an old `.patterns-head` capture target; it now uses the current
heading, and the original behavior/accessibility assertions pass on both viewports.

This is browser automation and visual review. Physical devices, an on-screen
keyboard, spoken screen-reader output and independent usability observation were
not tested. Saved data, optional capture, public-link scope and export semantics
were preserved; this pass adds no dependency or database migration.
