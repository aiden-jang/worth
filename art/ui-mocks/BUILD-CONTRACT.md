# Worth visual build contract

## October 10 taste cabinet — current target

User direction: stronger identity, cute dry humor, nonchalance, clean polish and fidelity between
mocks and implementation. Read [taste-cabinet/README.md](taste-cabinet/README.md), open each named
reference, and compare with [working captures](../ui-qa/taste-cabinet/README.md).
The history below does not override this section.

- Canvas `#181915`, panel `#20211c`, raised `#292a23`; text `#f0ecdf`, secondary `#aaa99b`.
- Butter `#e8dc9d` primary action with dark text; cream `#eae5d5` opinion slips / rank picks.
- Flat fills, 7px controls, 10px slips/images, no texture, gradients or glossy effects.
- Existing DM Sans and DM Mono. Desktop rail 192px. Page width max 1200px with 44px desktop insets.
- Signed-in title 68px; collection mobile 50px, archive mobile 44px. Item names 20px.
- Landing headline max 104px; mobile responsive 55–82px. `For the good. And the meh.`
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
See [cute pass captures](../ui-qa/cute-pass/README.md) for desktop/mobile verification.

## History

## October 9 personality refinement — historical override

The user requests more fun, dry humor, nonchalance, and a clean, polished, tasteful UI.
Use [personality-refinement](../ui-qa/personality-refinement/README.md) as the current reference.
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

The user's latest request prioritizes **overall polish and coherence**. Use the exact working
screens in [product-refinement](../ui-qa/product-refinement/README.md) as the current composition.
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

## Historical generated references and viewports

| Screen             | Reference                                                          | Saved image | Comparison viewport |
| ------------------ | ------------------------------------------------------------------ | ----------- | ------------------- |
| Desktop landing    | [worth-landing-desktop-v3.png](worth-landing-desktop-v3.png)       | 1586 × 992  | 1440 × 900          |
| Mobile landing     | [worth-landing-mobile-v3.png](worth-landing-mobile-v3.png)         | 887 × 1774  | 390 × 780           |
| Archive home       | [worth-archive-home-v6.png](worth-archive-home-v6.png)             | 1586 × 992  | 1440 × 900          |
| Desktop collection | [worth-collection-desktop-v5.png](worth-collection-desktop-v5.png) | 1586 × 992  | 1440 × 900          |
| Mobile collection  | [worth-collection-mobile-v5.png](worth-collection-mobile-v5.png)   | 887 × 1774  | 390 × 780           |

Normalize references proportionally. Do not stretch them. Also inspect mobile at 320px and
430px for wrapping, readable labels, and overflow.

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
