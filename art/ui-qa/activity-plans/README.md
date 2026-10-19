# Routine plans, aliases and measurements QA

The existing workout, routine and progress references remain the composition target.
The activity header, routine shelf, workout cards, dark native dialogs and 44px
controls stay. Optional target cards deliberately extend the routine/visit editor:
two fluid columns, a single column at 320px, separate notes and an explicit planned
readout. Actual results stay blank. Named measurements reuse the measurement
editor; missing sets are described as absent instead of fabricated zero reps.

Saved-version comparison is a separate panel with a deliberate replace action and
readable previous draft. Recovery actions have their own spacing below Save. Name
groups live inside the collapsed exercise history directory. History keeps the
existing chart, with literal measurement/unit choices, gaps and original recorded
names. Negative values extend its axis below zero. No activity judgment or call
face is added.

Synthetic private fixtures are captured at 1440 × 900 and 390 × 780. Captures cover
routine targets, starting, actual measurements, saved workout results, fixed pending
starts, saved comparison, aliases, history, stale log drafts and older unversioned
drafts. Native editors scroll normally; some captures intentionally show the fields
being reviewed rather than the header. Browser checks also cover 320/430/768px,
Axe, blank actual results, interrupted-start reload after a routine changes,
explicit conflict replacement, distinct units/zero, overlap validation and retained
original names. The older-draft fixture runs after unload autosave, matching an
actual previously stored draft.

The 201-case full core run passed. All 16 final affected draft/history checks then
passed after the time-only Save control was corrected. All 12 desktop/phone activity
journeys passed across the final runs: ten together, then the two recovered-draft
cases after correcting their field lookup and old-draft fixture timing. No timeout
or behavioral assertion was weakened. See [Cabinet expansion](../../../docs/CABINET-EXPANSION.md)
for final verification and scope.
