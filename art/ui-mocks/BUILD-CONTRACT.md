# Worth visual build contract

## Maintained references

Use the [reference index](README.md) for shared app composition, the collections
directory, everyday flows, landing and specialized tools. Open the relevant source
before implementing. These rules describe one current design, rather than a chain
of historical overrides. [DESIGN.md](../../DESIGN.md) explains the product flow;
[VOICE.md](../../VOICE.md) governs language and character behavior.

## Shared system

| Element                      | Target                                                                   |
| ---------------------------- | ------------------------------------------------------------------------ |
| Canvas / panel / raised      | `#181915` / `#20211c` / `#292a23`                                        |
| Text / secondary             | `#f0ecdf` / `#aaa99b`                                                    |
| Cream slip / dark muted text | `#eae5d5` / `#626456`                                                    |
| Primary action               | Butter `#e8dc9d` with dark text                                          |
| Rules / strong rules         | `#38392f` / `#737566`                                                    |
| Typography                   | Existing DM Sans, mostly 400–500; DM Mono for structural metadata        |
| Working-page title           | 48px desktop / 36px phone, weight 500, 1.1 line height, -0.04em tracking |
| Section heading              | Generally 24px desktop / 22px phone                                      |
| Labels / fields              | 14px sentence-case labels; 15px desktop / 16px phone fields              |
| Controls                     | 12px corners; ordinary action targets at least 44px                      |
| Cards / dialogs              | 22px corners; specialized directory phone cards 18px                     |
| Desktop navigation           | 192px rail                                                               |
| Content insets               | 36px desktop, 28px narrow desktop, 20px phone                            |
| Header spacing               | Start 40px desktop / 24px phone down; 28px / 24px after headers          |

Use flat fills without paper textures, gradients, gloss or fake analytics. Cream
panels have dark ink and visible focus. Compact labels remain readable; never
shrink user text to force a fit. Uploaded private covers take precedence over art.

`src/workspace.css` owns connected page framing and title rhythm. Import it after
connected app styles; keep screen-specific composition in its own stylesheet.
The standalone offline entry owns its CSS. Public Help/policy and offline titles
use the same readable scale under their own headers. Ranked displays, public
snapshots, printable objects and the signed-out landing retain presentation sizing.

The Home polish extends to every working page. Redundant introductions above page
titles are omitted; saved status, access role, board kind and receipt context appear
as readable text below the title. Settings has links to its existing sections.
Help and policies retain their complete wording and dates, with an optional contents
list derived from their headings. The [reading reference](app-polish/reading.html)
defines that shared composition. Public, offline, reader and editor titles use
the same -0.04em tracking while preserving their own presentation sizes.

## Navigation and capture

Home, Collections and Look back are primary. Search, Unfiled and account navigation
remain accessible utilities. Phones keep primary links and Add in a safe-area
bottom bar. Content, status panels and dialogs must remain usable above it.

Add opens a name-first native composer with an explicit destination: current
active list when open, otherwise Unfiled. Do not silently use the previous list.
A name is sufficient. Add item shows optional calls and Want to try directly and
offers inline New collection creation, preserving the draft and selecting the new
destination. Want to try parks an unsaved call and hides rating choices until
reversed; saving a plan adds neither a call nor a visit.
Add details opens an explicit dated-experience choice,
thought, labeled reaction and optional photo disclosure. Never infer an experience
from a name, image or save timestamp, or an overall call from a visit reaction.

An Unfiled find holds one optional experience and private photo. Filing transfers
these atomically. Interrupted saves preserve exact retry identities and device
drafts; name-only capture, older clients and older backup files remain supported.
The capture-source toolbar deliberately extends the Add reference with three quiet,
labeled actions below Name. Expand one inset panel at a time, keep the original
Name and Save controls, and retain source text in the same account-scoped draft.
Photo text/barcode reading stays on-device; only a deliberate ISBN lookup contacts
Open Library. Recognition does not attach a photo. Existing-name choices are inline,
leave saved calls intact, and require an explicit choice before a separate copy.
Unfiled adds a second, wrapping row of 44px collection choices and inline creation;
this replaces the default editor/save/file sequence. Duplicate warnings and errors
remain inline; pending filing recovery retains its existing identity and controls.
These are intentional usability refinements to the maintained Add and working-page
compositions, using their existing colors, typography, field sizes and mobile Save
footer. Phone inputs use 16px text. Native dialogs scroll inside the viewport and retain
focus return, outside/Escape dismissal and unsaved-change protection.

Phone collection, entry and recall menus use 20px side insets and 84px plus the
safe area of bottom clearance. Height is bounded by the smaller of 480px or the
available space below the header; long forms scroll internally. Desktop menus
stay anchored to their trigger.

## Working pages

Home prioritizes search and one cream reminder, then recent records including
Unfiled and collections. More from your archive discloses the existing deeper
memory/preferences/exercise panel only on demand. Collection cards group thumbnail/text horizontally on
desktop and for one phone collection; multiple phone collections use a compact
two-column shelf. Empty invitations use modest artwork. Actual saved context,
not streaks or missing-field prompts, gives someone a reason to return.

The collections directory uses one header with real counts, New collection and a
quiet New activity action. One toolbar groups Current/Archived with search/order
when there are more than three collections or an active query/nondefault order.
Keep opened filters available for that visit through filtering/archive changes.
Only mixed kinds need section headings.

Directory cards group a 144px, 1.6-ratio image, 24px name, 13px metadata and 12px
update caption. Use 16px padding, 20px gaps and 22px corners. At <=1180px use one
column. Phones use 96px artwork, 14px padding/gaps and 21px names. At <=360px use
80px artwork and stacked filters. Keep the original private photo framing.
`src/directory.css` owns this composition.

The approved [Home and collections polish](home-collections/README.md) defines
those two pages: 36px desktop insets, 28px narrow desktop and 20px phone; headings
keep the shared scale with -0.04em tracking. Home uses 18px recent names, small
labeled call badges and a vertical shelf of horizontal thumbnail/name cards.
Multiple phone cards use two columns; all available preview cards remain visible.
Directory artwork is 144px on desktop, with 20px grid gaps and a 128px minimum
card height. Phone artwork and all real counts/descriptions remain intact.

A collection has compact identity, name capture, All items / Want to try / Tried
tabs, direct call filters and search. Tried requires an explicit call or experience
and excludes plans. More filters holds other existing views and specialized
filters. Settings, sharing and More tools are contextual; Entry options holds
batch, experiences, selection and saved views. Want to try is visible in capture. Name-only saves return input
focus without opening details. Wide desktop selection uses a cream side slip;
widths up to 960px use a native scrolling sheet without moving list rows or
placing the preview below a long collection. Desktop always reserves the 300px
slip column (275px at narrow desktop widths), including an unselected placeholder.
Selecting, clearing selection, saving and filtering never resize the row column.
Preview calls save on an explicit click and can clear; browse selection writes
nothing. Edit and Add experience remain on the slip at all widths. Row Edit moves
into the options menu, alongside experience, rank, notes and queues. Direct call
filters and optional name-capture calls remain visible. Unranked items stay accessible.

These interactions deliberately refine the static collection and Add references
in response to the November usability review: fewer disclosures, a stable preview
column and clear separation of Add item from New collection. The existing dark
canvas, cream slip, tokens, typography and mobile sheet behavior remain the visual
reference. Sidebar collection links nest beneath Collections, Add item moves below
the wordmark, and Unfiled uses its full page. Saved banners dismiss after six
seconds, pausing on hover/focus and during pending or failed Undo. Home adds a
cream reminder after search, mixing older overall Favorites (90 days, with a
recent-favorite fallback), Want to try and the last 30 days of experiences.
Unfiled and older pages are eligible. A visit starts with a random category and
record; Show another cycles available categories. Refreshes retain the exact
record while it remains eligible. No-call, Meh and visit reactions never become
Favorites. Planned items offer I tried it in reminders, previews and readers:
choosing a call clears Want to try without creating a dated experience or changing
rank. Removing Want to try without a new call preserves the existing opinion.
The visible tabs, optional More from your archive and Customize collection groups
are intentional simplifications of the reference's default controls; the shared
tokens, phone sizes, cream cards and dark canvas remain authoritative.

Saved-record links outside the collection index use the same read-first semantics:
a native details dialog shows saved information and an explicit Edit action.
Unfiled rows expose View and Edit separately. Readers preserve notes, context,
photo captions, individual sets and measurements without inferring missing values.
Legacy editor links and draft recovery remain supported. The name-only creation
action deliberately precedes Customize collection / Activity options, keeping it
visible on phones. Those groups retain starters, templates, artwork and details.
Empty activity invitations precede optional tools; Resume is primary when a
workout is active. Navigation remains available while page code loads.

Item editors use a compact cream call card: the character sits beside its call and
caption, followed by the same three choices. The editor deliberately omits repeated
name/type and rank metadata from that card; the heading and Name field identify the
item, while collection ordering remains independent. This keeps optional product
fields prominent without making the reaction dominate the form. Product details
are labeled optional once per group. The item editor's Save footer stays visible
inside the scrolling dialog on desktop and phone, with Saved / Unsaved changes
feedback. Other desktop form actions retain their normal flow.

Large collection sections and past workouts initially draw 50 rows/cards, with
Show more to reveal the next 50. This deliberately extends the small reference
examples to bound rendering as archives grow. Search, counts, ranking, progress
and exports still use the full records. Select visible applies to drawn rows;
newly revealed rows receive keyboard focus. Closed past-workout sections do not
mount their cards, and reviewing a finished workout reveals its original row.

Look back contains Memories and Insights. Keep search visible; disclose dates,
list/archive filters, period shortcuts and specialized tools. Initially show
three real preference groups and an explicit expansion, with recorded-call
counts and separate activity progress. Existing routes remain directly usable.

Search, Unfiled, creation, readers and other tools use the same working-page
scale. Search and personal names wrap; clearing search restores focus. Empty
states use faceless paper or neutral objects, factual guidance and a useful action.
Creation is name-first with optional description/artwork and a live preview;
the optional Choose a starter disclosure fills only the name, closes on selection
and returns focus to Name. Existing descriptions, private covers and artwork choices
stay intact. No invented records, ranks or descriptions.

Settings presents downloads and restore first. Backup scope/limits, exact restore
preview, device cleanup and deletion consequences remain visible. Sharing has a
cream snapshot preview before Create link. Existing public links keep their fixed
collection-name/ranked-title/type scope, without calls, notes, photos or history.

## Identity and motion

Favorite, Meh, Not again and no-call remain optional, reversible and independent
of rank and queue membership. Use one actual call face/caption on the slip, plain
labeled buttons and accessible pressed states. No-call says Undecided / No opinion
required without a reaction face. Small row indicators remain static.

Large characters use matte butter `#e4d79a`, sage `#d4dac3` or clay `#e3c2b5`,
matching body strokes, fine ink features and faint blush. Favorite is pear-shaped
with raised hands and a small warm heart; Meh slouches; Not again leans sideways.
Large illustrations may have tiny feet. Keep expression and text alongside color.

Call choices share one `#dedaca` capsule track and dark selected segment. The pill
slides in 280ms and disappears for no-call. Large arrival reactions last 800ms;
one blink finishes within 3.2 seconds. Hands/heart settle earlier. Hover may add a
small lean; reduced motion disables character and hover transforms. No loops.

Capture focus highlights the group in butter without hiding outlines. Selected
rows retain their raised surface on hover. Collection-link arrows move 2px and
covers scale to 1.025 on fine-pointer hover or keyboard focus; touch/reduced motion
stay still. Factual confirmation panels use a 180ms entrance. Dialogs and mounted
slips may settle over 200ms with a 6px rise, disabled for reduced motion.

## Signed-out landing

Use the [landing references](taste-cabinet/landing-cabinet/README.md): simple
wordmark/sign-in header, centered headline and signup above three illustrated
folders, with a clearly labeled example Meh slip. Maximum width 1232px; 40px
desktop / 20px phone insets; heading maximum 92px, mobile 43–72px.

Drinks, Midnight snacks and Questionable purchases use the cup, snack-bag and
shopping-bag art in sage/clay/butter. Captions stay in the labeled example.
Desktop folder art uses the shared 1.6 ratio; mobile retains its staggered crop.
Long names and tabs wrap. No private fixtures, testimonials or fabricated counts.

The working example is below the hero. Desktop pairs its index with a 340px slip
(300px <=900px); <=680px stacks index then slip. Pointer selection can reveal the
changed slip on phones; keyboard activation preserves focus and reduced motion
scrolls immediately. Demo edits remain transient, with no API writes. New names
remain unranked/no-call. Signup precedes the example on phones.

## Artwork and exercise tools

Automatic artwork uses exact starter-name matches or monogram fallback. Explicit
objects and Sage/Clay/Butter choices persist per collection; private photos show
first. Pickers use three equal columns, 8px gaps and 44px labeled controls.

Exercise entries store ordered sets with positive integer reps, optional
nonnegative weight and explicit kg/lb. Blank weight is bodyweight. Keep the
28px set label, fluid labeled fields, 44px removal target and 12px desktop / 8px
phone gaps. Add set copies the last draft set; Repeat copies measurements into
a new dated draft and clears the note. Preserve legacy aggregate measurements.

Current visits and Resume / Finish precede routines, progress and collapsed past
visits. Past filters never hide an active visit. Setup and Save as routine belong
to the visit's options. Rest timers disclose without altering their countdown.
Session cards retain dark surfaces, 22px corners and factual exercise/set/rep
counts. No call icons, motivational copy or performance scores accompany activity.

A workout is an explicit named/date visit; same-day visits remain separate.
Editing its date updates attached entries; removing grouping preserves exercises.
Previous matching uses trimmed/case-normalized names in the current list, excludes
the edited record/current visit/future records and respects same-day order. Copying
previous sets explicitly copies original units; replacing filled drafts confirms.

Routines hold a name and 1–40 unique ordered exercise names. Starting snapshots
planned names into a fresh visit, never completed logs or measurements. A pending
exercise opens with blank sets and last time as reference. Only saved entries
supply actual totals. Routine edits/deletion preserve prior visits; Save as routine
opens an editable draft. Keep owner scoping, backup support and conflict recovery.

Read-only exercise history opens without losing an editor draft; nested Close or
Escape does not close the parent. The scrolling modal is at most 840px wide, or
viewport minus 24px on phones, with a 200px plot and readable HTML axes/dates.
Points are accessible buttons with date/value/unit/order and phone touch targets.
They represent individual entries rather than daily averages or elapsed-time
spacing. Total reps sums sets, Top weight takes their maximum. Keep kg/lb
separate; bodyweight, missing units and aggregate-only entries break weight lines.
Zero is numeric, not missing. Preserve exact sets, notes and honest empty states.

## Verification

Use isolated synthetic fixtures. Open the named current reference, then compare
1440 × 900 desktop and 390 × 780 phone captures. Check 320, 430 and 768px reflow,
long names, keyboard focus, reduced motion, empty/loading/error states, all calls,
clearing Meh, name-only capture and call/rank independence. Verify direct navigation
and returning Home after lazy pages load. Real records/timestamps may vary; data
and functionality must never be removed to imitate a mock.

Keep captures in ignored local output following [quality checks](../../docs/QUALITY.md).
Explain deliberate deviations and unavailable device checks. Passing automated
checks alone does not establish visual fidelity.
