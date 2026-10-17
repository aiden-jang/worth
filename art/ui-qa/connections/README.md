# Connections verification

Patterns → Connections extends the October 10 cabinet's secondary pages. It
retains the dark canvas, 192px rail, 68/44px title rhythm, DM Sans controls, 22px
panels and 44px touch targets. Its numbered diagram represents actual saved
links, without assigning a call or rank. A complete readable list preserves each
link's type, direction and private reason.

## Captures

| State                      | Desktop                                 | Phone                               |
| -------------------------- | --------------------------------------- | ----------------------------------- |
| Patterns entry point       | [Desktop](patterns-entry-desktop.png)   | [Phone](patterns-entry-phone.png)   |
| Page overview              | [Desktop](overview-desktop.png)         | [Phone](overview-phone.png)         |
| Record/relationship review | [Desktop](review-desktop.png)           | [Phone](review-phone.png)           |
| Save/reason controls       | [Desktop](save-desktop.png)             | [Phone](save-phone.png)             |
| One linked record          | [Desktop](constellation-desktop.png)    | [Phone](constellation-phone.png)    |
| Twelve visible neighbors   | [Desktop](many-neighbors-desktop.png)   | [Phone](many-neighbors-phone.png)   |
| Reason conflict            | [Desktop](conflict-desktop.png)         | [Phone](conflict-phone.png)         |
| Saved-details comparison   | [Desktop](conflict-details-desktop.png) | [Phone](conflict-details-phone.png) |
| No saved links             | [Desktop](empty-desktop.png)            | [Phone](empty-phone.png)            |

The initial visual pass found excessive whitespace around a single connection
and tiny labels on phones. Sparse diagrams now use a shorter frame, while fixed
44px numbered nodes stay readable at every width. Source/target forms stack on
phones. Longer forms and conflict details scroll naturally. Multiline legend numbers align with the first line. A first-visit Patterns review also caught adjacent tool links relying on lazy page styles; shared styles now space them on desktop and give each a 44px phone row. All 18 final captures were inspected alongside the cabinet/Patterns references.

## Verification

All 18 focused connections/history browser journeys passed on desktop and phone.
The five connection cases cover explicit replacement review, unchanged source
calls/ranks, a readable constellation alternative, exact retry after reload,
stale reason recovery/removal, failed reads, offline draft controls, blocked
storage, a route-leave choice, 12-of-26 neighbors and 25-row list pagination. Axe
finds no violations, and long names fit 320/430/768px widths.

Real D1 checks separately cover owner boundaries, canonical duplicate pairs,
replacement loops, moves/Trash/archive, non-resurrection after removal, location/
version labels and version 4 backup remapping. The 1,000-link capacity test also
proves that a failed restore rolls back all records and its receipt, then retries
successfully after one link is removed. All 154 tests across 38 files passed.
The complete 207-case browser regression passed. After the last visual adjustments, six focused capture cases and both final entry-point journeys passed again. Formatting, lint, unused-code checks, TypeScript and production build passed. See the expansion tracker for remaining feature scope.

Fixtures and captures are isolated from the production archive. No physical
phone, native code, deployment or remote CI verification is claimed here.
