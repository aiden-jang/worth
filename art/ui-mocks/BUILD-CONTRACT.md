# Worth visual build contract

## October 10 taste cabinet — current target

User direction: stronger identity, cute dry humor, nonchalance, clean polish and fidelity between
mocks and implementation. Read [taste-cabinet/README.md](taste-cabinet/README.md), open each named
reference, then compare fresh app captures using [quality checks](../../docs/QUALITY.md).
The history below does not override this section.

- Canvas `#181915`, panel `#20211c`, raised `#292a23`; text `#f0ecdf`, secondary `#aaa99b`.
- Butter `#e8dc9d` primary action with dark text; cream `#eae5d5` opinion slips / rank picks.
- Flat fills; 22px cream cards/dialogs, 16px shelf images, 12px standard buttons and selected rows.
  Primary archive/signup actions and call choices use capsules. No texture, gradients or glossy effects.
- Existing DM Sans and DM Mono. Desktop rail 192px. Page width max 1200px with 44px desktop insets.
- Signed-in title 68px; collection mobile 50px, archive mobile 44px. Item names 20px.
- Landing headline max 96px; mobile responsive 48–82px. `For the good. And the meh.`
- Landing: open example list with three categories and one selected opinion slip; no framed demo.
- Archive: actual collection shelf first, recent records below, one explicitly collection-scoped rank pick.
- Collection: capture and one toolbar in the list column; 310px selected opinion slip beside it.
- Under 1180px slip 275px. At 681–960px it follows the index. At <=680px use only the inline selected-row slip.
- Cream panels: dark ink, muted `#67695b`, labeled call buttons, pressed choice dark fill / cream text.
- One actual call face and caption on the slip; no-call shows Undecided without a face. Buttons retain text labels.
- Favorite / Meh / Not again and no-call stay reversible, optional and independent of ranking.
- Rank / Note / Revisit / Details, filters, batch capture, private covers, exports and sharing keep existing semantics.
- Signup stays before the example on mobile. Navigation and essential call actions have >=44px mobile targets.
- Capture name only; records and user copy must not be changed to fit the design.

The accepted direction now extends to details and secondary pages:

- Editors reuse the opinion slip, with the item's actual rank; cream call panel beside fields on desktop and in normal flow after identity on mobile.
- Optional dates/photos/measurements disclose without removing fields or saved context. Form and dialog headings use the same 400–500 sans-serif rhythm.
- Sharing shows a cream snapshot preview before Create link. Public links still omit calls, notes, dates, photos and history.
- Private ranked display and public snapshots use a cream rank-one pick and readable wrapping rows.
- Patterns shows real call counts and proportional bars across recorded calls, with no inferred no-call count or score.
- Secondary headings are 68px desktop / 44px mobile. `src/details.css` owns these supporting compositions.

Reference viewports: 1440 × 900 and 390 × 780; additional wrapping checks 320, 430, 768px.
Screens may scroll; mobile dialog captures are viewport-only. Use isolated local fixtures for private QA.
Differences in real records, relative timestamps, display name and navigation icons are expected.
The pre-build static reference omits live export/account affordances; the app preserves them.
No data or function may be removed to imitate a mock. Document layout deviations explicitly.

## Cute refinement — October 10

The user requested a cuter pass after committing the build. Preserve the current layout,
palette, typography, controls and copy. Updated references in `taste-cabinet` use the same
soft oval face family as the app: fuller blush, smile eyes for Favorite, shrug arms for large
Meh, a shallow Not again frown, and a tiny heart only on large Favorite faces.
Opinion faces are ivory against the cream slip. Compact badges remain simple.
The large opinion face settles once after a call change; pointer hover adds a slight tilt.
Reduced motion disables both. No-call remains faceless; no call or ranking semantics change.
Use [quality checks](../../docs/QUALITY.md) for desktop/mobile verification.

## Soft characters — October 10, second cute pass

The user asked for a more visibly cute direction. The first oval-face pass was too slight.
This deliberate revision gives each call its own soft silhouette: a low, slouched Meh,
a pear-shaped Favorite with raised hands and a blush heart, and an asymmetric Not again
with a sideways expression. Large illustrations add tiny feet; compact row badges keep
only the expressive silhouette and face. Main verdict illustrations are 144 × 132px;
mobile inline slips use 132 × 121px. Cards grow naturally to accommodate the larger art.

Cream cards and dialogs now use 22px corners, shelf images 16px, standard buttons and
selected rows 12px. Call choices and primary signup/archive buttons are capsules; the slip's
rank has a quiet outlined capsule. The existing composition, dark palette, typography,
plain control labels and concise dry captions remain the foundation. A single squash-and-settle
reaction respects reduced motion. No-call stays faceless and rank remains independent.

See [quality checks](../../docs/QUALITY.md). Updated reference images
record these intentional changes rather than silently treating them as the old mock.

## Animated reactions — October 10

The user approved the soft characters and requested more animation. Large opinion faces
now have distinct arrival reactions: a 720ms happy hop for Favorite, a slumped arrival for Meh,
and a reluctant wobble for Not again. Hands shrug or wave once; Favorite's heart floats into
place. Eyes blink twice over 4.8 seconds, then remain still. No character animation loops.
Hover gives a small lean and lifted hands; call choices compress on press. All character
motion is disabled under reduced motion, including descendants and hover. Compact row
badges stay static, and no-call stays faceless. Layout and resting poses match the references.

See [quality checks](../../docs/QUALITY.md).

## Editorial cute — October 10, current refinement

The user requested a more tasteful, current direction after approving the animated characters.
Keep the accepted composition and typography. Characters now use flat matte butter `#e4d79a`
(Favorite), sage `#d4dac3` (Meh) and clay `#e3c2b5` (Not again), with body strokes matching
the fill. Smaller translucent cheek marks, finer features, simplified hands and short rounded
feet replace the more emphatic drawing. This palette is consistent in row badges and Patterns.
Text labels and distinct expressions remain; color is never the only call indicator.

Call choices share one `#dedaca` capsule track with a dark selected segment. Preserve each
button's accessible pressed state, reversible selection and keyboard focus. The rail adds 8px
of total padding height. Other card and layout dimensions stay consistent.

Arrival reactions run for 800ms with gentler amplitude; one blink ends within 3.2 seconds.
Hands and heart settle earlier. Motion stays finite and respects reduced motion. Reference
HTML and PNGs are updated; [quality checks](../../docs/QUALITY.md) includes the
three calls, desktop/mobile layouts and motion recording.

## Signature composition — October 10, current target

This deliberate refinement supersedes the earlier landing arrangement. Desktop puts the
headline and signup at left and a straight 400px opinion card at right, with an 88px gap.
The headline reaches 96px; the character is 192 × 176px. The example index follows the
introduction in the left column. At 681–900px, use a 300px card and let the index span both
columns. At <=680px, order headline/signup, full-width card, then example index, with a
168 × 154px character. Keep the signed-out wordmark/sign-in header and EXAMPLE labels.

Pointer category/item selection on mobile scrolls the changed opinion into view; keyboard
activation retains focus. Reduced motion uses immediate scrolling. The call track has one
dark selected pill, sliding in 280ms. No-call hides the pill and character. Text labels,
pressed states, reversible choices and rank independence remain unchanged.

See [quality checks](../../docs/QUALITY.md). Updated static
references reflect this arrangement; private pages retain their established compositions.

## Everyday interaction refinement — October 10

Capture controls now use 12px outer corners, matching other controls. Focus within the
capture group highlights its borders in butter without removing keyboard outlines.
Selected rows retain the raised surface on hover. Existing factual status messages use a
12px dark panel with a quiet butter dot and a 180ms entrance. Collection links lift their
arrow by 2px and scale the cover to 1.025 on fine-pointer hover or keyboard focus. Reduced
motion keeps them still; touch devices do not get a sticky animated hover. Resting layouts
and all call, rank, capture and privacy semantics remain unchanged. See
[quality checks](../../docs/QUALITY.md).

## Cabinet edition — October 10, current target

The user approved the comprehensive art-direction plan. Use the named
[edition references](taste-cabinet/edition/README.md) for archive, empty/sparse states,
collection and creation. The signature landing remains current. This revision supersedes
the earlier photographic starter covers and generic empty-state layouts.

- Keep the established dark canvas, DM Sans/DM Mono, rail, headline scale and opinion palette.
- Exact starter names Drinks/Movies/Places/Cars use authored flat SVG category artwork,
  with uploaded private covers first. Other names use layered cream monogram slips on a
  subdued sage/clay/butter field. Initial artwork never implies a call or rank.
- Archive shelf and collection directory share the same 1.6-ratio cover object. Numbering
  uses a 10px mono cream capsule at 14px left / 12px bottom. Category colors are confined
  to the artwork: sage #bec7ad, clay #cdb0a4, butter #d8cf9d; cream #eae5d5, ink #34382d.
- Empty archive: 76px heading, introduction/actions left, 380px cream illustration right,
  64px gap. The decorative Meh graphic represents the brand, not an actual recorded call.
  At <=960px stack; mobile heading 52px, full-width 290px-high card.
- Empty collection: faceless blank slips beside concise copy and Add a name; mobile stacks.
  Selection marks the row's actual rank/dash with a butter capsule. No-call opinion shows
  faceless slips and Undecided; choices remain optional and independent of ranking.
- Creation: max-width 960px, 32px padding, 22px corners. Form beside 310px live preview with
  56px gap; stack at <=960px. At <=680px use 22px/18px panel padding and 27px heading.
  Name suggestions fill only the name; no default description is saved. User descriptions
  and selected covers remain intact. Creating a collection enters its focused capture flow.
- Keep existing errors, optional disclosures, cover upload, draft confirmation and activity
  semantics. No accounts are prepopulated. Production private pages use real data only.

## History

## October 9 personality refinement — historical override

The user requests more fun, dry humor, nonchalance, and a clean, polished, tasteful UI.
Use the current authored references linked in [the index](README.md).
This supersedes the earlier refinement where they differ:

- Canvas `#111110`, panels `#181816`, raised surfaces `#1d1c19`, rust `#a54a3f`.
- Rules `#302f2b`; stronger rules `#58554d`. Warm ivory and blush face marks remain.
- 6px controls, 8px collection cards and call panels, 12px desktop demo frame.
- Collection browse filters become one horizontal segmented bar; the index fills the width.
- Item titles are 20px desktop / 19px mobile. Secondary metadata mostly uses DM Sans.
- Landing: `Good taste. Mixed results.` with `Remember what you try. Find what’s worth repeating.`.
- Small shrug aside: `Meh is a complete sentence.`. Example art uses eligible bundled covers.
- Only the active call shows its caption: `Yes, again.`, `It was a thing.`, `Once was plenty.`.
- Tiny hover/press face reactions respect reduced motion. Controls retain accessible pressed
  state, focus, and labels. No call remains separate from Meh and independent of rank.
- Account access, errors, deletion, privacy, and sharing retain factual copy.

## October 9 coherence refinement — retained foundation

The user's latest request prioritizes **overall polish and coherence**. Use the authored [composition references](README.md).
These documented changes supersede the older generated dimensions and landing composition:

- DM Sans headings: 56px desktop / 40px mobile; landing headline 84px / 58px.
- Rail: 208px desktop, with consistent 18px navigation icons and a tinted active surface.
- Item title: 18px; metadata: 10–12px. Controls: 40px desktop, 44px primary mobile targets.
- Corners: 4px controls, 6px collection cards, 8px desktop example frame.
- Rules: `#292929`; stronger rules: `#4d4a47`. Existing canvas, ivory, rust, and faces remain.
- Landing: benefit headline, signup, small Meh aside, and a functional EXAMPLE collection.
- Collection cards: photo above readable text, matching between Archive and Collections.
- Creation: name first; description and cover inside an optional disclosure. Scoped creation
  does not ask the user to choose the type they just selected.
- Export remains accessible in navigation with the JSON/no-photos explanation on the link.

Compare at 1440 × 900 and 390 × 780, then check 320, 430, and 768px for wrapping/overflow.
The generated references below remain historical foundation, not conflicting requirements.

## Shared visual system

| Element                        | Implementation target                                   |
| ------------------------------ | ------------------------------------------------------- |
| Canvas                         | Warm near-black `#0d0d0e`                               |
| Selected row / input           | `#171718`                                               |
| Main text                      | Warm ivory `#f4f0e9`                                    |
| Secondary text                 | Stone gray `#a6a29b`                                    |
| Rules                          | `#30302f`, 1px                                          |
| Selected call / primary action | Rust `#a63d38`                                          |
| Type                           | Existing DM Sans; 700–800 headings, 400–500 body        |
| Metadata                       | Existing DM Mono, 11–12px                               |
| Signed-in desktop rail         | About 220px, one vertical rule                          |
| Signed-in title                | About 80px desktop, 52px mobile                         |
| Item names                     | About 24px desktop, 20px mobile                         |
| Controls                       | Square or 0–2px corners; at least 44px mobile hit areas |

Use flat fills. Generated lighting, texture, and rasterization artifacts are not requirements.
Keep real negative space; do not replace the layout with rounded cards or dashboard widgets.

## Cute icon family

Use softly drawn ivory face discs with near-black facial features and tiny dusty-peach
cheeks `#d7a092`. Favorite smiles; Meh has sleepy half-lidded eyes and a flat mouth;
Not again has a small unimpressed frown. Large landing faces and spacious call choices
may have little curved arms or a half-hearted Meh shrug. Compact row glyphs have no arms
and may use an outlined variant. Rust remains the selected-state accent.

Category wine glasses, tickets, and cups may have discreet cute faces and rounded strokes.
Those are decorative category illustrations, not recorded calls. Preserve the dark canvas,
short copy, actual data, capture prominence, and private cover behavior. Activity rows and
items with no call must not acquire a call glyph merely to fill space.

## Personal calls and visual humor

Use **Favorite / Meh / Not again**, plus no call. Each visible call option has a text label
and a soft face: smile, half-lidded eyes with flat mouth, or frown. Use one shared
SVG glyph family in the build rather than platform emoji or different faces on each screen.
A small brand caption, `It was a thing.`, can appear under the selected Meh choice.

The three calls are categorical. Their placement on the landing is an illustrated legend,
not a slider, numerical rating, or rule for deriving calls from rank. Keep no-call separate
from neutral. Clearing the chosen call returns to no-call.

The app accepts `favorite`, `meh`, `would_not_again`, and `null`. Migration 0005 preserves
existing values, ranks, logs, and photos. Editors, filters, exports, and summaries support
Meh explicitly so it cannot be treated as Not again. Rank behavior stays
unchanged. The short Not again label maps to `would_not_again`; it is not another new value.

Controls need readable labels, keyboard focus, pressed state, and accessible names. Small
read-only row glyphs may use accessible call text with the archive legend as visual context.
Do not rely on facial expression or color alone for interactive choices.

## Signed-out landing

- Small wordmark and Sign in header; no archive sidebar.
- Desktop hero pairs the large wordmark, `Good. Meh. Not again.`, one concise
  `Remember what you tried. Find what’s worth repeating.` line, and one signup action with a large illustrated call legend.
- Three cute faces and generic wine-glass, ticket, and coffee-cup illustrations
  carry the explanation. The deadpan Meh face is the emphasis. Remove the long pitch and
  private-context paragraphs from the old landing.
- Below, a clearly labeled COLLECTION / EXAMPLE proof shows ranked specimens and calls.
  Desktop shows three specimens; the retained mobile mock shows one concise specimen.
  This is illustrative data, not a personal memory, testimonial, or collection limit.
- Mobile stacks the wordmark/headline, face legend, signup action, and example. Keep the
  visual and CTA above the first fold. Other content may scroll naturally.
- Signup and sign-in use the existing auth flows. Footer: `Your taste. On record.`. The user’s latest direction removes the repeated privacy tagline.

## Signed-in archive

- Preserve the left rail, date, large Lately. heading, search, recent index, and collection-specific shortlist.
- A small YOUR CALL legend shows the three meanings, without counts, a score, or analytics.
  The emphasized Meh glyph is illustration, not an automatically applied record state.
- Small real call indicators can accompany records. Rank always belongs to one collection.
- Replace the text-only bottom directory with a three-column landscape collection-cover strip.
  Use existing bundled Drinks/Movies/Places starter covers only for those optional starter
  collections. Personal uploaded covers retain precedence and stay behind private routes.
- The mock's covers are category art, not photos of the demonstrated experiences. No new
  generated lifestyle artwork or fabricated memory photos are needed.
- Accounts without photos or covers keep a calm text directory. Blank accounts stay useful.

## Collection and mobile

- Keep the title, count, optional user description, quiet Show list/Share, and prominent
  title-only capture. The sample mock removes the brand description and uses `Rank later.`.
- Use a small category line glyph near the collection identity and call glyphs beside records.
  Capture must still be the obvious action. No required photo, note, date, type, rank, or call.
- Preserve the ranked index, separate unranked section, quiet browse rail, and Search/Filter disclosures.
- Only the selected row expands. Its tray presents three labeled face choices with Meh selected
  in the example, then Rank, Note, Revisit, and Details actions. Rich details use the existing editor.
- Those short labels mean place in ranking, add a note, log a revisit, and open details.
  Give controls descriptive accessible names. Kept continues to mean Favorites.
- Mobile replaces the rail with accessible menu navigation and the browse rail with a horizontal strip.
  Show three equal-width call choices. Secondary actions may fit in one row at 390px and wrap
  into a two-column grid on narrower phones. Maintain 44px hit areas.
- Rows, the selected tray, and unranked entries scroll in normal flow. Do not pin the tray
  over other records or shrink labels to fit the viewport.
- Sharing retains preview and confirmation. Calls, notes, private photos, and history stay out
  of public ranked snapshots under the existing privacy rules.

## Verification

1. Open the current named image before implementing its page. Match layout and glyphs as well as copy.
2. Compare desktop screenshots at 1440 × 900 and mobile at 390 × 780, using local fixtures for
   private pages. No live account should be populated to imitate a mock.
3. Check type scale, rail width, row rhythm, capture prominence, faces, call states, covers,
   and selected-tray placement. Fix visual drift; tests alone do not prove a match.
4. Inspect 320px/430px, keyboard operation, long names, empty/all-unranked/no-call/no-photo,
   loading/error states, clearing Meh, and independence of call from rank.
5. Run appropriate checks for implementation changes. Report screenshot coverage and deliberate
   deviations. If screenshots are unavailable, report visual fidelity as unverified.

The archive mock omits a printed EXAMPLE label; its rows are still synthetic mock fixtures.
Production private screens use real data. The signed-out proof must retain its EXAMPLE label.
Later user instructions supersede this reference set; routine implementation needs no separate approval.

## Cabinet finishing pass — October 10

Search and Patterns use the [edition secondary references](taste-cabinet/edition/README.md).
The accepted archive, collection and signature landing compositions remain current.
Search's field uses 12px corners and a butter focus rule. Result filters are labeled
44px capsules; results and pattern recall titles wrap rather than hide personal text.
Empty Search and Patterns share faceless paper artwork, a 28px heading and concise copy,
with a 32px gap and 760px maximum width. At <=680px stack the artwork and copy, use
120 × 104px artwork and 26px headings. Start a collection opens an explicit draft.
No sample content, automatic opinions or inferred scores appear in private pages.
Dialogs, settings and newly mounted selected slips settle over 200ms with a 6px rise.
Reduced motion disables this entrance. Existing capture and call feedback stays finite.
Sharing visibility and destructive confirmations retain factual copy and explicit actions.

## Illustrated landing cabinet — October 10, current signed-out target

The user rejected the signature landing and requested a stronger visual idea. Use
[illustrated landing references](taste-cabinet/landing-cabinet/README.md). This supersedes
only earlier signed-out compositions. Keep the signed-in cabinet edition.
Center `Your taste. A place to keep it.` above signup and three illustrated folder objects.
Use the accepted palette and fonts, maximum 92px heading, 1232px page width, 40px desktop
and 20px mobile insets. Category folders use sage/clay/butter and native starter artwork;
a cream Cold brew / EXAMPLE slip carries the dry Meh reaction. The example labels remain.
Below the hero, a distinct example section contains the existing interactive collection.
Desktop pairs its index with a 340px opinion slip (300px <=900px); <=680px stacks index
then slip. Auth, reversible calls, independent ranks and name-only demo capture remain.

The approved landing topics are Drinks / Midnight snacks / Questionable purchases, with
`For research.` / `Several were necessary.` / `Seemed reasonable.` captions. Keep the cup;
use native snack-bag and shopping-bag illustrations in the existing clay/butter folders.
Long names wrap on phones, as do the labeled demo tabs. These are signed-out examples,
not starter templates or content to insert in private accounts. Demo categories have their
own illustrative items; explicit calls and unranked/no-call creation retain their semantics.
Desktop folder art uses the shared 1.6 ratio to accommodate the added captions within the
first view. Mobile retains the established portrait crop and stagger.

## Personal tools — October 10

Use [personal tools](taste-cabinet/personal-tools/README.md) for the authorized artwork and exercise extension. Keep the cabinet creation columns, scrolling native editors and settings save/draft protection. Artwork is optional: Automatic retains exact-name starter/monogram fallback; explicit Cup/Ticket/Place/Car/Snack/Bag and Sage/Clay/Butter persist per collection. Uploaded private photos show first. Pickers use three equal columns, 8px gaps and 44px labeled controls, with butter selected borders. No sample records are created.

Exercise mode adds ordered sets with required positive integer reps, optional nonnegative weight and explicit kg/lb. Blank weight represents bodyweight. Use a 28px set label, two fluid labeled fields and 44px remove action; 12px gaps desktop, 8px mobile. Add set copies the last draft set; Repeat copies the exercise measurements, resets date to today and clears the note. Existing aggregate fields remain editable and preserved. Sets are persisted, owner-scoped and exported. No call icons, motivational copy or performance scores accompany activity.

## Workout sessions — October 10

Use the [workout references](taste-cabinet/workouts/README.md) for sessions and last-time comparison. Retain the established activity header, recall, native editors and filters. New workout sits above the filters. Session cards use dark canvas, 22px corners, 28px desktop / 22px by 18px mobile padding, 28px/26px headings and factual exercise/set/rep counts. Each card has a readable exercise index, Add exercise and Edit workout. Ungrouped records remain separate. Desktop filters keep a fluid search field and bounded selectors; at <=1180px they reflow into two columns with search spanning both.

A workout is an explicit named/date visit; separate same-day visits are supported. Exercise entries choose an optional workout and follow its date. Editing that date moves all its attached entries. Removing grouping preserves exercises, notes, sets and photos. Previous exercise matching uses trimmed/case-normalized names in the current list, excludes the edited record/current visit/future entries, and respects same-day creation order. Show original units under each corresponding set; copying previous sets explicitly copies their units too, confirming replacement of filled draft sets. Do not invent or convert measurements. Legacy aggregate logs remain readable; no synthetic set rows are inferred from them. Existing records are never grouped automatically.

## Reusable routines — October 10

Use the [routine references](taste-cabinet/workouts/README.md#reusable-routines). Preserve the activity cabinet header, latest recall, native scrolling editors and history filters. Above filters, show saved lineups in a two-column shelf, stacking at <=960px; cards have 22px corners, 24px padding (22px/18px on phones), 28px/26px headings, labeled Start workout/Edit routine and wrapped exercise names. New routine sits alongside ROUTINES. Pending exercise rows reuse the session index with Not logged and Log exercise; no call faces or activity jokes.

Routines store a name and 1–40 unique exercise names in order, with one line per exercise in the editor. Starting a routine explicitly creates a new dated visit and snapshots its lineup, never completed logs, reps, weights or notes. Opening a pending name prefills only exercise identity/workout/date and one blank set; last time remains a reference and copying its measurements remains explicit. Actual completed entries alone supply exercise/set/rep counts. Start clears history filters and reveals/focuses the visit; respect reduced motion. Routine edits/deletion preserve prior visits. Save as routine opens an editable draft of the workout's exercise names. Keep clear validation, owner scoping, exports, draft-discard protection and deletion confirmation.

## Exercise progress — October 10

Use the [exercise progress references](taste-cabinet/workouts/README.md#exercise-history-and-progress). History is a centered native scrolling modal, 840px maximum desktop width and viewport minus 24px on phones, with 22px corners, standard editor insets, 32px/28px headings, labeled 44px measurement choices, cabinet rules and a butter line. Keep a fixed 200px plot and 12px HTML axes/dates for phone readability. Each chart point is an accessible button, with a 44px phone target and a label containing date/value/unit/entry order; selecting it focuses and reveals the corresponding exact set history. Preserve reduced-motion behavior.

The collapsed history directory groups only saved exercise entries within the current activity list, normalizing names as last-time recall does. A set editor can open the same read-only history without losing its draft; nested Close/Escape must not close the editor. Same-day visits remain separate points, ordered by visit creation, then record creation. Each point is one equally spaced logged entry, not a daily average or elapsed-time scale. Total reps is the sum of individual sets; Top weight is their maximum numeric weight. Keep kg/lb separate, without conversion. Null weight is bodyweight, not zero; numeric zero is plotted. Missing units, bodyweight and older aggregate records break weight lines. Legacy measurements remain readable and never generate inferred set rows/rep totals. Show factual empty/one-point states, actual entry/date range, exact sets and preserved notes; no performance scores, activity jokes or synthetic records.

## October 10 product flow extension

Keep the current cabinet edition and workout compositions. Active/finished workout
controls follow [flow references](taste-cabinet/workouts/README.md#active-workout-flow).
Queue status is independent of rank and all four call states (including null). Keep
queue and optional capture-photo controls inside the existing detail areas, and date /
visit filters inside the existing disclosure. Mobile filters stack at <=360px; wider
phones use two columns. Continue 44px targets, native scrolling dialogs, account-only
records and factual workout/draft/offline copy. Intentional integrations are recorded
in [quality checks](../../docs/QUALITY.md).

## Product completion — October 10

Use [settings reference](taste-cabinet/completion/README.md) for the new data screen.
Preserve the cabinet rail, 68px/50px heading scale, rules, dark surfaces and 44px
controls. Backup scope/limits, restore preview and deletion consequences stay visible.
Policies and Help use a public wordmark/back header and readable single column;
functional, privacy and deletion copy is factual. Add policy/help links to both the
landing and signed-in footer without moving the accepted hero or archive composition.

## Plainspoken copy revision — October 10

The user's latest request authorizes removing generic, overly written product copy.
The [voice revision](../../VOICE.md#plainspoken-copy-pass--october-10) supersedes
copy only in the corresponding reference images. Preserve their composition, fonts,
spacing, palette and faces. Landing supporting copy/footer, empty archive helper/footer,
Search helper/no-result title, Patterns helper/empty summaries, creation description
placeholder, Settings subtitle, Help intro and shortcut title have changed deliberately.
No layouts or stored user content change. See [quality checks](../../docs/QUALITY.md).

## Repository polish — October 15

The cabinet composition, fonts and primary palette remain the accepted target.
Small secondary text on cream cards uses `#626456` in place of `#67695b`: the previous
pair measured 4.44:1 against `#eae5d5`, below the 4.5:1 AA threshold. This deliberate
accessibility adjustment preserves the visual hierarchy. Failed active-link lookups
and temporary ranking outages now offer factual retry messages. During link creation,
the Include selector and close actions pause until the snapshot request finishes.

## Everyday simplification — October 28

The user explicitly approved a connected simplification after finding the previous
UI complex. [Everyday references](everyday/README.md) supersede earlier Home,
capture, collection-selection and activity composition rules. Keep the cabinet's
colors, DM Sans / DM Mono, reaction family, 192px desktop rail and 44px targets.
Main headings use 48px desktop / 36px phone, weight 500. Shared controls retain 12px
corners; cream cards and dialogs retain 22px corners.

Home prioritizes search and recent content, including Unfiled; collections and a
compact memory follow. Add always opens a name-first native composer and names its
destination. Outside a current active list the destination is Unfiled, independent
of prior selections. Saving does not imply an experience or an opinion. On phones,
primary navigation and Add stay in a safe-area bottom bar, with content clearance.

Collection capture and a single browse/search/filter row precede actual names.
Secondary collection/entry tools disclose, with keyboard dismissal and usable
focus return. Desktop selection retains a cream slip. Phone selection opens a
native sheet instead of inserting a tall card between rows. Look back contains
Memories and Insights; extra filters and specialized tools disclose. Current
workouts precede routines, progress and past visits. Filtering past history does
not conceal an active workout. No data schema, sharing or export scope changes.

## Unfiled memories — October 28

The user approved keeping optional date, thought and photo before choosing a
collection. This supersedes the preceding revision’s text-only Unfiled scope and
no-schema-change statement. The [Unfiled-memory references](everyday/README.md)
extend Add without altering the default name-only composition. Add details opens
an explicit experience checkbox, its date, note, labeled reaction choices and an
optional photo disclosure. Reaction choices use the existing compact capsule,
with words retained and no repeated face art in the small controls. Native dialogs scroll within the viewport; phone inputs
use 16px text. Keep the cabinet tokens and 44px touch targets.

A date is never inferred from a name, photo or save timestamp. The experience
reaction and overall call remain distinct. An Unfiled find holds one optional
experience and one private photo; filing transfers these atomically to the
collection. Interrupted text/photo saves retain exact retry identities and device
drafts. Migration 0028 and JSON version 11 support this extension; older backups
and clients remain compatible. No paid service, native app or reminder is added.

## Collections directory — October 29

The user approved fixing the directory's hierarchy and sparse layout. The
[directory references](directory/README.md) supersede the earlier directory
composition, leaving the Home shelf, creation flow and collection contents under
their existing references. Use one 48px/36px heading, actual scope counts, New
collection and a quiet New activity action. One toolbar groups Current/Archived
with optional search/order controls. Keep those controls for more than three
collections or an active query/nondefault order; they remain open for that directory visit through
filtering and archive changes, preserving focus when cleared. Section titles are visible only for mixed kinds.

A compact dark card groups a 152px, 1.6-ratio artwork thumbnail, 24px name, 13px
metadata and 12px update caption. Keep 16px padding, 20px gaps and 22px corners.
At <=1180px use one column. Phones use 96px artwork, 14px padding/gaps, 21px names,
18px corners and 16px form inputs. At <=360px the thumbnail is 80px and filters
stack. Preserve readable wrapped names, 44px controls, visible focus, original
private photo framing and actual stored counts. The empty state retains working
starter choices. Unfiled gains a consistent utility icon in the navigation.

`src/directory.css` owns directory styles. Remove superseded directory rules from
historical stylesheets instead of appending another competing skin. Keep public
snapshots, records, ranking, photos, archive state and saved preferences unchanged.

## Shared app polish — October 30

The user requested the directory treatment across Worth. The
[app-wide references](app-polish/README.md) extend the compact working-page scale
to all connected pages. Use 48px desktop / 36px phone titles, weight 500, 1.1 line
height and -0.055em tracking, without inherited narrow title caps. Start content
40px / 24px down and keep 28px / 24px after headers. Preserve existing desktop
44px and phone 20px insets; narrow desktop retains the established 28px inset.
Factual status kickers and return links may add their own readable line.

Use 14px sentence-case functional labels, 15px desktop / 16px phone text fields,
12px control corners and at least 44px ordinary action targets. Keyboard focus
must remain visible on dark and cream surfaces. Section headings are generally
24px desktop / 22px phone; presentation objects retain their specialized scales.
Keep the cabinet palette, original artwork, finite motion and reduced-motion behavior.

Home collection cards group thumbnail and text horizontally on desktop and for a
single collection on phones. Multiple phone collections keep a compact two-column
shelf. Empty invitations use modest artwork. Settings leads with downloads and
restore; export/privacy scope and destructive consequences remain visible.

`src/workspace.css` owns connected page framing and the shared title rhythm.
Screen-specific composition remains in its owning stylesheet, with obsolete
heading rules removed. Import workspace styling after the connected app styles;
the standalone offline entry keeps its own CSS rather than hoisting the working
page styles into a shared entry chunk. Public policy/help and offline titles use
48px/36px under their own headers. Ranked displays, public snapshots and exports
retain their presentation layout. Verify both direct navigation and return to
Home after lazy pages have loaded. No new feature or data schema is part of this pass.

Phone collection, entry and recall menus float above the navigation with 20px
side insets and an 84px plus safe-area bottom clearance. Cap their height at the
smaller of 480px or the available viewport below the header, and scroll internally.
Long saved-view forms must remain usable above the bottom bar; desktop menus stay
anchored. Native dialog/sheet focus and outside/Escape dismissal remain unchanged.
