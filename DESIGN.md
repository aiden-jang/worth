# Worth design direction

Worth is a private place to remember what someone tried, did and liked. Capture
should feel complete with a name alone. Notes, photos, dates, types, calls,
rankings and workout measurements are optional context.

## Current references

The [reference index](art/ui-mocks/README.md) identifies the maintained compositions.
The [build contract](art/ui-mocks/BUILD-CONTRACT.md) owns exact tokens, dimensions,
responsive behavior and motion. [VOICE.md](VOICE.md) owns copy and character rules.
Keep these documents about the current app; Git retains superseded designs and
completed implementation plans.

## Everyday flow

Home leads with search and recent records, including Unfiled. Collections and a
compact memory follow. Someone can save without first creating or organizing a
collection. Use actual records and useful empty states, without sample private data.

The existing Home memory slot may also show a recorded preference or an exact
exercise comparison. Its source stays selected for the visit while refreshed calls
update in place. Pull a memory remains explicit. Sparse accounts use an invitation;
aggregate preferences and exercise results use neutral artwork rather than an inferred call.

Search invitations and no-match states use a small paper-and-magnifier illustration;
empty Insights uses an archive folder. These static decorative vectors extend the
existing quiet-state composition and palette without implying a saved photo or call.

Add opens one name-first composer and states its destination. Use the current
active list when open; otherwise use Unfiled, independently of previous choices.
Add details offers an explicit dated experience, thought, reaction and private
photo. Saving a name or photo alone never implies a visit or an opinion.
Successful capture restores focus after saving so another name can follow.
Interrupted saves retain their exact retry identity and account-scoped draft.

Primary navigation is Home, Collections and Look back. Search, Unfiled and personal
shortcuts are utilities. Desktop uses the 192px rail; phones use the persistent
safe-area navigation and Add bar, plus search/account access in the header.
Content, status panels and menus must clear that bar.

Look back combines Memories and Insights. Keep search visible and disclose dates,
list/archive filters, period shortcuts and specialized tools. Insights initially
shows three real preference groups, with expansion for the rest. Counts use
recorded calls and explain their denominators. Activity progress stays separate.
Cards lead with a factual observation, retain all three call counts and identify
tied or small samples. Shared methodology appears once; the overall-call distribution
discloses under Archive totals. This refines the Insights content within the existing
Look back composition, without changing its counts or sources.
[Everyday behavior](docs/EVERYDAY.md) and [memory/progress](docs/REMEMBER.md) define
these flows. Existing direct routes remain usable.

## Collections

The directory has one compact header, actual counts, New collection and a quiet
New activity action. One toolbar groups Current/Archived and optional search/order.
Keep filters visible for more than three collections or an active query/nondefault
order, and through filtering for the rest of that visit. Mixed kinds have section
headings; one kind does not repeat the page title.

A collection opens with identity, name capture and one browse/search/filter row.
Settings, sharing and Ranking & tools are contextual. Entry options discloses
batch capture, Want to try, experiences, selection and saved views. Unranked items
remain accessible. Wide desktop selection uses a cream side slip; widths up to
960px use a native scrolling sheet with focus return and stable list positions.
The preview stays reachable without scrolling past the collection's rows.
The selected slip is read-only: it shows the saved call, character and filled
details without reaction buttons or an Unranked badge. Each row has a quiet Edit
action and an options menu for Add experience, rank, notes and queues. Preview sheets
retain Edit and Add experience as navigation to explicit editors. Browsing never
changes a call; the item editor saves its changes explicitly.

Private uploaded covers take precedence over optional built-in artwork. Automatic
art uses exact starter-name matching or a monogram; explicit saved object/palette
choices remain available. Artwork never implies a call, a rank or a memory.

Optional item details sit together under Add details. Product starters offer brand,
variant, size and price/currency; Places offers location. Other collections can
explicitly add product details. Name-only capture stays complete. Brand and size
reuse private custom details, and variants/prices reuse their existing storage.
Only filled facts appear on the selected slip. Brand filters and preference groups
use recorded details/calls, with supporting records and honest sample counts.

## Calls and personality

Rank describes comparison inside one collection. Favorite, Meh and Not again are
independent, reversible calls; no-call is separate. Never infer one from rank,
queue membership or a missing choice. Storage retains `favorite`, `meh`,
`would_not_again` and `null` throughout editors, filters, backups and summaries.

The slip shows one actual call, character and dry caption. No-call stays faceless
with Undecided / No opinion required. Call buttons keep text, pressed states and
visible focus; color and expression are never the only indicators.

Matte butter, sage and clay characters have distinct soft silhouettes, fine ink
gestures and faint blush. Large characters may react briefly and settle; row
badges stay still. Reduced motion disables character movement and hover transforms.
Humor is about subjective taste, never habits, spending, bodies or performance.
Functional labels, errors, account access, privacy and deletion remain literal.

## Signed-out landing

Use a simple wordmark/sign-in header, centered headline, signup and three
illustrated folders: Drinks, Midnight snacks and Questionable purchases. A
clearly labeled example slip accompanies the folders; the working example follows
the hero. Desktop pairs its index with the opinion slip; phones put the index first.
Long names and category tabs wrap.

Demo edits remain local and transient. New names are unranked/no-call. No API
writes, invented testimonials, private-account fixtures or fabricated analytics.
Footer Help and policy links remain accessible before account creation.

## Workouts and activity

Current visits and Resume / Finish lead. Routines, progress and past visits disclose
below; past filters never hide an active visit. Setup and Save as routine belong
to the visit's options. Rest timers disclose without changing their countdown.
Exercise logging is name-first with optional context and explicit original units.

A routine snapshots planned names into a fresh dated visit, never completed logs
or inferred results. Editing/deleting a routine preserves prior visits. Only saved
exercise entries contribute to actual counts. Previous sets are a reference;
copying them is explicit and replacing a filled draft requires confirmation.

Progress shows real entries, separate same-day visits and exact sets/notes.
Confirmed Finish reveals one compact result summary and moves focus to its heading.
It counts saved entries and individual sets, leaves incomplete rep totals explicit,
and links comparisons to exercise history. Review workout clears past filters and
opens the actual recap; dismiss returns focus to Start workout. These additions
extend the current workout composition and Home card without introducing another screen.
Keep kg/lb separate, bodyweight distinct from zero and legacy measurements readable.
Do not invent trends or score someone's activity. The [workout references](art/ui-mocks/taste-cabinet/workouts/README.md)
cover sessions, routines and progress; [capabilities](docs/FEATURES.md) links the
other maintained tools.

## Supporting tools and data ownership

Use the shared compact working-page frame for Search, Unfiled, capture, Look back,
creation and Settings. Optional tools disclose their complexity. Native dialogs
scroll within the viewport, preserve unfinished work and restore focus on close.
Source/review tools pair dark input with cream reviewed output; phones stack them.
Original photos keep their aspect ratio and keyboard alternatives to manipulation.

Core capture, item, Unfiled, experience and workout dialogs keep their primary save
reachable on phones and compact touch screens. Save actions remain associated with
their form, show retry errors, and leave room for focused controls. Dialogs follow
the visible viewport when a keyboard reduces it. The item editor also keeps its Save
footer visible on desktop; other desktop actions retain their normal flow.

Settings leads with downloads and restore, followed by recovery and device cleanup.
Excel and JSON scope, backup limits, restore preview and deletion consequences stay
visible. Worth-only deletion remains separate from shared-account deletion.

Public snapshots expose a fixed collection name and ranked titles/types. Calls,
notes, dates, history and private photos stay out. Booklets, cards, field guides
and other exports have explicit inclusion choices and exact previews; downloaded
copies cannot be revoked. Never broaden an existing link's privacy scope silently.
Ranking images keep their full-width title and cream ranked list. A compact,
matching built-in illustration sits above the title; private uploaded covers are
excluded. The optional image preview, download and native share use one prepared PNG.

Unfiled memories and photos transfer atomically when filed. Recognition stays
on-device; optional ISBN lookup requires a deliberate request. Offline copies and
private collaboration retain their documented account, conflict and recovery
boundaries. See [architecture](docs/ARCHITECTURE.md) and [capabilities](docs/FEATURES.md).

## Verification

Before changing a page, open its current reference. Compare desktop 1440 × 900 and
phone 390 × 780, plus 320, 430 and 768px for wrapping. Inspect actual data, empty/
loading/error states, keyboard focus, long names, native sheets and reduced motion.
Keep private review fixtures out of production. Explain deliberate deviations and
unavailable device checks; automated tests alone do not establish visual fidelity.
Use [quality checks](docs/QUALITY.md) for the current workflow and coverage.
