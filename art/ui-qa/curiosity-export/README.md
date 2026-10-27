# Curiosity and exports — October 27

The user asked for a fun place to keep memories and preferences, with very little
logging work, and for JSON or Excel downloads.

## Reference and deliberate changes

Reviewed `DESIGN.md`, `VOICE.md`, the current taste-cabinet README and build
contract, then opened the archive desktop and mobile references. The signed-in
dark canvas, cabinet navigation, type, cream slips and 44px controls remain.

- The archive's monthly slip now leads with an actual dated entry rather than a
  large count. Its original note, place, date and saved reaction stay distinct.
- Pull a memory is an explicit, read-only rummage through saved names and dated
  entries. It reaches beyond the first page, avoids an immediate repeat when
  another record is available, and links back to the source. Saved dates say UTC
  and are never presented as visits. Sparse entries need no invented reaction.
- A short heading reveal respects reduced motion. The button keeps keyboard
  focus through loading and subsequent draws; failures keep the last memory.
- Settings keeps its existing secondary layout. Its download labels distinguish
  JSON, Excel and photo backups. Excel is readable core data; JSON remains the
  format for restoring Worth. No logging fields, quotas or streaks were added.

## Captures

Synthetic intercepted APIs against the production build, with reduced motion.
Desktop is 1440 × 900; phone is 390 × 780. These are natural full-page captures.
Private production data was not used or changed.

- [Memory draw, desktop](memory-draw-desktop.png) / [phone](memory-draw-phone.png)
- [Download options, desktop](export-options-desktop.png) / [phone](export-options-phone.png)

The existing opt-in `WORTH_FUN_QA` hook in `e2e/curiosity.spec.ts` makes the captures.
Routine CI writes no review images. Reflow assertions also cover 320, 430 and
768px. Both affected pages were inspected beside the cabinet references. Physical
phones, software keyboards and spoken screen readers remain manual checks.

## Workbook review

The actual browser-downloaded synthetic workbook was opened independently with
openpyxl and imported, inspected and rendered with Artifact Tool. Neither reader
modified or re-exported it. All nine worksheets were inspected. After compacting
empty context and making absent routine targets blank, the five affected or
expanded previews were refreshed and reviewed.

- [Saved things](workbook-saved-things.png): original names and calls, compact rows.
- [Exercise sets](workbook-exercise-sets.png): separate rows, original units, zero
  weight distinct from blank. The preview renderer displays booleans as 0/1;
  independent reading confirmed native boolean cell types.
- [About](workbook-about.png): scope, backup and date semantics.

The reader checks also confirmed literal formula-looking text, typed dates,
visit reactions distinct from overall calls, planned targets separate from
actual sets, frozen headers, filters and no formulas/macros/external workbook
links. Native Excel desktop was not available for a direct application test.
The synthetic workbook and scratch review scripts are not repository fixtures.

## Verification

Core checks passed dependency audit, formatting, lint, unused-code analysis,
263 tests across 57 files and the production build. After the workbook readability
adjustment, its two unit tests and the production build passed again.

The affected Chromium desktop/phone journeys passed 38 cases. All six new
desktop/phone cases passed again against the final build, including real JSON
and Excel downloads. Four touch-enabled WebKit journeys passed on that build.
Checks cover full-pool memory paging, source links, saved-only/empty/error states,
stable keyboard focus, no archive writes, narrow reflow and accessibility. No
assertions, timeouts or retry settings were relaxed.
