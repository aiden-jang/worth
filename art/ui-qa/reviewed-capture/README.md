# Reviewed CSV and link capture

Import & capture is a sixth secondary Workbench tool. It retains the native
scrolling dialog, dark cabinet, existing fonts, butter selection and 44px controls.
Column mapping uses two columns on desktop and one on phones. Exact review rows
wrap long names/URLs and keep private notes available in a disclosure. Functional
errors use user-facing field names and are scrolled into view without animation.

| State                     | Desktop                        | Phone                        |
| ------------------------- | ------------------------------ | ---------------------------- |
| Column mapping            | [Capture](mapping-desktop.png) | [Capture](mapping-phone.png) |
| Selected/duplicate review | [Capture](review-desktop.png)  | [Capture](review-phone.png)  |
| Frozen retry              | [Capture](retry-desktop.png)   | [Capture](retry-phone.png)   |
| Address suggestion        | [Capture](link-desktop.png)    | [Capture](link-phone.png)    |

Captures use synthetic fixtures at 1440 × 900 and 390 × 780. Images show different
scroll positions, not a fixed-height form. Eight browser journeys cover explicit
duplicate selection, invalid rows, no unmapped-column upload, multiline text,
source preservation without fetching, exact retry identity after closing, and
long input/review layouts at 320/390/430/768/1440px. Axe checks cover the CSV review.
No production account was populated.

Pure tests cover BOM, quoting, CRLF/multiline text, Unicode, malformed/oversized
files, call/date/link validation and name normalization. A draft test proves the
pending payload is persisted before the request starts. Real D1 tests check
100-record saves, owner boundaries, unchanged ranks/calls, payload-bound retries,
changed saved records and a parent trashed immediately before the transaction.
Platform file pickers, real mobile browsers and deployment are outside this QA.

All 95 tests and the final full run of 69 browser journeys passed locally.
Formatting, lint, unused-code, TypeScript and production build checks also passed.
This branch has not been pushed or deployed; no GitHub CI result is claimed.
