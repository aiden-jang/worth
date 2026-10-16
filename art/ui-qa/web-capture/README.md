# Web capture and private shortcuts — October 16

These secondary pages deliberately extend the current [cabinet contract](../../ui-mocks/BUILD-CONTRACT.md),
[creation reference](../../ui-mocks/taste-cabinet/personal-tools/README.md) and
[ranked display](../taste-cabinet/ranked-list-mobile.png). They retain the dark
canvas, cabinet rail, DM fonts, 68px/50px page headings, butter actions and cream
review/rank panels. Capture uses one form column, with a side-by-side review above
960px and a stacked review below it. The content column is bounded for readability.
Bookmark instructions stay in a disclosure so saved records appear sooner.
Account recovery deliberately removes the old navigation/data and uses a compact
error heading with a focused announcement and one reload action.

| State                      | Desktop, 1440 × 900                            | Phone, 390 × 780                             |
| -------------------------- | ---------------------------------------------- | -------------------------------------------- |
| Editable draft             | [Draft](draft-desktop.png)                     | [Draft](draft-phone.png)                     |
| Destination/content review | [Review](review-desktop.png)                   | [Review](review-phone.png)                   |
| Sign-in handoff            | [Sign in](sign-in-desktop.png)                 | [Sign in](sign-in-phone.png)                 |
| Chosen saved order         | [Shortlist](shortlist-desktop.png)             | [Shortlist](shortlist-phone.png)             |
| Saved-find result          | [Find](find-desktop.png)                       | [Find](find-phone.png)                       |
| Account-switch recovery    | [Changed account](account-changed-desktop.png) | [Changed account](account-changed-phone.png) |

All captures are synthetic browser fixtures, not production records. Scrolled
captures use natural page positions. Review focus moves to its labeled region;
Back to draft returns to the name. Buttons, selects, summaries and checkboxes have
usable touch areas. Reduced motion, Axe and 320/430/768px reflow are covered.
Visual review caught an inherited three-column form rule; it was replaced with a
single form column. An explicit hover check caught/fixed butter text on the cream
Back to draft action; hover/focus states now retain readable ink.

The full browser regression passed 129 journeys. Eighteen cover incoming share
review, no automatic save, account/destination clarity, duplicate approval,
immutable retry recovery, clean sign-in return, draft replacement/cancellation,
offline draft limits, private shortlist/find semantics, unavailable destinations,
narrow widths, remembered account choices, expired shares/blocked storage and a
live account change. The shared request binding and Worker mismatch check have
unit and real D1 read/write coverage; all 117 core tests passed.

Actual OS Share menu registration, installed-app shortcut menus and bookmarklet
execution on arbitrary third-party pages have not been device-tested. Their
availability varies by browser; manual paste, authenticated website navigation
and ordinary bookmark URLs are the fallback. No universal platform support,
full offline archive, native app, remote CI run or deployment is claimed.
