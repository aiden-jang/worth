# Web Inbox verification

The Inbox extends the current cabinet edition’s ruled collection/empty layouts
and existing scrolling secondary dialogs. It keeps the 192px desktop rail,
68/50px page headings, dark canvas, butter actions and faceless paper art.
The drawer deliberately uses a smaller 50/42px heading; the editor uses one
full-width column. Neither presentation assigns an opinion or rank.

| State                         | Desktop, 1440 × 900                | Phone, 390 × 780               |
| ----------------------------- | ---------------------------------- | ------------------------------ |
| Unfiled find                  | [Desktop](unfiled-desktop.png)     | [Phone](unfiled-phone.png)     |
| Empty Inbox                   | [Desktop](empty-desktop.png)       | [Phone](empty-phone.png)       |
| Drawer over a collection      | [Desktop](drawer-desktop.png)      | [Phone](drawer-phone.png)      |
| Saved details editor          | [Desktop](editor-desktop.png)      | [Phone](editor-phone.png)      |
| Lost-reply filing recovery    | [Desktop](receipt-desktop.png)     | [Phone](receipt-phone.png)     |
| Draft for an unavailable find | [Desktop](unavailable-desktop.png) | [Phone](unavailable-phone.png) |

Captures use browser-only fixtures, never production seed data. The desktop
editor’s accidental half-width form and the drawer’s oversized heading margins
were corrected during visual review. Fields, filing controls and recovery actions
remain reachable through the native dialog’s scrolling area.

Focused journeys verify collection-free capture, exact creation/filing retries
after reload, restored editing drafts, stale revision/reload confirmation,
kept-separate duplicates, Trash Undo inside the drawer, Inbox-only restore preview,
same-route capture navigation and blocked-storage discard confirmation. Axe runs
on the editor and drawer. Long names and controls reflow at 320, 430 and 768px.
Real D1 tests separately cover owner/origin checks, capacity races, parent Trash
races, atomic export/filing, fresh restore IDs, rollback, purge and all-data deletion.

All twelve final captures were inspected. The empty desktop capture explicitly
resets scrolling immediately before capture. New backups use version 2, preventing
an older reader from silently dropping Inbox content; version 1 restore remains
supported. All 126 core tests/build checks passed. A full 149-journey regression,
40 recovery-focused journeys, 22 final Inbox journeys and six final backup/reflow
journeys passed during this increment. The expansion tracker records their scope.
This feature remains local to the separate branch; no remote CI, pull request or
deployment is implied by these captures.
