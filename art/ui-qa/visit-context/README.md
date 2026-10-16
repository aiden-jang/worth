# Private visit details

This extends the existing scrolling revisit editor with an optional This visit
section, using cabinet labels, rules and 44px controls. It keeps simple date/note
capture and the item editor's composition. Location/edition pair on desktop and
stack on phones; order/setup preserves line breaks. A labeled reaction selector
describes only this visit, without an overall-call illustration or inferred rank.

Private history and comparison tables gain a collapsed Visit details readout.
Long notes and context wrap; phone history with saved details puts the date above
the note/readout and actions. This is a deliberate readable extension of the
existing editor/history composition. The accepted cabinet palette/font/rail remain.

| State           | Desktop                        | Phone                        |
| --------------- | ------------------------------ | ---------------------------- |
| Revisit editor  | [Capture](editor-desktop.png)  | [Capture](editor-phone.png)  |
| Private history | [Capture](history-desktop.png) | [Capture](history-phone.png) |

Synthetic Coffee fixtures are captured at 1440 × 900 and 390 × 780. Browser checks
cover save/reload, reaction independence, draft recovery, explicit conflict reload,
failed-save retry, simple revisit capture, Axe and 320/390/430/768/1440px long content.
Real D1 checks cover owner boundaries, stale revisions, context search, fixed public
snapshot scope, backup ID remapping, legacy defaults, activity rejection, original
logs after merge/move/Trash and a parent trashed immediately before an update.

All 104 tests and core checks passed. The full browser run passed 95 journeys;
all eight visit-detail cases passed again after the final spacing adjustment.
The final build, formatting and lint passed. Every capture was visually reviewed.
No production archive or deployment is verified here.
