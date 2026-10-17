# Taste history verification

Workbench → Taste history extends the existing cabinet dialog; it does not change
the primary collection. Reference: October 10 collection/cabinet compositions in
`art/ui-mocks/taste-cabinet/`, plus the shared Workbench layout.

## Reviewed captures

| State                         | Desktop                         | Phone                       |
| ----------------------------- | ------------------------------- | --------------------------- |
| Opinion/current call          | [Desktop](opinions-desktop.png) | [Phone](opinions-phone.png) |
| Before/after/current ranking  | [Desktop](orders-desktop.png)   | [Phone](orders-phone.png)   |
| Private reason/visit          | [Desktop](reason-desktop.png)   | [Phone](reason-phone.png)   |
| Conflict with retained draft  | [Desktop](conflict-desktop.png) | [Phone](conflict-phone.png) |
| Optional older-opinion cutoff | [Desktop](empty-desktop.png)    | [Phone](empty-phone.png)    |

All ten captures were inspected at 1440×900 and 390×780. The phone view scrolls
within the dialog; expanded orders stack three cream panels. Conflict screens
also scroll to the saved-details/revision choice. Reasons use ordinary sans-serif
labels, a 120px text area and standard cabinet form padding. No call is inferred
from an old ranking, an unavailable record or an empty history.

## Exercised behavior

Eight focused desktop/phone browser cases pass: pagination, unavailable-position
gaps, explicit sandbox preview/apply, no change to calls, optional older-opinion
review, reason/visit draft recovery, explicit revision conflict resolution,
failed reads/retry and blocked local storage. Axe reports no violations for the
history view, and long content reflows at 320/430/768px.

The browser fixtures are isolated from production. Database/API tests separately
exercise real SQLite triggers, ownership, active parents, moves/Trash, date-tied
pagination, visit guards and versioned backup remapping. Full regression and final
code-check results are recorded in the expansion tracker after completion.

No physical phone, deployment, remote CI, native app or public-sharing change is
claimed by these captures.
