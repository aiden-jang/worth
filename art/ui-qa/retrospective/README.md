# Retrospective verification

Patterns adds one secondary look-back action while retaining its current totals
and call panels. The private period page deliberately extends the edition’s
192px rail, 68/44px headings, dark 22px form, ruled totals and faceless empty paper.
Chronological groups stack on phone. A readable time-zone caption and ordinary
sans-serif checkbox labels keep the page aligned with the other cabinet tools.
Internal record arrows open the existing private record/detail routes.

| State                         | Desktop, 1440 × 900                 | Phone, 390 × 780                |
| ----------------------------- | ----------------------------------- | ------------------------------- |
| Explicit period controls      | [Desktop](period-desktop.png)       | [Phone](period-phone.png)       |
| Applied period, notes absent  | [Desktop](results-desktop.png)      | [Phone](results-phone.png)      |
| Private notes selected        | [Desktop](notes-desktop.png)        | [Phone](notes-phone.png)        |
| Empty chosen period           | [Desktop](empty-desktop.png)        | [Phone](empty-phone.png)        |
| Long names and bounded groups | [Desktop](long-records-desktop.png) | [Phone](long-records-phone.png) |

These are viewport captures of explicitly scrolled sections, using isolated
browser fixtures. The source records are never seeded into production. Record
names/notes wrap and groups stack rather than shrinking or truncating personal
text. Large groups state that only the latest 50 are shown, while totals remain
complete. An empty period is factual, faceless and free of scores or pressure.

Real D1 tests verify owner/session boundaries, local saved-day inclusion at both
edges, entered log dates, archived opt-in, Trash/foreign exclusions, a selected
list excluding Inbox, full counts/display limits and filing without double-counting
or changing the original creation date. Unit tests cover real/ordered/bounded
periods, shortcuts, daylight-saving endpoints and native calendar boundaries.

Browser journeys verify no automatic recap read, explicit apply, accessible results
focus, note opt-in, unchanged applied results while controls change, refresh of the
applied period, retry, empty states, offline state, blocked storage and account
recovery. Axe runs on the actual result, and long content fits 320, 430 and 768px.
Independent calendar cases cover a device changing from New York to Auckland while
a recap remains open, Santiago’s midnight gap and Apia’s skipped local day.

The first broad run exposed an activity test reloading before native dialog close
navigation finished. It now waits for the hidden dialog and clean route before
reloading or opening the next flow; no sleeps or weaker assertions were added.
The expansion tracker records the final full regression and core-check results.
This remains local web-only work, without remote CI or deployment. It does not
complete the separate ranking/opinion-history or offline-write features.

All ten final captures were inspected. All 144 tests across 36 files and the core
checks/build passed. The 14 focused retrospective/activity journeys passed,
followed by all 189 journeys in the full desktop/phone regression.
