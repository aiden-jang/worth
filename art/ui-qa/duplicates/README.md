# Existing-record duplicate review

A collapsed Possible duplicates section extends the existing comparison tool.
It keeps the Workbench dialog and cabinet beneath it, standard typography, rules,
wrapped text and 44px actions. Phone groups stack their Open/Revisit controls.
Keeping records separate saves a private, reversible review rather than editing
any records. The notes label now precisely says it excludes public ranking links;
booklets can include a note only through their separate explicit opt-in.

| State                         | Desktop                          | Phone                          |
| ----------------------------- | -------------------------------- | ------------------------------ |
| Pending matching records      | [Capture](pending-desktop.png)   | [Capture](pending-phone.png)   |
| Kept separate                 | [Capture](reviewed-desktop.png)  | [Capture](reviewed-phone.png)  |
| Precise note visibility label | [Capture](note-copy-desktop.png) | [Capture](note-copy-phone.png) |

Captures use synthetic Coffee/coffee fixtures at 1440 × 900 and 390 × 780, inside
a naturally scrolling native dialog. Review checks spacing, wrapping, contrast
and consistency with the accepted comparison/editor compositions. The item-editor
copy is a deliberate factual correction without changing that layout.

Ten browser journeys cover persisted review/reopen, new-member review, obsolete
review removal, explicit Revisit without automatic logging, stale metadata,
unfinished comparison protection, Axe and 320/390/430/768/1440px long-name layouts.
Pure tests cover equivalent text forms, different types, exact membership and
bounds. Real D1 tests cover foreign references, workspace revisions, active-record
filtering and backup ID remapping alongside existing shelf/ranking invariants.
All 98 tests, core checks and the full 79-journey browser run passed locally.
No production account was populated and no deployment is verified here.
