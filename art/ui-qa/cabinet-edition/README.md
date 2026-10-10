# Worth cabinet edition verification

The user approved the broader art-direction plan. This pass completes the identity sheet,
authored category covers, shared archive/directory artwork, designed empty and sparse states,
live collection creation preview, and the first-use capture journey. Current references are
in [the edition gallery](../../ui-mocks/taste-cabinet/edition/README.md).

References were authored, rendered and inspected before primary-screen implementation. App
screens were captured at 1440 × 900 and 390 × 780, then inspected beside their references.
Mobile captures show the full page. Additional widths: 320, 430, 768, 900 and 1180px.

## Captures

- Empty archive; populated illustrated archive; sparse custom monogram archive.
- Collection creation with a live Books preview.
- Empty collection and the first unranked/no-call item.
- Populated selected collection, directory, and illustrated starter choices.

The identity sheet is a design artifact rather than a production screen. The landing keeps
its accepted signature composition. Its no-call state receives the same faceless paper art.

## Interaction and data checks

Browser-only route fixtures simulate creation and call updates. No fixture records were
written to a database or production account. Read-only local sign-in uses the test auth service.
The flow verifies empty archive → explicit collection creation → focused capture → first item
→ reversible Meh → sparse archive. Name-only items remain unranked and undecided. Name ideas
fill only the name; personal descriptions and selected covers survive name changes. Cover
uploads retain precedence over built-in category artwork. Draft confirmation still allows
keeping or discarding unsaved edits. Activity creation keeps its separate log flow.

All 31 existing tests passed, including privacy, ownership, migration, ranking, photo and
call checks. TypeScript and the production build passed. Browser checks found no page errors
or horizontal overflow; reduced motion keeps shelf artwork still. `qa-result.json` records
the interaction checks.

## Deliberate changes and expected differences

- Authored SVG category objects replace photographic starter art for exact named starters.
- Other names use decorative layered monograms; they do not imply a rank or personal call.
- Empty archive receives a composed cream brand illustration and a concise first-use sequence.
- Empty collection uses faceless slips and an Add a name action; its irrelevant browse toolbar
  is omitted until it has items. A zero ranked count is omitted from the collection header.
- Selected row rank/dash receives a butter capsule. Undecided opinion cards use tonal blank
  slips instead of a face. All three call labels and the separate null state remain intact.
- Creation gets a live cover preview, name-only suggestions, preserved optional fields and
  focused capture after saving. Directory and starter choices share the archive cover object.

Fixture titles, counts, timestamps and navigation/account icons differ from the simplified
static references. Actual account data controls every private screen. The browser capture
of the first item includes its real interaction confirmation; the resting no-call mock uses
a populated list to show rank and call independence. Working directory search/order controls
remain available even where the static composition simplifies them. These are documented
content/affordance differences, not substitutions of layout or palette.
