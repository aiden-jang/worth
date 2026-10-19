# Private item context

The accepted item editor keeps its name/type, opinion slip, note, dates and Save
composition. Richer context belongs in a native disclosure after notes/dates.
Further labels/stamps, custom details, purchase and loan panels are optional.
They use the existing dark controls, native scrolling editor and 44px targets.

| State                  | Desktop                               | Phone                               |
| ---------------------- | ------------------------------------- | ----------------------------------- |
| Recommendations        | [Capture](recommendation-desktop.png) | [Capture](recommendation-phone.png) |
| Purchase/loan reminder | [Capture](context-desktop.png)        | [Capture](context-phone.png)        |

Captures use synthetic API fixtures at 1440 × 900 and 390 × 780. They show a
viewport inside a scrolling dialog. No production account was populated. Visual
review preserves the existing form columns and adds spacing between loan fields;
personal stamps/source links on cream comparison cards use dark readable ink.

Verification covers private context save/reload, incomplete draft recovery, label
filters, calendar download contents, stale-context rejection and explicit partial
draft replacement. Real D1 tests cover owner access, identical retries, invalid
links, search, merge retention, Trash filtering and backup/import preservation.
Calendar tests cover text injection, invalid dates and UTF-8 line folding. Axe
checks cover the expanded editor and context inside the comparison table.

The full local run passed 82 tests and 47 browser checks. Typecheck, build, lint,
unused-code and formatting checks are also required before committing. The scope
here does not verify a real phone calendar app, production auth or deployment.
