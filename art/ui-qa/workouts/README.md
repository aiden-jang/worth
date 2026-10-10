# Workout sessions verification

Captured and inspected the running app beside the [references](../../ui-mocks/taste-cabinet/workouts/README.md), at 1440 × 900 and 390 × 780:

- [New visit desktop](create-workout-desktop.png) / [mobile](create-workout-mobile.png)
- [Last-time panel desktop](previous-sets-desktop.png) / [mobile](previous-sets-mobile.png)
- [Corresponding sets desktop](set-comparison-desktop.png) / [mobile](set-comparison-mobile.png)
- [Grouped history desktop](workout-history-desktop.png) / [mobile](workout-history-mobile.png)

Retained the working header, latest recall, filters, dark palette and native scrolling editor. Deliberate reference refinements are documented in the mock README: previous values sit beside the corresponding input rows, with complete prior sets behind a disclosure. New workout appears above filters, and normal activity logs remain readable below visits. The desktop search control now has a fluid column instead of collapsing beside full-width selectors.

Browser checks cover creation and immediate exercise capture, stored grouping, factual totals, kg/lb comparison and explicit copying, filled-draft replacement confirmation, visit rename/date propagation, assigning and detaching existing entries, workout-name/record search, draft discard and safe removal of grouping. Checked page/editor overflow at 320/390/430/768/1440px. Every browser API request uses disposable intercepted fixtures; no fixture records enter a private archive.

All 36 tests passed, including worker persistence/ownership/export and previous-exercise chronology. Typecheck and production build passed. Migration 0007 was applied only to the isolated local preview database. Production deployment remains pending.
