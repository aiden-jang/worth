# Worth's everyday flow

Worth is a place to save names and memories with very little required input.
Organization, reactions, ranking and detail are optional. The October 28 revision
simplifies how people reach existing capabilities. Its subsequent Unfiled-memory
extension adds optional date/photo storage without removing existing data.

## Save first

Choose **Add**, enter a name and choose **Save**. Outside an open active list,
**Save in** starts at **Unfiled**. Inside a list it visibly selects that list.
There is no hidden last-used destination. A recovered draft keeps its own visible
destination. Unfiled is the existing Inbox store with a clearer primary UI label.

**Add details** opens optional text, a call and one photo. **Record a dated
experience** reveals the date and treats its reaction as **This time**. This also
works in Unfiled: a find can keep its date, thought and photo before organization.
An Unfiled find holds one optional experience; repeated visits belong to a
collection record. The overall call stays separate when editing an existing find.
Saving a name or photo alone never creates a visit.

For a collection, saving an experience creates the name and visit in one transaction.
If that name already exists, Use saved attaches the visit explicitly to that
record; otherwise Save keeps a separate new name. Filing an Unfiled memory creates
one unranked name and its dated visit atomically. A memory photo moves to the
visit gallery; a photo without a memory moves to the saved name. Filing never
duplicates the source in recall.

Choosing an activity in Add saves one dated activity entry. Exercise sets and
workout controls remain in that activity's dedicated flow. Nothing is completed,
grouped into a visit or given measurements automatically.

Save closes the composer and offers Open and Undo. Undo uses existing 30-day Trash
recovery. A new name and its first visit undo together; a repeat visit undoes only
that visit. Save and Trash notices replace each other and stay above phone navigation.
Unfinished drafts remain scoped to the account on this device. A lost
save reply freezes the exact payload and operation identity; Retry checks that
same save, including after reload. Clearing a retry draft does not undo a request
that may already have reached Worth. A selected photo is prepared on-device and
frozen before saving. If its upload reply is lost, Retry checks the same saved
record and upload; it does not create another find. Photos remain optional and
connected-only.

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
Migration 0028 adds private Unfiled photo storage. JSON version 11 preserves
Unfiled memories and original photos in a full backup; records-only restore keeps
an unavailable-photo placeholder. Excel includes the explicit experience date,
reaction and photo availability alongside the separate saved date and overall call.
Older backups remain supported. No new external service is used.

Design references live in `art/ui-mocks/everyday`; dated implementation captures
and verification limits live in `art/ui-qa/everyday-flow`. The Unfiled-memory
extension is verified in [its own captures](../art/ui-qa/unfiled-memories/README.md).

Unfiled finds participate in saved-name recall and overall-call insights. Only an
explicit experience also appears in dated Memories and visit-reaction insights.
Saved dates remain UTC, separate from the experienced date; links open the
original Unfiled find. Filing moves that source into its collection without
duplicate recall. Owner scoping, Trash exclusions and 50-record pagination apply
to both sources. Specialized calendars and period summaries remain collection-based.
