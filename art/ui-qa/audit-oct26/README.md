# Worth review — October 26, 2026

This pass starts from `57f2782` on main. It preserves the approved taste-cabinet
composition and data behavior. It is a dated review record, not a guarantee that
all future states or physical devices are verified.

## Changes and review boundaries

- Mobile navigation closes on Escape, leaving the rail, or switching to desktop.
  Escape returns focus to its toggle; closing an Add dialog opened from the
  disclosure also restores a visible control. Add and Shortcuts dialogs have names.
- Share records its opener before showing the native dialog, preserving focus
  return after pointer activation in Safari as well as Chromium.
- A keyboard-only skip link reaches the current main content. Core directories
  identify their browser tabs, including collection/activity directory scopes.
- Calendar day/count text has explicit separators so its visible text matches
  the accessible label. The date/count layout remains unchanged.
- Completed rest timers stop polling; malformed stored deadlines do not become
  infinite countdowns or false completion messages.
- The six dependency advisories found at baseline are addressed. Zod 4 migration
  preserves omitted patch fields, fully parsed nested defaults, unfinished drafts,
  photo/capsule refinements and backup relationships. No migration or data reset
  is needed. A narrow Undici override supplies the compatible security patch still
  missing from the Cloudflare Vite plugin’s transitive dependency. The validator
  upgrade addresses [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5);
  migration behavior follows the [Zod migration guide](https://zod.dev/v4/changelog).
- CI actions use verified upstream commit pins; security updates are grouped.
  The existing core/two-shard/deploy structure remains. Routine browser runs no
  longer overwrite historical capsule, offline or private-space screenshots;
  optional capture flags retain the visual-review path.
- README, contributing, architecture, release and deployment guidance now describe
  the direct-main workflow. [Quality](../../../docs/QUALITY.md) records the visitor
  journeys, commands, fixture boundaries and external checks.

## Visual evidence

Reference: the current [build contract](../../ui-mocks/BUILD-CONTRACT.md),
[cabinet edition](../../ui-mocks/taste-cabinet/edition/README.md) and
[calendar review](../activity-calendar/README.md). The keyboard skip link is an
intentional focus-only addition; it does not alter the resting composition.
Account names, dates, record counts and demonstration artwork vary with fixtures.

Captures use synthetic intercepted APIs and the production build, with no private
production account or record writes. Conditions: macOS, Node 22.22.2, pnpm 9.15.0,
Playwright 1.64.1; desktop Chromium and touch-enabled WebKit. Primary viewports are
1440 × 900 and 390 × 780; 320, 430 and 768px check reflow. Reduced motion is enabled
for reproducible responsive captures.

| Screen                          | Desktop                           | Phone                            |
| ------------------------------- | --------------------------------- | -------------------------------- |
| Collection and selected opinion | [Capture](collection-desktop.png) | [Capture](collection-mobile.png) |
| Calendar                        | [Capture](calendar-desktop.png)   | Responsive browser checks        |
| Settings                        | Responsive browser checks         | [Capture](settings-mobile.png)   |

The collection retains the reference’s rail, title scale, capture/list column and
cream slip. Existing Want to try, saved views, selection and Workbench controls
remain functional additions from the integrated web expansion. The calendar’s
new text separators preserve its rendered layout. Settings retains its factual
data, recovery and deletion disclosures.

## Verification

- Core: 255 tests across 56 files passed, including isolated real-D1 migrations,
  owner checks, record/backup round trips and new sparse-patch/timer regressions.
  Dependency audit, formatting, lint, unused-code detection, types and build passed.
- The complete local browser run passed 334 cases and exposed the calendar label
  mismatch in two cases. Both passed after correction, along with the navigation,
  sharing and responsive cases in the final focused run (35 passed). One existing duplicate
  phone width-matrix case is intentionally skipped; desktop runs that width matrix.
- All 15 supplemental touch-enabled WebKit journeys passed after the Safari focus
  correction. WebKit’s keyboard test uses Option+Tab to include links, matching
  Safari’s default keyboard-navigation behavior; the Chromium test uses Tab.
- The new navigation, sparse-patch and rest-timer tests were observed failing
  before their fixes. Updated Axe checks reproduced the calendar label finding;
  the corrected DOM passes the same rule without excluding it.
- CI also exposed a subpixel touch-target measurement during the confirmation
  entrance. The check now waits for the settled dialog and reads its native DOM
  rectangle, retaining the strict 44px minimum. All 40 repeated desktop/phone
  cases passed after the correction.
- Current root/documentation links were checked: no missing local targets.
  Historical QA images stay unchanged during ordinary browser checks.
- GitHub inspection found main’s linear-history/admin safeguards active, with
  force pushes and deletion blocked and direct commits allowed. Private reporting,
  dependency/security updates, CodeQL and secret scanning are enabled. No open
  code-scanning, dependency or secret findings were shown during inspection.

Post-push CI, scanning and automatic release must be checked for the actual commit;
local results do not establish those outcomes in advance. No manual deployment,
new workflow or browser-status job is added by this pass.

## External limits

Browser emulation does not establish physical iPhone/Android behavior, spoken
VoiceOver/TalkBack output, a real native share sheet, fresh-visitor usability,
production account recovery or provider alert/recovery delivery. The review uses
no paid recognition service, native companion, production data write or manual deploy.
