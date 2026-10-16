# Worth design direction

Worth is a private record of what someone tried, did, kept, and decided not to repeat. It is not a social feed, a productivity game, or a polished version of someone else's life.

The product has three jobs:

- **Collect** things worth finding again.
- **Log** what happened with enough context to make it useful later.
- **Rank** what held up, what did not, and what to revisit.

## Current build reference

The October 10 **taste cabinet** redesign responds to the user's request for a stronger visual
identity, cleaner compositions, cute deadpan humor and an implementation that follows its mocks.
Use [taste cabinet references](art/ui-mocks/taste-cabinet/README.md), authored and rendered before
reworking the app. The reference HTML and running app share `src/cabinet.css`; compare the
[implementation captures](art/ui-qa/taste-cabinet/README.md) at the same viewports.

This intentionally replaces the October 9 personality layout: collections now lead the archive;
a selected collection item has a cream opinion slip alongside the list on desktop and beneath
its row on mobile. The current signed-out landing uses a centered headline and three illustrated folders;
its interactive example has an index and opinion slip below the hero. The latest
illustrated-landing and plainspoken-copy sections of the build contract supersede
earlier landing compositions. The dark olive canvas, warm paper and butter accent form one consistent system.
There are no paper textures, fake analytics or mandatory opinions.

Typography is existing DM Sans, mostly 400–500, with DM Mono for small structural labels.
The desktop rail is 192px; signed-in titles are 68px and mobile collection titles are 50px.
Cream cards and dialogs have 22px corners, shelf images 16px, standard buttons 12px.
Call choices share one inset capsule track; primary signup/archive actions use capsules. The exact tokens and
responsive behavior are in the build contract. Earlier mock sets remain historical.

## Personality and voice

`Your taste. A place to keep it.` states the landing's point. The product line is
`Keep what you try. Rank what you like.` / `The meh can stay.`. The archive says `The archive.` and
`Good finds. Mixed feelings.`. A small deadpan face accompanies `Opinions may vary. Yours, mostly.`.

The opinion slip expresses one actual call with a face and a short caption: `Yes, again.`,
`It was a thing.`, or `Once was plenty.`. An item without a call says `Undecided.` / `No opinion required.`
and has no opinion face. Three plain, labeled buttons make the choice reversible.
The large face replaces repeated face graphics on those buttons; compact row faces remain.
The second cute pass gives reactions distinct soft silhouettes: slouched Meh, pear-shaped
Favorite and an asymmetric Not again. Large faces have tiny feet and expressive hands;
Favorite keeps a small warm-brown heart. Matte butter, sage and clay fills replace dark body outlines;
finer features and faint blush give the characters a quieter expression.
Brief arrival reactions, simplified gestures, a floating heart and one slow blink respect reduced motion. The larger illustrations and
rounder cards keep the established composition; no-call remains faceless.

[VOICE.md](VOICE.md) defines the copy and boundaries. Preserve user-written text. Functional
labels, account access, errors, deletion, privacy and sharing stay factual. Cute expressions
are reaction glyphs, not a chatty mascot. Use humor about taste, never the person's habits or body.

## Capture should stay lightweight

Worth must work for someone who only wants to remember a name and, sometimes, where it stands. The fastest
useful flow is: add a name → optionally rank it → leave. Notes, photos, dates, types, personal calls, and
revisit history are optional layers of context, never requirements for creating or keeping a record.

Every primary screen should preserve this low-effort path. Detail views can invite richer reflection without
making the archive feel like a journal that needs to be filled out.

## Core idea

The central interaction is a personal measure of value. A person can rank a wine, a movie, a restaurant, a car, or any other collection item without pretending those rankings are objective.

Rank order and a personal call are separate. Rank says how items compare. An optional call
says Favorite, Meh, or Not again. The app must never infer a call from rank position.

- **Favorite** for what they would choose again.
- **Meh** for a deliberately neutral opinion. This is distinct from leaving no call.
- **Not again** for what they would skip next time; the shorter label retains the existing
  Would not again meaning.

No call deletes a record. Keeping an ordinary or disappointing experience is useful context.
The running app accepts `favorite`, `meh`, `would_not_again`, and `null`. Migration 0005
preserves existing records and their relationships while adding the explicit neutral call.

Use "worth" as a question, not a claim: what was this worth to the person who logged it?

## Signed-out landing page

Small wordmark and Sign in; no archive navigation. A centered two-line headline and
signup lead into three illustrated folders. Below, tabs switch Drinks, Midnight snacks
and Questionable purchases while preserving transient edits in the working example. The selected item controls the slip.
Name-only capture adds an unranked item with no call. Demo state never writes to the API.
`EXAMPLE` and the explanatory footnote remain visible; no testimonials or invented statistics.

Mobile puts the headline and signup first, then illustrated folders and the example index/slip. The slip
has no rotation. Footer: `Meh is a complete sentence.` and one concise product scope line.

## Signed-in home

Left navigation: Archive, Collections, Activity, Patterns, Search. The home leads with a visual
collection shelf, then recently filed records and one cream top-ranked pick. Rank is explicitly
within that pick's collection. Use the user's current data; never invent a Favorite from rank.
Without rankings, show an unranked prompt; without collections, show actual activity instead.

Private uploaded covers take precedence. Only exact Drinks, Movies, Places and Cars starter
names get eligible bundled art. Other lists use layered monogram slips on a subdued field. Home shows up
to six directories; View all opens the complete directory. Empty accounts have useful creation actions.
Patterns keeps factual counts and recall. A cream panel shows actual Favorite / Meh / Not again counts, with proportional bars across recorded calls only. It does not turn those calls into a score.

## Collection composition

Title, actual count and user description, then quiet Show list / Share / settings. The list
column contains name-only capture and one toolbar combining browse views and Search/Filter.
Filters disclose existing options instead of adding permanent rows. Unranked items stay accessible.

At widths over 960px the selected item appears in a 310px side slip (275px below 1180px).
At 681–960px it follows the index. At 680px and below, the same slip appears beneath the selected
row in normal flow; the desktop copy is hidden from both view and the accessibility tree.
Rank, Note, Revisit and Details retain their original behavior. Escape clears selection.

## Details and secondary screens

`src/details.css` carries the cabinet tokens into editors, creation/settings, Patterns,
private ranked display and public snapshots. The old ranked-display rules have been removed.
Item details use the same `OpinionSlip` component and actual collection rank as the index.
Desktop pairs editable fields with the cream slip; mobile stacks identity, call, notes and Save.
Dates, photos and activity measurements use optional disclosures; saved values remain visible.
Forms scroll inside native dialogs and preserve unsaved-change confirmations.

The sharing preview uses cream paper with only the titles and types that the link will expose.
Creating a link is an explicit action after that preview. Revoke and expiration remain factual.
Private Show list and public snapshots use the same readable rank index and collection-scoped
cream top pick. The private ranked display's pick is always rank one, never inferred from a call.
Secondary screenshots and interaction checks are in the current QA directory.

## Data ownership

People can download records-only JSON or a photo-inclusive backup. Archived collections remain included; Trash is excluded. Restore creates new private records, preserves relationships and never restores public links. Export and sharing previews must state exactly which private content is included.

## Visual rules

| Use                     | Direction                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| Canvas / panel / raised | `#181915` / `#20211c` / `#292a23`                                |
| Text / secondary        | `#f0ecdf` / `#aaa99b`                                            |
| Opinion slip            | `#eae5d5` with dark ink and readable muted copy                  |
| Primary action / state  | Butter `#e8dc9d`, dark text on filled actions                    |
| Rules                   | `#38392f`, stronger `#737566`                                    |
| Layout                  | Open collection shelf, single working list, focused opinion slip |
| Motion                  | Brief character reactions, one blink, then still; reduced motion |

Avoid glossy effects, neon, gradients, texture, social mechanics and fabricated data. Cream
slips are intentional flat contrast, not simulated paper material. Keep all control labels
readable and useful without an illustration, hover or color cue.

## Verification

Open the corresponding composition reference before implementation. Capture and inspect at
1440 × 900 and 390 × 780; check 320, 430 and 768px for reflow and overflow. Compare structure,
spacing, faces, capture, state and typography, allowing actual record content to vary.
Exercise calls, clearing, ranking independence, name-only capture, filters, empty states and
mobile navigation. Report deliberate deviations and limits; passing tests alone is insufficient.

## Signature landing refinement

The latest user request strengthens the first view: a 400px opinion card and 192 × 176px
character sit beside the headline on desktop. Keep the card straight for crisp typography.
On mobile, order the headline and signup action, full-width opinion card, then example index.
Pointer selection in the mobile example reveals the changed opinion; keyboard selection
preserves focus. The selected call slides inside its capsule; clearing a call removes the
selection and face. Reduced motion keeps selection changes immediate. See
[signature verification](art/ui-qa/signature/README.md).

## Everyday interaction refinement

Capture fields use the shared 12px control corners and a butter border while focused.
Save/call/rank feedback remains factual in a small dark confirmation panel. A selected row
retains its selected surface on hover. Collection links acknowledge hover and keyboard focus
with a small arrow movement and cover scale; reduced motion keeps both still. There is no
change to the resting composition, stored data or required capture fields.

After successful single or batch capture, restore input focus after the pending state clears
so another name can be added immediately.

## Cabinet edition

The approved art-direction plan extends the characters' visual craft into the collection
shelf and first-use journey. Current [edition references](art/ui-mocks/taste-cabinet/edition/README.md)
include an identity sheet, empty/sparse/populated archives, empty/selected collections and
creation. Authored category objects replace photographic starter covers; private uploaded
covers remain first. Custom names receive layered monogram artwork. The archive and
directory use one shared cover object. The empty archive pairs its dry headline with a
cream brand illustration; empty collections and undecided slips use faceless paper art.
Creation pairs name-first capture with a live artwork preview. Suggestions fill names only,
and the first saved collection opens with capture focused. No opinions, ranks, descriptions
or sample records are invented.

## Cabinet finishing pass

Search and Patterns now use the edition's faceless paper empty states. Search uses the
same rounded controls and labeled capsules as the collection; results and recall titles
wrap so a personal name is readable. Clearing search restores the field's focus. Empty
Patterns opens a creation draft, never a prefilled archive. Existing recorded-call counts
and bars remain factual. Opened dialogs, settings and selected slips settle with a brief
200ms/6px entrance; reduced motion keeps them still. Settings and sharing keep their
accepted compositions and factual visibility/destructive copy. The signature landing
is verified with its interactive examples and retains its accepted composition.

## Illustrated landing cabinet

The user rejected the prior signed-out composition and asked for a stronger visual idea.
The current [landing reference](art/ui-mocks/taste-cabinet/landing-cabinet/README.md)
centers `Your taste. A place to keep it.` over three staggered illustrated folders and a
small explicitly labeled example Meh slip. Signup remains prominent. A separate working
example sits below the hero; mobile shows its index before the opinion slip. This supersedes
earlier landing layouts only. The accepted private cabinet screens remain current.

The landing now illustrates Drinks, Midnight snacks and Questionable purchases, using a
cup, snack bag and shopping bag. The working example uses the same topics. Long names
wrap instead of shrinking; the accepted three-folder layout and cream Meh slip remain.

## Personal tools

Collections now support an optional saved object and palette choice. Automatic keeps the existing starter-name/monogram fallback; private uploaded covers remain first. Creation previews the selection, and settings save it alongside name and description. See [personal tools references](art/ui-mocks/taste-cabinet/personal-tools/README.md).

Activity supports an explicit Exercise mode. One dated entry records one exercise and its ordered sets, with separate reps and optional weight in kg/lb. History summarizes actual set count, total reps and weight range; the editor shows every set. Repeating copies measurements into a new draft with today's date and no note. Legacy aggregate measurements remain editable and preserved. Switching to Activity confirms removal of entered draft sets. These records remain private and exportable; no scores or activity judgments are introduced.

## Workout visits and recall

An activity list can hold explicit workout sessions: a named/date visit grouping multiple exercise entries. Start a visit, then add its exercises; existing entries can be assigned from their editor. Separate visits on the same date remain separate. Session rename/date edits are supported; removing a grouping keeps its exercises intact. Exports include workout sessions and each log's relationship.

Exercise logging shows the latest earlier matching entry from this activity list. Current-visit entries and future records are excluded, including later same-day entries when editing history. Original units are kept beside corresponding sets. Use previous sets explicitly copies measurements and unit; replacing filled draft sets asks for confirmation. The [workout references](art/ui-mocks/taste-cabinet/workouts/README.md) retain the cabinet compositions.

## Reusable workout routines

Activity lists can save a named, ordered exercise lineup and start a fresh dated visit from it. Each visit snapshots the names, then offers an unlogged checklist; opening a name sets up blank reps/weight with last time available for reference. Only saving an exercise creates a log and contributes to workout counts. Editing/deleting a routine preserves existing visits, and Save as routine opens an editable draft from a workout. Routine and visit plans are private and exportable. See [routine references](art/ui-mocks/taste-cabinet/workouts/README.md#reusable-routines) for the shelf and deliberate integration differences.

## Exercise history and progress

A collapsed exercise directory and a set-editor action open read-only history for a normalized exercise name in the current activity list. Charts show total individually recorded reps or the heaviest logged weight per entry, keeping kg/lb separate and bodyweight/legacy gaps visible. Each point reveals its exact sets; history includes preserved notes and older measurements. Same-day visits remain separate. Empty and single-entry states avoid invented trends. Opening and closing history preserves an unfinished exercise draft. See [exercise progress references](art/ui-mocks/taste-cabinet/workouts/README.md#exercise-history-and-progress) for the cabinet composition and accessibility adaptations.

## Product flow completion

Workout visits now have explicit Active / Finished states, resumable exercise drafts,
an optional rest timer, save-and-next logging, and a factual saved-set recap. A visit's
planned names can be reordered or swapped without editing its source routine; skipped
names remain reversible. Queue membership is independent of opinion and rank. Added
dates and visit counts extend the existing collection filter disclosure. Search includes
exercise scope and matching note context. Optional new-record photos, account-scoped
local draft recovery, clear saving/offline status and on-demand pages extend the accepted
cabinet. See [product-pass QA](art/ui-qa/product-pass/README.md) for reference comparisons,
responsive adaptations and release limits.

## Product completion

[Settings and data](art/ui-mocks/taste-cabinet/completion/README.md) extend the cabinet
with export/backup, restore preview, device cleanup and explicit Worth deletion.
Privacy, Terms and Help are public, use the simple landing wordmark header, and
keep factual readable copy. Footer links make them available before account creation.
Existing cabinet screens retain their accepted compositions. The contact destination
was supplied by the user; shared-account deletion remains clearly separate.

## Unfiled Inbox

Inbox extends the cabinet with a private unfiled directory. It retains the 192px
rail, 68/50px page title, shared faceless paper empty art, ruled rows and optional
name-only capture. Navigation opens a native scrolling drawer over the current
page; a normal `/inbox` link also supports full-page and modified-click navigation.
The drawer uses 50/42px headings and 22px corners like the existing secondary tools.
This is a deliberate extension of the current edition references, not a native app.

The editor uses one full-width column for identity, optional call/context and
explicit filing, preserving a clear phone flow. A cream recovery panel contains
only the actual uncertain filing snapshot and destination. It never invents a call
or rank. Filing requires saved details and a deliberate keep-separate choice for
an exact name/type match. Desktop/phone and narrow reflow verification are recorded
in `art/ui-qa/inbox/`.

## Neutral activity objects

Empty activity logs now use an authored notebook and pencil in the shared cabinet
empty-state composition. An empty workout visit uses a smaller bottle and folded
towel beside its existing first-exercise guidance. These static, faceless objects
keep the cabinet palette and remain hidden from assistive technology. Activity
never receives a call, score or implied achievement. Existing headers, filters,
routine/workout actions and record behavior remain intact. This deliberately
extends the activity reference with the edition’s existing empty-state spacing;
phone captures scroll to that section to show the complete illustration and CTA.
See `art/ui-qa/activity-art/` for desktop/phone verification.

## Photo text review

Read a photo extends the existing capture composition: a dark source panel and
cream text-review panel share the 68/50px header, 22px corners and 44px controls.
Below 960px the source precedes review. Read text is editable, a name is chosen
explicitly, and a private note is folded until requested or already populated.
Inputs/labels use DM Sans; structural overlines keep DM Mono. Cream labels and
focus rings use dark ink for contrast. There is no fake source preview, inferred
opinion, automatic save or external processing. This is a deliberate extension
of capture and the cabinet’s secondary tools. Captures focus the source/review
section when the full phone flow exceeds one viewport.

## Barcode and book capture

Read a code deliberately reuses the photo reader’s dark source/cream review
composition, the existing cabinet rail, 68/50px title rhythm, 22px panels and
44px controls. A small authored faceless barcode slip accompanies an empty source;
it identifies the tool without inventing a product or opinion. Metadata uses
readable ruled/proportional text and stacks at phone widths. Book lookup is an
optional disclosure; ordinary manual naming remains visible. This is a web-only
extension of the reader/capture references, not a native camera application.
