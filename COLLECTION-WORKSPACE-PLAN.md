# Collection workspace redesign

## Goal

Turn a collection from a form-heavy management screen into a quiet personal catalog. The fastest useful interaction remains:

**add a name → optionally rank it → leave.**

The reference is the approved `Places` mock in `art/ui-mocks/` workflow: a dark editorial workspace with a single quick-capture field, a ranked index, and controls that appear only for the selected item.

This is a visual and interaction redesign of collection pages. It does **not** change the ranking model, introduce star ratings, or require people to fill in notes, types, dates, photos, or revisit details.

## Product rules

- Rank order remains the comparison tool.
- The existing choices remain: **Favorite**, **Would not again**, or no decision.
- An item can be saved with a title alone.
- Extra context is progressive disclosure, never a prerequisite.
- One item is active at a time. The selected row exposes actions; the rest stay visually quiet.
- There are no dashboard cards, decorative imagery, fake activity, or new lifestyle art in signed-in collection screens.
- Desktop and mobile must support the same low-effort capture path.

## Current-state assessment

The current `CollectionView` already has the right underlying capabilities: list-level ranking, decisions, item creation, search, filters, photos, notes, history, and three view modes. Its current surface is too management-oriented:

- It asks the user to choose between Gallery, List, and Compact before they have a reason to.
- Search, type, rank, decision, and sort controls compete with the list itself.
- Rank is expressed as a select input in every row.
- The ranking summary is visually detached from the actual index.
- Item actions require leaving the list for an editor, even for a simple personal call.

The redesign should reuse existing APIs and mutations where possible. New server work should be deferred unless an interaction cannot be made reliable with the current item and rank endpoints.

## Information architecture

### Collection page default

1. **Collection identity** — name, optional one-line description, item count.
2. **Quick capture** — one prominent title field and one `Keep it` action. Helper copy: `Rank it later if you want.`
3. **Index** — one ordered, rank-first list; unranked items live in a clear lower section rather than pretending to have a rank.
4. **Selection tray** — expands directly below the selected row with Favorite, Would not again, Add a note, Log revisit, and Open details.
5. **Quiet browse rail** — All, Kept, Revisited, Not opened lately. Search and advanced filtering live behind a single `Filter` affordance.

The old gallery, list, and compact chooser is removed from the default workflow. Photo-forward browsing can return later as an explicit secondary view only if actual private photos make it valuable.

### Item detail

Opening `Open details` keeps the existing full editor for rich context. It remains the home for dates, types, photos, visit history, and deletion. The collection index does not become a full editor.

### Mobile

- Capture field and `Keep it` stack or stay in a fixed-height two-part row.
- The rail becomes a horizontal filter strip.
- A selected row opens a vertically stacked action tray.
- Rank control is touch-friendly and never a dense select in each row.

## Interaction design

### Capture

- Focus the title field from the collection page with a keyboard shortcut only after visible UI is complete.
- Submitting creates the item and returns focus to the field, ready for another name.
- The newly created row receives a brief, restrained rust state and is selected.
- No modal is required for title-only capture.

### Selecting an item

- Clicking a row selects it in place without navigating away.
- Selected state uses a rust hairline and a subtle darker surface, not a filled card grid.
- The tray contains decisions and light actions. Actions save immediately and announce success accessibly.
- Choosing a decision remains reversible: selecting the active decision again clears it.

### Ranking

Phase one retains the current rank endpoint and exposes rank through a deliberate `Place in ranking` interaction inside the selection tray.

- Ranked rows show a stable ordinal (`01`, `02`, and so on).
- Unranked rows show an em dash and appear after ranked items.
- Do not introduce star scores.
- Do not implement drag-and-drop until keyboard access, touch behavior, conflicts, and optimistic recovery are designed. A position chooser is acceptable for the first release if it is only shown for the selected item.

### Browsing

- **All**: every item, ranked first.
- **Kept**: Favorites only.
- **Revisited**: items with more than one log or revisit history.
- **Not opened lately**: items with stale/no recent logs, with exact behavior defined before implementation.
- Advanced filters (type, custom date, text search, sort) remain available but collapsed by default.

## Visual system

Use the existing Worth tokens and refine them rather than introducing a separate theme:

- near-black warm surface;
- warm ivory type;
- muted secondary text;
- thin, precise rules;
- muted rust only for selection, the capture action, and meaningful state;
- mostly square corners;
- large but restrained names in the index;
- generous vertical breathing room;
- no display-serif dependency, glossy cards, gradients, photography, or decorative panels.

The mock’s editorial feeling should come from hierarchy, whitespace, and row behavior—not from fake data or ornament.

## Implementation phases

### Phase 0 — lock the interaction contract

- Store this plan with the mock reference in the repository.
- Confirm exact labels and the definition of `Not opened lately`.
- Audit existing APIs to map: create item, update decision, update note, log revisit, rank, and item detail.
- Define keyboard behavior and mobile acceptance criteria before replacing UI.

**Done when:** no data-model change is assumed and the primary flow is written/testable.

### Phase 1 — collection shell and quick capture

- Replace the view switcher and always-visible filter cluster with the collection identity, quick capture, index header, and quiet browse rail.
- Add title-only capture directly in `CollectionView`; reuse the existing item creation path or extract a shared mutation.
- Preserve the current dedicated item editor as a fallback for richer creation.
- Make the default index rank-first with a separate unranked grouping.
- Build responsive layout and empty/loading/error states.

**Done when:** someone can add multiple names without leaving the page, and can see where ranked and unranked items belong.

### Phase 2 — selected-row action tray

- Add one controlled selected-item state to `CollectionView`.
- Render the inline action tray only for that row.
- Wire Favorite and Would not again to the existing update path; make decisions reversible.
- Provide Add a note, Log revisit, and Open details routes/actions without duplicating the rich editor.
- Add focus management and clear status feedback after mutations.

**Done when:** a person can make a simple decision or start a revisit from the index without navigating to a form first.

### Phase 3 — deliberate ranking interaction

- Move the rank selector out of every list row and into the selected row tray.
- Use ordinals as the default display.
- Retain current conflict recovery and show an unobtrusive status if another tab changed the order.
- Add keyboard-accessible position controls; evaluate drag-and-drop only after this interaction is proven.

**Done when:** ranking is visible and easy, but never looks like required data entry.

### Phase 4 — browse modes and advanced tools

- Implement All, Kept, Revisited, and Not opened lately from real record data.
- Keep search and type/sort controls behind a compact `Filter`/`Search` disclosure.
- Ensure zero-state copy explains why a filtered view is empty and offers a clear return to All.

**Done when:** casual browsing is one click; detailed searching remains possible without dominating the screen.

### Phase 5 — mobile and quality pass

- Test 320px through desktop widths.
- Ensure capture, selection, decision state, rank placement, and detail opening work by keyboard and touch.
- Add/update component tests for title-only capture, decision toggling, ranking, browse filters, and non-destructive failure states.
- Run typecheck, full tests, build, and manual visual review with empty, small, large, all-unranked, and photo-free collections.

**Done when:** mobile is not a compressed desktop table and every primary state is calm with sparse data.

## Deferred explicitly

- Five-star ratings.
- Social mechanics, public feeds, prompts, streaks, recommendations, or engagement metrics.
- Any generated artwork or imagery in the signed-in workspace.
- Drag-and-drop ranking before accessibility and conflict handling are designed.
- A separate gallery mode unless real private-photo use demonstrates a need.
- Changing the collection data model merely to resemble the mock.

## Acceptance checklist

- A new item can be captured with only a name.
- Ranking is optional and still legible in the main index.
- Favorite / Would not again are optional, reversible, and visually distinct from rank.
- Selected-row actions do not force a full-screen editor.
- Advanced controls do not overwhelm first-time or casual use.
- All data shown is real user data; blank states stay useful.
- The screen reads as a private catalog, not a generic task app or a lifestyle feed.
