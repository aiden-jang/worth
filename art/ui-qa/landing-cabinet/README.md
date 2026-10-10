# Illustrated landing verification

The user rejected the signature landing and requested a stronger visual idea. This pass
creates a centered introduction, three staggered illustrated folder objects and a small
labeled example Meh slip. It moves the working demo into its own section below the hero.
The private cabinet screens retain their accepted layouts.

The [new reference](../../ui-mocks/taste-cabinet/landing-cabinet/README.md) was authored and
opened before changing the primary screen. Desktop 1440 × 900 and mobile 390 × 780
full-page captures were inspected beside the mock. Folder sizes, stagger, headline,
spacing, palette and example order match. The real app retains functional auth links,
button SVG arrows and the existing product footer; static mocks simplify those details.

TypeScript, production build and the three relevant personal-call/starter-art tests passed.
Browser checks cover the example anchor, category changes, reversible calls, name-only
unranked/no-call capture, transient edits, keyboard focus and reduced motion. Additional
widths are 320, 430, 768, 900 and 1180px. Only a fixture GET /api/me is allowed: no demo
records, private data or API writes enter the production archive. Details: `qa-result.json`.

The deliberate changes are the centered hero, illustrated collection folders and smaller
hero opinion sample. The desktop demo has a 340px slip; mobile now shows the index first
and reveals the changed opinion after pointer selection. Auth flows, call semantics,
ranking independence and existing demo state behavior remain intact.
