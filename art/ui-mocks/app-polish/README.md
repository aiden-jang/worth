# App-wide composition — October 30

The user asked for the compact directory treatment throughout Worth. A fresh
capture audit covered 29 routes at 1440 × 900 and 390 × 780 before these references
were authored. The HTML and these eight desktop/phone pairs were rendered and
opened before implementation. All content is synthetic; the reference saves nothing.

| Pattern          | Desktop                             | Phone                             |
| ---------------- | ----------------------------------- | --------------------------------- |
| Home             | [Reference](home-desktop.png)       | [Reference](home-phone.png)       |
| Collection       | [Reference](collection-desktop.png) | [Reference](collection-phone.png) |
| Activity         | [Reference](activity-desktop.png)   | [Reference](activity-phone.png)   |
| Search           | [Reference](search-desktop.png)     | [Reference](search-phone.png)     |
| Look back        | [Reference](recall-desktop.png)     | [Reference](recall-phone.png)     |
| Settings         | [Reference](settings-desktop.png)   | [Reference](settings-phone.png)   |
| Capture/review   | [Reference](capture-desktop.png)    | [Reference](capture-phone.png)    |
| Supporting forms | [Reference](tools-desktop.png)      | [Reference](tools-phone.png)      |

The [HTML](index.html) uses `?screen=home`, `collection`, `activity`, `search`,
`recall`, `settings`, `capture` or `tools`. These are composition patterns, not
replacement content: privacy explanations, export limits, optional controls,
real counts, account links, errors and pending states remain in production.

## Shared rules

- Signed-in working pages share 48px desktop / 36px phone titles, weight 500,
  1.1 line height and -0.055em tracking. Remove inherited narrow title caps.
- Desktop content starts 40px down, with the existing 44px side inset; phones
  start 24px below their header with 20px insets. Headers have 28px / 24px below.
- Functional labels use 14px sentence-case DM Sans. Inputs are 15px desktop /
  16px phone, at least 44px high, with 12px corners and visible keyboard focus.
- Body text stays 15px with readable 1.6 line spacing; section titles are 24px
  desktop / 22px phone. Small metadata stays secondary, without replacing labels.
- Keep one primary action; quiet return links wrap below the heading on phones.
  Native menus, dialogs and sheets keep their keyboard and scrolling behavior.
- Home collections use compact horizontal cards. Empty states pair modest artwork
  with the invitation rather than adding a tall decorative introduction.
- Settings starts with downloads and restore, followed by recovery and device
  housekeeping. Destructive actions and their consequences remain explicit.
- Content clears the persistent phone navigation; sparse pages do not gain a
  second screen of blank minimum height. Honor reduced motion.

The cabinet palette, original artwork, reaction system and directory composition
remain. Show list, public snapshots and printable/exported objects keep their
presentation layouts. Public policy/help and the separate offline entry share
readable type and controls while retaining their own navigation and privacy copy.
Reference icons and artwork are schematic; production keeps its actual assets.

Implementation captures and checks are in [the app-wide review](../../ui-qa/app-polish/README.md).
