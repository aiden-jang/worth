# Simple logging — October 27

The user requested a simpler everyday flow: a name should be enough, with extra
context optional and useful summaries built from the data already recorded.

## Reference and deliberate changes

Reviewed `DESIGN.md`, the current taste-cabinet README and build contract, then
opened collection-mobile and workout comparison-mobile before implementation.
The cabinet canvas, fonts, modal corners and 44px controls remain.

- The experience composer leads with Name, then optional one-tap reactions.
  Saved-name selection and date/context fields disclose on request. Today remains
  visible in the date summary. This intentionally shortens the earlier composer.
- Activity keeps its Activity/Exercise choices and name field. Date/workout and
  optional measurements/notes disclose, while date and selected workout remain
  readable. Saved and restored notes/measurements open automatically.
- Previous exercise sets remain an explicit copy action. There is no automatic
  workout completion or inferred call from a sparse entry.
- Both editors focus the identity field after the native dialog opens. The
  experience close icon matches the other editors.

## Captures

Synthetic intercepted APIs against the production build, with reduced motion.
Desktop is 1440 × 900; phone is 390 × 780. Modal captures use the viewport rather
than full-page mode. Private production data was not used or changed.

- [Experience, desktop](simple-experience-desktop.png) / [phone](simple-experience-phone.png)
- [Activity, desktop](simple-activity-desktop.png) / [phone](simple-activity-phone.png)
- [Exercise, desktop](simple-exercise-desktop.png) / [phone](simple-exercise-phone.png)

Capture uses the existing opt-in `WORTH_MEMORY_QA` hook in `e2e/memories.spec.ts`.
Routine CI writes no review images. Browser reflow checks also cover 320, 430 and
768px widths. Physical phones, the software keyboard and spoken screen readers
remain manual checks.

## Verification

Core checks passed 261 tests across 56 files, dependency audit, formatting, lint,
unused-code checks and the production build. The affected desktop/phone journeys
passed 44 cases. After the final 44px Save-button adjustment, all 16 memory/logging
cases passed again; the four capture journeys also passed in touch-enabled WebKit.
The final build includes the input-focus and touch-target changes.

The browser checks cover name-only dated saves, optional reaction clearing, fixed
retries across reload, unchanged overall calls, reaction-only draft confirmation,
plain activity saves, explicit previous-set copying, date changes, narrow reflow
and automated accessibility. The existing routine/legacy-data cases remain intact.
No assertion, timeout or retry setting was relaxed. The six captures above were
visually inspected against the cabinet references; exercise modals naturally scroll
to their sets and optional context below the captured first viewport.
