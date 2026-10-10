# Worth product pass

Approved: all ten steps, on main.

- [x] Active/resumable workouts, rest timer, next exercise, finish recap
- [x] Faster set logging and keyboard save
- [x] Reorder/swap a visit and skip without deleting
- [x] Unified search with exercise scope and note context
- [x] Revisit queue independent of calls and rankings
- [x] Photos while capturing a new record
- [x] Added-date and revisit filters; no-call remains separate
- [x] Interrupted draft recovery and clear saving status
- [x] Empty-account collection/routine setup
- [ ] Release: accessibility, performance, errors and exports verified; deployment blocked by Cloudflare sign-in

Keep the October 10 cabinet composition. Workout flow reference: art/ui-mocks/taste-cabinet/workouts/flow.html. Collection, search and empty-state compositions remain their existing references; new controls belong inside existing disclosures/actions.

## Verification

46 tests passed, including migration preservation, owner boundaries, export completeness, call/rank/queue independence and safe single-record retries. Desktop/mobile captures and 320/430/768px overflow checks cover workouts, editors, collection filters/queue, search and first-routine setup. Photos and text restore from account-scoped storage on the same device; save/discard removes the draft.

Remote migrations and deployment require Cloudflare authentication. The additive migration has been applied to the isolated local preview, so the running local app uses the new schema. No production data or deployment was changed.
