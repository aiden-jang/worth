# Field guide verification

Patterns → Field guide deliberately extends the cabinet's secondary pages with a
cross-collection editor. It preserves the dark canvas, 192px rail, 68/44px title,
DM Sans controls, 22px groups and 44px targets. Choices pair on desktop and stack
on phones. Ruled selections use labeled Earlier/Later actions; the cream preview
shares the existing booklet renderer and shows no call or rank.

| State                         | Desktop                            | Phone                          |
| ----------------------------- | ---------------------------------- | ------------------------------ |
| Empty guide                   | [Desktop](overview-desktop.png)    | [Phone](overview-phone.png)    |
| Selected records and captions | [Desktop](choices-desktop.png)     | [Phone](choices-phone.png)     |
| Prepared preview              | [Desktop](preview-desktop.png)     | [Phone](preview-phone.png)     |
| Unavailable source recovery   | [Desktop](unavailable-desktop.png) | [Phone](unavailable-phone.png) |

All eight captures were inspected beside the cabinet/publishing references. All
three pages of the actual A5 browser PDF were rendered and inspected; headings,
explicit locations, notes and footer fit without clipping. This is export QA,
not a public artifact containing real records. All fixtures are synthetic.

All 158 core tests across 39 files passed with one worker after the parallel run
hit process-start and timeout failures. Formatting, lint and unused-code checks
passed. All 18 focused desktop/phone guide and existing publishing journeys passed. They
cover default-off projections, cross-collection ordering, exact offline HTML,
font license, print isolation, changed/missing sources, caption recovery, failed
photos and retry, blocked storage, account changes during preparation, Axe and
320/430/768px reflow. A real metadata-bearing JPEG fixture proves original EXIF
text is absent from the encoded copy; photos remain an explicit choice. No source
records are modified and existing booklet/card interactions still pass.

Guide drafts live only on the account/device for seven days and are not backed
up. HTML/PDF copies cannot be revoked. No physical-phone, deployment or remote CI
verification is claimed. Remaining features are tracked in the expansion document.
