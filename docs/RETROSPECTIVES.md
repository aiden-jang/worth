# Quiet retrospectives

Patterns → Look back opens `/patterns/look-back`. It reads currently kept finds,
Inbox entries, collection visits and activity logs for an explicitly chosen period
of one to 366 calendar days. Preset buttons only fill controls. Nothing is queried
for the recap until Show this period, including after restoring device controls.
Changing controls leaves the last applied period clearly labeled until applied.
Refresh reads the last applied period, not unfinished controls.

The view is a current-record recap, not an event archive or reconstructed taste
history. It does not assign calls/ranks, compare activity to goals, infer a trial
from saving a name, create reminders or publish anything. Names/notes show their
current saved contents. Deleted records are excluded; merged originals are not
counted as separate finds. It cannot tell what an earlier opinion or deleted
ranking was. Those history features remain separate pending work.

## Dates and scope

Saved finds use creation timestamps bounded by local midnight on the start day
and midnight after the end day. The browser supplies the actual local boundary’s delta from UTC at both endpoints,
allowing daylight-saving changes within a period and midnight clock gaps. A wholly
skipped local day is rejected rather than borrowed from a neighboring day. The server checks real ISO dates,
ordered periods of at most 366 days, bounded finite boundary deltas and a positive time
window. Historical second-level boundaries are preserved and rounded to integer
milliseconds before querying. Dated logs use the calendar dates explicitly saved on those logs, even if
the entry was created later. The applied device time zone remains labeled in readable form and also governs
saved-day rendering if the device changes zones while the recap stays open.

All lists and Inbox includes active unfiled finds. Choosing one owned list excludes
Inbox and every other list. Archived collections are excluded unless explicitly
included; selecting an archived list requires that choice too. Trash and inaccessible
merged parents are excluded through the existing active views. Moving or filing a
find preserves its creation date, so a saved Inbox find can appear in its current
collection without being counted twice. No first-tried date is inferred.

`GET /api/retrospective` uses the existing signed-in, account-bound API client.
Owner checks apply to every joined source and an optional selected list. A stale
account binding returns 409 before reads; another owner’s list returns 404. Result
responses use the common no-store security headers. There is no external provider.

Counts and both record groups run in one D1 batch snapshot. Counts cover all
matching records; each group shows the latest 50 with an explicit limit/narrowing
message when there are more. Kept finds sort by creation time; visits/activity
sort by entered day and creation time. Stable IDs break ties. The groups are
separate so a date-only log is not given an invented time within a day.

## UI, recovery and privacy

The page extends the current Patterns typography, ruled totals and readable
records, with an optional date/list form and faceless empty paper. Phones stack
controls and record groups; full names/notes wrap. Results receive focus only
following Show this period, not background refreshes. Private notes are absent
from the rendered recap until selected. They stay inside the authenticated page.
No photo, publication, public link, inferred opinion or workout score is added.

Period/list/note-display controls can recover in owner-scoped seven-day device
drafts. Applied results are not persisted as a new history snapshot and do not
auto-open on reload. Account recovery removes the old page and cancels pending
queries; a new document gets fresh controls/cache for its account. Blocked draft
storage cannot prevent reading a period, but loses those controls on exit.
Offline state disables new reads and labels any loaded recap as possibly outdated.
Read errors retain controls and expose retry. Empty periods show factual empty copy.

This adds no database table or backup format. Existing records/backups contain
its source data; device cleanup removes its control draft. Public snapshots,
booklets and existing exports retain their previous explicit content projections.
Local QA uses real D1 owner/date/filing tests and deterministic browser fixtures;
see [verification](../art/ui-qa/retrospective/README.md).

Calendar gap behavior follows the browser’s local Date disambiguation, documented
in [MDN’s local date operations](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date/setDate#description).
