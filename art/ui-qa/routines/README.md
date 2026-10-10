# Routine verification — October 10

Captured at 1440 × 900 and 390 × 780 with intercepted API fixtures only. No demonstration records were written to an account or preview database. The local isolated preview received migration 0008; production has not been deployed or migrated.

- [Checklist desktop](routine-checklist-desktop.png) / [mobile](routine-checklist-mobile.png): saved routine, fresh visit with zero logged exercises, ordered pending index and separate history.
- [Routine editor desktop](routine-editor-desktop.png) / [mobile](routine-editor-mobile.png): ordered name list in the native dialog.
- [Blank sets desktop](routine-blank-sets-desktop.png) / [mobile](routine-blank-sets-mobile.png): empty current reps and weight with last-time numbers beside the fields.
- [Exercise desktop](routine-exercise-desktop.png) / [mobile](routine-exercise-mobile.png): identity/date/workout prefilled, original last-time measurements available; current fields stay blank.

Inspected beside [routine references](../../ui-mocks/taste-cabinet/workouts/README.md#reusable-routines). The working app intentionally keeps its header/latest recall, places New routine in the section heading, and uses half-width desktop routine cards for multiple lineups. Dark palette, sans-serif typography, rules, 22px corners, session row rhythm and mobile stacking match the cabinet system.

Functional checks: create/edit routines; fresh same-day visits with no fabricated logs; blank current reps/weight; logging moves pending names into actual history/counts; changing a routine affects future visits only; save a visit as routine; planned-name filtering; draft-discard protection; deleting routines preserves visits/logs. Page reflow checked at 320/390/430/768/1440px. Full browser results in qa-result.json. Backend integration verifies validation, ownership, cross-list rejection, snapshots, deletion/cascades and exports. 37 tests and production build passed.
