# Exercise history verification — October 10

Captured and inspected against [progress references](../../ui-mocks/taste-cabinet/workouts/README.md#exercise-history-and-progress) at 1440 × 900 and 390 × 780. Fixtures were intercepted in browser memory; no account/preview records were inserted, and verification made no API mutation requests.

- [Activity directory desktop](activity-exercises-desktop.png) / [mobile](activity-exercises-mobile.png): exercise history disclosure inside the established activity page.
- [Weight desktop](weight-history-desktop.png) / [mobile](weight-history-mobile.png): three exact kg entries, selected metric, chart and set index.
- [Reps desktop](reps-history-desktop.png) / [mobile](reps-history-mobile.png): total reps from each entry's individual sets.
- [Mixed units desktop](mixed-units-desktop.png) / [mobile](mixed-units-mobile.png): lb stays separate; other-unit/bodyweight entries leave gaps, and a single point never claims a trend.
- [Bodyweight desktop](bodyweight-history-desktop.png) / [mobile](bodyweight-history-mobile.png): reps-only single-entry chart and readable bodyweight set.

Deliberate integration differences: centered scrolling modal instead of an inline reference panel; standard native header rule, full dates, fixed 200px plot and readable 12px HTML axis labels instead of scaled SVG text; keyboard-selectable point buttons focus the exact entry. The private activity page retains its accepted header, routines, visits and filters. The history directory starts collapsed, and the editor's history action preserves its draft.

Functional checks: directory/editor access; exact top weight and rep totals; keyboard selection; normalized name grouping; unit separation, bodyweight gaps and zero weight; empty, single-entry and legacy states; nested Escape preserves dirty fields; no writes. Overflow verified at 320/390/430/768/1440px, including dialogs. Unit tests additionally cover list boundaries, item-revisit exclusion and same-day visit chronology. Full browser results: qa-result.json. 41 tests passed; typecheck and production build passed.
