# Worth — taste cabinet implementation

The October 10 implementation follows the [standalone design references](../../ui-mocks/taste-cabinet/README.md).
Reference and app share the composition stylesheet. The old primary-screen overrides were
removed rather than layered into another layout revision.

| Screen          | Desktop                               | Mobile                               |
| --------------- | ------------------------------------- | ------------------------------------ |
| Signed out      | [Landing](landing-desktop.png)        | [Landing](landing-mobile.png)        |
| Archive         | [Archive](archive-desktop.png)        | [Archive](archive-mobile.png)        |
| Collection      | [Collection](collection-desktop.png)  | [Collection](collection-mobile.png)  |
| Not again       | [Collection](not-again-desktop.png)   | [Collection](not-again-mobile.png)   |
| Collections     | [Directory](collections-desktop.png)  | [Directory](collections-mobile.png)  |
| Activity        | [Directory](activity-desktop.png)     | [Directory](activity-mobile.png)     |
| Activity detail | [Detail](activity-detail-desktop.png) | [Detail](activity-detail-mobile.png) |
| Patterns        | [Patterns](patterns-desktop.png)      | [Patterns](patterns-mobile.png)      |
| Search          | [Search](search-desktop.png)          | [Search](search-mobile.png)          |
| Create          | [Create](create-desktop.png)          | [Create](create-mobile.png)          |
| Settings        | [Settings](settings-desktop.png)      | [Settings](settings-mobile.png)      |
| Item details    | [Editor](item-details-desktop.png)    | [Editor](item-details-mobile.png)    |
| Empty archive   | [Empty](empty-archive-desktop.png)    | [Empty](empty-archive-mobile.png)    |

Also captured: [empty collection](empty-collection-mobile.png), [navigation](navigation-mobile.png)
and [share preview](share-mobile.png). Private screenshots use the isolated local D1 preview;
no demonstration data was added to production. The signed-out example is explicitly labeled.

Desktop uses 1440 × 900; mobile uses 390 × 780 with natural scrolling, except open dialog
captures. Additional wrapping checks cover 320, 430 and 768px.

Browser verification covers category switching, example capture, optional calls, clearing Meh,
call persistence independent of rank, Favorites filtering, empty states, menu Escape, collection
creation with a name and capture with a title. See [QA result](qa-result.json).

The [additional checks](extra-result.json) verify actual rank changes and restoration on
desktop, tablet and phone; one visible opinion slip at each breakpoint; no-call without a face;
long names; supporting-page overflow; cream-panel text contrast; and reduced motion.
All 31 tests, TypeScript, formatting and the production build pass.

The completion pass applies the accepted system to item/revisit/activity editors, creation,
settings, sharing, private ranked display and public snapshots. Item details reuse the cream
opinion slip and actual rank; optional dates/photos/measurements disclose without losing fields.
Patterns now visualizes actual recorded calls. Supporting typography matches the cabinet.
Old editor and ranked-display overrides were removed; `src/details.css` owns those compositions.

| Additional screen | Desktop                               | Mobile                               |
| ----------------- | ------------------------------------- | ------------------------------------ |
| Sharing preview   | [Preview](share-desktop.png)          | [Preview](share-mobile.png)          |
| Ranked display    | [Rankings](ranked-list-desktop.png)   | [Rankings](ranked-list-mobile.png)   |
| Public snapshot   | [Snapshot](shared-list-desktop.png)   | [Snapshot](shared-list-mobile.png)   |
| Activity editor   | [Editor](activity-editor-desktop.png) | [Editor](activity-editor-mobile.png) |
| Search results    | [Results](search-results-desktop.png) | [Results](search-results-mobile.png) |

Also captured: [unavailable public link](unavailable-link-mobile.png).
[Completion checks](completion-result.json) cover saved calls/notes/dates, rank independence,
unsaved draft cancellation, nested revisit editing, explicit link creation, an unauthenticated
public snapshot with only rank/title/type entries, revoke confirmation, actual activity metrics,
live Pattern counts and responsive forms. Disposable local test records were removed afterwards.
Two regression tests protect drafts during query/photo refreshes and prevent nested confirmation
close events from dismissing the editor. Native dialog tests in Chrome verify the complete flow.

Deliberate supporting-layout extensions: editor fields beside the same slip on desktop and
stacked on mobile; cream share previews and scoped rank-one picks; proportional recorded-call
bars in Patterns. These extend the accepted primary vocabulary without changing its layouts.
For collections without a cover, Add cover sits beneath the card so long names remain readable.

Expected differences from the static compositions are actual record content, relative timestamps,
navigation icons and working account/export controls. The main compositions, typography, opinion
slips and capture placement match. Cream call panels use dark readable text; no-call has no face.

Nothing has been deployed.
