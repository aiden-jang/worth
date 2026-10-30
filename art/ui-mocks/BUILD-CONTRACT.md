# Worth visual build contract

## Maintained references

Use the [reference index](README.md) for shared app composition, the collections
directory, everyday flows, landing and specialized tools. Open the relevant source
before implementing. These rules describe one current design, rather than a chain
of historical overrides. [DESIGN.md](../../DESIGN.md) explains the product flow;
[VOICE.md](../../VOICE.md) governs language and character behavior.

## Shared system

| Element                      | Target                                                                    |
| ---------------------------- | ------------------------------------------------------------------------- |
| Canvas / panel / raised      | `#181915` / `#20211c` / `#292a23`                                         |
| Text / secondary             | `#f0ecdf` / `#aaa99b`                                                     |
| Cream slip / dark muted text | `#eae5d5` / `#626456`                                                     |
| Primary action               | Butter `#e8dc9d` with dark text                                           |
| Rules / strong rules         | `#38392f` / `#737566`                                                     |
| Typography                   | Existing DM Sans, mostly 400–500; DM Mono for structural metadata         |
| Working-page title           | 48px desktop / 36px phone, weight 500, 1.1 line height, -0.055em tracking |
| Section heading              | Generally 24px desktop / 22px phone                                       |
| Labels / fields              | 14px sentence-case labels; 15px desktop / 16px phone fields               |
| Controls                     | 12px corners; ordinary action targets at least 44px                       |
| Cards / dialogs              | 22px corners; specialized directory phone cards 18px                      |
| Desktop navigation           | 192px rail                                                                |
| Content insets               | 44px desktop, 28px narrow desktop, 20px phone                             |
| Header spacing               | Start 40px desktop / 24px phone down; 28px / 24px after headers           |

Use flat fills without paper textures, gradients, gloss or fake analytics. Cream
panels have dark ink and visible focus. Compact labels remain readable; never
shrink user text to force a fit. Uploaded private covers take precedence over art.

`src/workspace.css` owns connected page framing and title rhythm. Import it after
connected app styles; keep screen-specific composition in its own stylesheet.
The standalone offline entry owns its CSS. Public Help/policy and offline titles
use the same readable scale under their own headers. Ranked displays, public
snapshots, printable objects and the signed-out landing retain presentation sizing.

## Navigation and capture

Home, Collections and Look back are primary. Search, Unfiled and account navigation
remain accessible utilities. Phones keep primary links and Add in a safe-area
bottom bar. Content, status panels and dialogs must remain usable above it.

Add opens a name-first native composer with an explicit destination: current
active list when open, otherwise Unfiled. Do not silently use the previous list.
A name is sufficient. Add details opens an explicit dated-experience choice,
thought, labeled reaction and optional photo disclosure. Never infer an experience
from a name, image or save timestamp, or an overall call from a visit reaction.

An Unfiled find holds one optional experience and private photo. Filing transfers
these atomically. Interrupted saves preserve exact retry identities and device
drafts; name-only capture, older clients and older backup files remain supported.
Phone inputs use 16px text. Native dialogs scroll inside the viewport and retain
focus return, outside/Escape dismissal and unsaved-change protection.

Phone collection, entry and recall menus use 20px side insets and 84px plus the
safe area of bottom clearance. Height is bounded by the smaller of 480px or the
available space below the header; long forms scroll internally. Desktop menus
stay anchored to their trigger.

## Working pages

Home prioritizes search and recent records including Unfiled, then collections
and a compact real memory. Collection cards group thumbnail/text horizontally on
desktop and for one phone collection; multiple phone collections use a compact
two-column shelf. Empty invitations use modest artwork. Actual saved context,
not streaks or missing-field prompts, gives someone a reason to return.

The collections directory uses one header with real counts, New collection and a
quiet New activity action. One toolbar groups Current/Archived with search/order
when there are more than three collections or an active query/nondefault order.
Keep opened filters available for that visit through filtering/archive changes.
Only mixed kinds need section headings.

Directory cards group a 152px, 1.6-ratio image, 24px name, 13px metadata and 12px
update caption. Use 16px padding, 20px gaps and 22px corners. At <=1180px use one
column. Phones use 96px artwork, 14px padding/gaps and 21px names. At <=360px use
80px artwork and stacked filters. Keep the original private photo framing.
`src/directory.css` owns this composition.

A collection has compact identity, name capture and one browse/search/filter row.
Settings, sharing and Ranking & tools are contextual; Entry options holds batch,
Want to try, experiences, selection and saved views. Name-only saves return input
focus without opening details. Desktop selection uses a cream side slip; phones
use a native scrolling sheet without moving list rows. Add experience and Edit
lead, with ranking, notes and queues disclosed. Unranked items remain accessible.

Look back contains Memories and Insights. Keep search visible; disclose dates,
list/archive filters, period shortcuts and specialized tools. Initially show
three real preference groups and an explicit expansion, with recorded-call
counts and separate activity progress. Existing routes remain directly usable.

Search, Unfiled, creation, readers and other tools use the same working-page
scale. Search and personal names wrap; clearing search restores focus. Empty
states use faceless paper or neutral objects, factual guidance and a useful action.
Creation is name-first with optional description/artwork and a live preview;
suggestions fill only the name. No invented records, ranks or descriptions.

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
