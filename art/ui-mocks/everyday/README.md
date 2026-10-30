# Everyday flow — October 28

The user found Worth's UI complex and approved a connected simplification across
Home, Add, collections, recall and Gym. These authored phone and desktop references
were rendered and inspected before implementing their corresponding compositions.
They supersede the older cabinet layouts for those primary flows while retaining
its colors, typography, artwork and reaction system. Specialized secondary screens
retain their cabinet references. The [October 29 directory](../directory/README.md)
supersedes the earlier collections directory composition.
The [October 30 app pass](../app-polish/README.md) supersedes shared heading,
control and compact Home-card styling while preserving these interactions.

| Flow           | Desktop                                       | Phone                                         |
| -------------- | --------------------------------------------- | --------------------------------------------- |
| Home           | [Reference](index.html?screen=home)           | [Reference](index.html?screen=home)           |
| Add            | [Reference](add-desktop.png)                  | [Reference](add-phone.png)                    |
| Unfiled memory | [Reference](index.html?screen=unfiled-memory) | [Reference](index.html?screen=unfiled-memory) |
| Collection     | [Reference](index.html?screen=collection)     | [Reference](index.html?screen=collection)     |
| Gym            | [Reference](index.html?screen=gym)            | [Reference](index.html?screen=gym)            |

The editable [HTML](index.html) selects a screen with `?screen=home`, `add`,
`unfiled-memory`, `collection` or `gym`. The Unfiled-memory variant was authored
and inspected before adding the optional details; the default Add remains name-only. Fixtures are explicitly synthetic and do not write data.
Desktop is 1440 × 900 and phone is 390 × 780 with natural page scrolling. A fixed
phone navigation bar appears at the viewport edge in full-page captures; the
running app includes content clearance and device safe areas.

The reference uses simple face placeholders; production retains the actual
reaction artwork, accessible icons and working account/settings links. Production
also retains real pending/error/retry states and existing advanced capabilities.
Capture is name-first; organization is optional. Phone item selection opens a
native sheet rather than stretching the list. Current workouts take priority over
routines and historical tools. Exact behavior is in the build contract and
[everyday flow guide](../../../docs/EVERYDAY.md).
