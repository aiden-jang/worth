# Everyday memory and progress — October 27

This pass develops Worth's everyday product flows: record an experience, find it
again, read the evidence behind a preference, and compare actual exercise results.
The implementation uses the existing cabinet design, storage and private photos.

## Visual review

References inspected before implementation:

- Taste cabinet collection mobile and Patterns desktop.
- Workout exercise-progress mobile.
- October 26 collection capture and earlier exercise-history captures for context.

Deliberate extensions to those references:

- Collection name-only capture stays first; Want to try remains beside that flow.
  A separate Log an experience action opens a dated, retry-safe composer. Only
  identity/date/reaction are shown initially; optional context opens on demand.
- Mobile selected slips use a smaller character alongside the call. Desktop and
  landing opinion cards retain their existing scale and composition.
- Patterns leads with evidence-backed preference groups, retaining its original
  statistics and cream call breakdown below. Collection groups include untagged
  experiences, while optional types/labels add detail. Remember, Look back and Calendar
  remain visible; other optional tools move into More tools.
- Remember uses the cabinet heading, native inputs, dark timeline, factual visit
  reactions and original photos. Date/archive filters open when requested or
  selected by a link. Selected tabs retain readable text while hovered.
- Archive adds one cream current-month keepsake derived from actual dated entries.
- Exercise history retains its modal, fixed-height chart and exact-set index;
  period, volume and rep-record controls extend it. Weekly finished-session counts
  are a separate collapsed panel in Activity.

Captures use synthetic, intercepted APIs against the production build. The
preference numbers illustrate a test archive; they are not the owner's data.
Desktop is 1440 × 900 and phone 390 × 780, with natural page captures where useful.
Open modals use viewport captures. The reflow matrix also checks 320, 430 and
768px (900px height). Reduced motion is enabled for the substantive journey images.
`WORTH_MEMORY_QA` is opt-in and routine CI does not write these images.

## Selected captures

- [Preferences, desktop](preferences-desktop.png) / [phone](preferences-phone.png)
- [Remember, phone](remember-phone.png)
- [Quick dated capture, phone](experience-quick-phone.png)
- [Compact collection, phone](collection-compact-phone.png)
- [Exercise progress, phone](workout-history-phone.png)
- [Monthly memory, phone](monthly-memory-phone.png)

## Behavior and verification

The complete local browser run passed 346 cases with one existing intentional
phone width-matrix skip. The final refinement passed 18 focused Chromium cases
and nine touch-enabled WebKit cases. Core checks passed 260 unit/component/API
cases; the four final database cases (including the added resurfacing case) passed
after separating overall and visit preferences. Two further D1 checks and both
desktop/phone evidence-link cases passed for the untagged collection refinement.
Formatting, lint, unused-code,
TypeScript, dependency audit and production builds passed.

The database checks exercise atomic new-name/visit saves, fixed retries, changed
retry rejection, owner/list isolation, actual dates, literal wildcard search,
pagination, archive/Trash scope, merged history, rated-only denominators, labels,
separate visit reactions and resurfacing only explicitly visited old favorites.

Exercise checks preserve units, zero, missing/bodyweight gaps and legacy logs.
They verify complete weighted volume, exact rep-count records and higher reps at
an already recorded weight without estimating a lift or a fitness score.

Browser journeys cover lost replies across reload, unchanged overall calls,
return focus, evidence links, filters, invalid periods, five-width reflow, monthly
memories, workout counts, volume and rep records, plus automated accessibility.
The broader existing suite checks capture, ranking, sharing, backups, Trash,
offline, routines, private tools and account boundaries. No CI workflow or job is
added; production deployment remains the existing automatic main workflow.

Earlier local iterations found and corrected optional-field overload, selected
hover contrast, duplicate unnamed landmarks and native-looking record buttons.
A supplemental WebKit title check encountered the app's loading screen under
concurrent full-suite load; all nine supplemental cases passed without that
contention. No
assertions, retries or timeouts were relaxed.

Physical phones, spoken VoiceOver/TalkBack, fresh-person observation and real
long-term diary use remain manual. This pass establishes the implemented flows,
not predictive accuracy or a claim that the app knows an unrecorded preference.

Behavior and data limitations: [Remember and progress](../../../docs/REMEMBER.md).
