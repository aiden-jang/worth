# Archive tools

The first feature release adds Want to try, selection actions, reversible merges,
and deletion recovery. It preserves name-only capture and the cabinet composition.

## Want to try

Check Want to try while capturing one or several names, toggle it on the selected
item, or change it in Details. The browse strip has a matching view. This flag never
changes a call, rank, revisit queue or visit count. Existing items default to false.

## Selection

Select opens an optional toolbar and labeled row checkboxes. Select visible chooses
up to 100 currently visible records; selection can include records hidden by a later
filter. The confirmation lists every affected title. Cancel selection clears it.
Move, queue membership, Want to try, type and Trash support up to 100 selected items;
merge supports 2–20 distinct main entries in the same collection. Empty type clears it.
Actions keep their retry identity until their payload changes, so retrying a lost
response cannot move or merge records twice.

## Move

Choose a different collection in the same account. Notes, photos, merged originals
and all attached logs move together. Source ranks are removed; items arrive unranked
and the destination ranking stays intact. Activity lists are not destinations.

## Merge and separate

Choose one main entry. It keeps its title, dates, type, call, queue membership, Want
to try state, primary photo and rank. Other entries leave the index, but their original
fields, photos and log ownership are preserved. Details shows their notes, dates,
calls, photos and a combined visit history. Global search includes original notes
and opens the main entry. Original details and photos remain private.

Separate restores one original and its visits as an unranked item. No text is
concatenated or overwritten and no synthetic visit is created. A merge of groups
flattens membership; separating operates on individual originals. New visits belong
to the main entry. Existing visits retain their original item relationship when edited.
Records export and photo backup include originals and merge relationships; import
remaps all IDs and preserves those relationships. Public ranked snapshots contain
only their existing explicit main-entry titles/types, without original details.

## Trash and Undo

Deleting a list, item or log moves it to Trash for 30 days. Immediate Undo restores
the latest deletion; Settings → Trash provides recovery after navigation or reload.
Lists retain their child records and rankings. Item deletion includes its merged
originals and history; restored items return unranked to preserve the current order.
A record deleted separately inside a deleted parent appears after restoring the parent.
Restoring an already restored record is harmless.

Deleting a list revokes its public snapshots in the same transaction. Restoring it
does not reactivate those links. Downloaded snapshots and exports remain independent.
Trash is excluded from ordinary browsing, search, counts, photos and exports/backups.
Expired records cannot be restored and are physically removed on the next Trash read.
Deleting all Worth data permanently removes Trash as well; that action bypasses Undo.
Photo replacement/removal, routine deletion and removing a workout grouping retain
their existing behavior and are not covered by Trash.

## Verification

Real D1 tests cover privacy, parent restoration, retention, preserved merge photos and
logs, backup/import relationships, fingerprinted retries, foreign selections and
100-item Trash/Undo. Desktop and phone browser journeys cover capture/filtering,
selection previews, failures/retry, merge/separate, move and recovery. Visual evidence
and deliberate composition changes are recorded with this release’s QA captures.
