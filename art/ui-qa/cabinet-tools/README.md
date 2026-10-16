# Collection workbench and artwork

The collection's existing cabinet composition stays in place. Workbench is a
secondary header action that opens a dark, native scrolling dialog. It uses the
accepted fonts, palette, cream records, 22px corners and labeled 44px controls.
Saved views are folded into a disclosure below capture instead of a permanent
filter row. These are deliberate additions to the existing collection reference.

## Captures

Synthetic intercepted API records only; no production account was populated.
Desktop is 1440 × 900 and phone is 390 × 780. Phone captures show a viewport of
the scrolling dialog. Artwork extends the existing picker and its three tones;
the four new objects are authored SVGs, with private covers still taking priority.

| State            | Desktop                           | Phone                           |
| ---------------- | --------------------------------- | ------------------------------- |
| Sandbox          | [Capture](sandbox-desktop.png)    | [Capture](sandbox-phone.png)    |
| Comparison table | [Capture](comparison-desktop.png) | [Capture](comparison-phone.png) |
| Draw             | [Capture](draw-desktop.png)       | [Capture](draw-phone.png)       |
| Artwork          | [Capture](artwork-desktop.png)    | [Capture](artwork-phone.png)    |

Visual review caught browser-default grey button fills, structural mono labels in
new controls, an unsettled draw animation and an old cover image still loading.
The revised captures use explicit cabinet button surfaces, readable field labels,
settled motion and decoded artwork. Pointer draws reveal their result on phones;
keyboard activation preserves focus. Reduced motion skips the draw/filing motion.

## Verification

- Pure comparisons finish in the preferred order without mutating source arrays;
  Skip and saved prior states support Undo. Stale draft IDs are removed.
- Real D1 tests exercise owner/revision boundaries, foreign-item rejection, saved
  filter/context persistence, Trash filtering and remapped backup restoration.
- Desktop/phone journeys cover local draft reload, apply preview, conflict refresh,
  blind reveal/Undo/Skip, saved views/context orders, comparison notes, drawing and
  artwork. Existing browser journeys run alongside these additions.
- Axe WCAG 2 A/AA and 2.1 AA cover the comparison table. Dialog overflow is checked
  at 320, 390, 430, 768 and 1440px; the existing responsive suite checks full pages.

Completed local check totals are recorded in the expansion tracker. These captures
verify this feature group, not the larger pending feature list or production auth.
