# Collections directory verification — October 30, 2026

The user asked to fix the sparse Collections page shown in their screenshot.
The [new references](../../ui-mocks/directory/README.md) were authored, rendered
and inspected before implementation. The [current contract](../../ui-mocks/BUILD-CONTRACT.md#collections-directory--october-29)
supersedes the older directory composition. All captures use synthetic browser
fixtures, never private account data.

| State                    | Desktop                           | Phone                           |
| ------------------------ | --------------------------------- | ------------------------------- |
| One collection           | [Capture](sparse-desktop.png)     | [Capture](sparse-phone.png)     |
| Collections and activity | [Capture](populated-desktop.png)  | [Capture](populated-phone.png)  |
| Archived collection      | [Capture](archived-desktop.png)   | [Capture](archived-phone.png)   |
| Long names               | [Capture](long-names-desktop.png) | [Capture](long-names-phone.png) |
| Empty account            | [Capture](empty-desktop.png)      | [Capture](empty-phone.png)      |

Desktop is 1440 × 900; phone is 390 × 780. Captures show the actual viewport,
including the fixed phone navigation. Content continues with clearance below it.

## Visual review

The sparse and populated captures were opened and compared with the references.
One factual header and a toolbar replace the repeated horizontal sections. Compact
cards group artwork, name, counts and update time, with the first card visible
above phone navigation. The larger directory uses two desktop columns and one on
narrower screens. Names and descriptions wrap. Original private-cover framing and
artwork precedence remain; no uploaded image or stored record is altered.

Deliberate differences:

- Production retains actual icons, account links, private-cover actions, loading,
  error/retry controls and existing cabinet button typography.
- Empty accounts retain the working category starters rather than the prototype's
  generic empty invitation. Selecting one still opens an unsaved creation draft.
- Archived collections keep the factual unarchive instruction. Counts, dates,
  names and optional descriptions come from real data; fixture values may differ
  from the prototype.
- Search/order controls stay open for the directory visit once needed. Clearing a
  filter does not shift the toolbar or lose focus. Search text is tab memory and
  clears on reload; only the existing order preference persists. The shorter
  Latest updates label preserves the same recently-updated order and fits phones.
- Unfiled uses a utility icon aligned with the other navigation links.

## Checks

The production build/type checks, lint, unused-code checks and formatting passed.
No dependency or database changes were made.

All 39 affected Chromium desktop/phone cases passed: directory behavior, archive
and unarchive, existing everyday flows and responsive checks across Home,
Collections, collection contents, activity, settings, search, recall and landing.
All eight directory/archive cases passed in touch-enabled phone WebKit. After the
final typography correction, all eight directory cases and four WebKit directory
cases passed again; the final concise sort label was also recaptured and checked
on both Chromium viewports and phone WebKit.

Coverage includes keyboard opening of the entire card, no writes during browsing,
search and ordering across navigation, private search clearing on reload, archived
source changes, clear-search focus, stable ordering focus, empty-account creation,
long unbroken names and activity names. Reflow covers 320, 390, 430, 768 and 1440px.
Automated accessibility checks cover sparse and populated directories. The initial
local run was interrupted by a long pause and discarded; the complete sequential
rerun passed with the original assertions, timeouts and retry policy.

Directory styles now have one owner, `src/directory.css`; superseded directory
selectors were removed from five historical stylesheets. Shared starter artwork,
creation styling and other pages' rules remain. The responsive regression covers
those adjoining compositions after the cleanup.

This is browser automation and screenshot review. A physical phone, software
keyboard, spoken screen-reader output and independent usability observation were
not tested.
