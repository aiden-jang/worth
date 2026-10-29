# Worth's everyday flow

Worth is a place to save names and memories with very little required input.
Organization, reactions, ranking and detail are optional. The October 28 revision
changes how people reach existing capabilities; it does not migrate or remove data.

## Save first

Choose **Add**, enter a name and choose **Save**. Outside an open active list,
**Save in** starts at **Unfiled**. Inside a list it visibly selects that list.
There is no hidden last-used destination. A recovered draft keeps its own visible
destination. Unfiled is the existing Inbox store with a clearer primary UI label.

**Add a note or an opinion** opens optional text and an overall call. For a
collection, **Record a dated experience** makes the date visible and treats the
reaction as **This time**. It saves a name and visit together using the existing
transaction. If that name already exists, Use saved attaches the visit explicitly
to that record; otherwise Save keeps a separate new name. A saved name alone never creates a visit. Photos and dated visits
are available after an Unfiled find is moved into a collection.

Choosing an activity in Add saves one dated activity entry. Exercise sets and
workout controls remain in that activity's dedicated flow. Nothing is completed,
grouped into a visit or given measurements automatically.

Save closes the composer and offers Open and Undo. Undo uses existing 30-day Trash
recovery. A new name and its first visit undo together; a repeat visit undoes only
that visit. Save and Trash notices replace each other and stay above phone navigation.
Unfinished drafts remain scoped to the account on this device. A lost
save reply freezes the exact payload and operation identity; Retry checks that
same save, including after reload. Clearing a retry draft does not undo a request
that may already have reached Worth.

## Find what you kept

Home starts with search and recent records, including Unfiled. List shortcuts open
existing data; no names, calls or activity are invented for a sparse account.
Collections and a compact memory offer quieter ways to browse. The regular search
continues to cover archived content with its existing labels and boundaries.

Collections open with name capture, a browse selector, search and Filter. A
name-only save returns input focus without opening details. Selecting a record
shows its actual call in the desktop slip or a native phone sheet, leaving other
rows in place. Add experience and Edit stay visible. More options holds rank,
notes, Want to try and revisit queue actions.

**Collection options** contains sharing, presentation, settings and **Ranking &
tools** (the existing Workbench). **Entry options** contains batch capture, Want
to try capture, dated experiences, bulk selection and saved filter views. Each
menu closes on outside focus/pointer or Escape. No advanced capability or saved
configuration is deleted.

## Look back

**Look back → Memories** searches dated visits/activity or saved-name dates.
Filters opens list, date, archive and period choices. Links retain their exact
scope, and old `/patterns/remember` links still open directly. Saved-name dates
are UTC and remain distinct from experienced dates.

**Insights** shows recorded preferences and their supporting sources. The first
three groups are expanded, with Show all for the rest. Overall-call counts stay
separate from visit reactions. Unrated is distinct from Meh. Activity links lead
to the original progress/history views. More tools retains period summaries,
calendar, boards, connections, shared spaces, capsules and field guides.

## Gym and activity

The active workout and Resume / Finish controls precede optional setup. Routines,
progress/exercise history and past search open on request. Older workouts remain
available under Past workouts. A past filter never hides an active visit or its
actual entries. The visit's own menu holds Edit workout and Save as routine; Rest
timer opens its existing controls.

Previous exercise sets remain references. Copying them is explicit; no weights,
reps, units, target completion or exercise results are inferred. Separate same-day
visits, legacy measurements, source routines and conflict protection are preserved.

## Data and verification

Settings retains JSON restore, photo backups and Excel downloads. Existing URLs,
private ownership, account boundaries, Trash and public-link scope are unchanged.
There are no database migrations or new external services for this revision.

Design references live in `art/ui-mocks/everyday`; dated implementation captures
and verification limits live in `art/ui-qa/everyday-flow`.

Unfiled finds also participate in saved-name recall and overall-call insights.
Their saved dates remain UTC, they never become dated visits, and their source
links open the original Unfiled find. Filing moves that source into its collection
without creating a duplicate recall entry. Owner scoping, Trash exclusions and
50-record pagination apply to both sources. No database migration is required.
