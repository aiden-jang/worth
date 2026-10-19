# Activity calendar verification

Patterns → Activity calendar adds a secondary cabinet page for saved plans and
entered log dates. It retains the dark palette, 192px rail, 68/44px headings,
DM Sans, ruled rows and 44px targets. Desktop dates form a seven-column ordered
list; phones use full-width dated rows instead of squeezing seven small targets.
The same readable selected-day agenda works at either size.

| State                               | Desktop                        | Phone                      |
| ----------------------------------- | ------------------------------ | -------------------------- |
| Page and controls                   | [Desktop](month-desktop.png)   | [Phone](month-phone.png)   |
| Month days                          | [Desktop](days-desktop.png)    | [Phone](days-phone.png)    |
| Selected-day agenda                 | [Desktop](agenda-desktop.png)  | [Phone](agenda-phone.png)  |
| Revisit date and snooze             | [Desktop](snooze-desktop.png)  | [Phone](snooze-phone.png)  |
| Failed refresh and retained entries | [Desktop](failure-desktop.png) | [Phone](failure-phone.png) |

The first visual review found that selecting an early phone date left the agenda
below the whole month. Day selection now moves keyboard focus and scrolls to the
loaded agenda. Choose another day returns directly to the month. A shorter header
keeps the cabinet's title rhythm. Failed refresh feedback appears beside the day
controls, with an explicit label for retained entries and a retry action. Page
counts explain 50-entry pagination without hiding the complete day counts.

All 162 core tests across 40 files passed with one worker. Real D1 checks cover
owned plans, original/snoozed dates, actual visits and activity logs, complete
counts with stable pagination, archive/Trash, Inbox filing without duplication,
and record-backup restoration with fresh IDs. Old contexts default to no plan.
Calls, ranks and the manual revisit queue stay independent.

All 12 focused calendar/context browser journeys passed, covering ordinary saves,
context conflicts and recovered drafts. Six calendar journeys then passed after
focus/retry changes. Axe and long-name reflow checks cover 320/430/768px widths.
All six final journeys passed again against the completed build, including
return navigation and an in-viewport refresh error. All ten final captures were
visually inspected beside the cabinet/context references. Formatting, lint,
unused-code checks, TypeScript and the production build passed.
These captures contain synthetic fixtures, with no native app, real-phone,
deployment or remote CI claim. The larger feature scope remains in the expansion
tracker.
