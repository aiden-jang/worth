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
its row on mobile. The landing uses an open example index, with its selected opinion on a slightly
tilted slip. The dark olive canvas, warm paper and butter accent form one consistent system.
There are no paper textures, fake analytics or mandatory opinions.

Typography is existing DM Sans, mostly 400–500, with DM Mono for small structural labels.
The desktop rail is 192px; signed-in titles are 68px and mobile collection titles are 50px.
Opinion slips and collection images have 10px corners, controls 7px. The exact tokens and
responsive behavior are in the build contract. Earlier mock sets remain historical.

## Personality and voice

`For the good. And the meh.` states the landing's point. The product line is
`Keep what you try. Find what’s worth repeating.`. The archive says `The archive.` and
`Good finds. Mixed feelings.`. A small deadpan face accompanies `Opinions may vary. Yours, mostly.`.

The opinion slip expresses one actual call with a face and a short caption: `Yes, again.`,
`It was a thing.`, or `Once was plenty.`. An item without a call says `Undecided.` / `No opinion required.`
and has no opinion face. Three plain, labeled buttons make the choice reversible.
The large face replaces repeated face graphics on those buttons; compact row faces remain.

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

Small wordmark and Sign in; no archive navigation. The open composition pairs a two-line
headline and signup with a working example index and one cream opinion slip. Tabs switch
Drinks, Movies and Places while preserving transient edits. The selected item controls the slip.
Name-only capture adds an unranked item with no call. Demo state never writes to the API.
`EXAMPLE` and the explanatory footnote remain visible; no testimonials or invented statistics.

Mobile puts the headline and signup first, followed by the index and slip. The slip has no
rotation on phones. Footer: `Meh is a complete sentence.` and one concise product scope line.

## Signed-in home

Left navigation: Archive, Collections, Activity, Patterns, Search. The home leads with a visual
collection shelf, then recently filed records and one cream top-ranked pick. Rank is explicitly
within that pick's collection. Use the user's current data; never invent a Favorite from rank.
Without rankings, show an unranked prompt; without collections, show actual activity instead.

Private uploaded covers take precedence. Only exact Drinks, Movies, Places and Cars starter
names get eligible bundled art. Other lists use their initial on a neutral field. Home shows up
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

People can download their lists, items, logs, ranks, and personal calls as JSON. The export is deliberately records-only. Photos remain in Worth and are never represented as a backup.

## Visual rules

| Use                     | Direction                                                        |
| ----------------------- | ---------------------------------------------------------------- |
| Canvas / panel / raised | `#181915` / `#20211c` / `#292a23`                                |
| Text / secondary        | `#f0ecdf` / `#aaa99b`                                            |
| Opinion slip            | `#eae5d5` with dark ink and readable muted copy                  |
| Primary action / state  | Butter `#e8dc9d`, dark text on filled actions                    |
| Rules                   | `#38392f`, stronger `#737566`                                    |
| Layout                  | Open collection shelf, single working list, focused opinion slip |
| Motion                  | Small hover changes only; respect reduced motion                 |

Avoid glossy effects, neon, gradients, texture, social mechanics and fabricated data. Cream
slips are intentional flat contrast, not simulated paper material. Keep all control labels
readable and useful without an illustration, hover or color cue.

## Verification

Open the corresponding composition reference before implementation. Capture and inspect at
1440 × 900 and 390 × 780; check 320, 430 and 768px for reflow and overflow. Compare structure,
spacing, faces, capture, state and typography, allowing actual record content to vary.
Exercise calls, clearing, ranking independence, name-only capture, filters, empty states and
mobile navigation. Report deliberate deviations and limits; passing tests alone is insufficient.
