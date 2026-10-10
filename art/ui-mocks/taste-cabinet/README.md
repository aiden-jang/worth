# Worth — taste cabinet

October 10 direction: cute, dry, nonchalant and coherent. The user authorized a stronger
redesign after rejecting incremental polish. These standalone compositions were authored
and inspected before changing the app's primary layouts. They are design references, not
production data. The user accepted this direction and asked to build it.

| Screen     | Desktop                              | Mobile                              | Editable source         |
| ---------- | ------------------------------------ | ----------------------------------- | ----------------------- |
| Signed out | [Landing](landing-desktop.png)       | [Landing](landing-mobile.png)       | [HTML](landing.html)    |
| Archive    | [Archive](archive-desktop.png)       | [Archive](archive-mobile.png)       | [HTML](archive.html)    |
| Collection | [Collection](collection-desktop.png) | [Collection](collection-mobile.png) | [HTML](collection.html) |

The reference HTML and app load the same [composition stylesheet](../../../src/cabinet.css).
[build-reference.py](build-reference.py) regenerates the standalone compositions; local bundled
fonts and cover assets keep the references reproducible. Desktop captures are 1440 × 900;
mobile captures use 390 × 780 and natural page scrolling.

The visual idea is a taste cabinet: dark olive, warm paper, butter accents, open shelves and
one opinion slip. Landing copy is `For the good. And the meh.`. The cream slip contains one
large reaction, a short caption and three clearly labeled choices. Archive collections come
first. The collection uses a working list beside a focused selected item, instead of expanding
a dark control box inside a full-width list. Mobile places the same slip below the selected row.

This deliberately replaces the old rust palette, small framed landing demo, recent-first home,
full-width collection and repeated face buttons. Sans-serif typography, dark canvas, navigation,
lightweight capture and all product semantics remain. Older references are historical.

The static compositions use demonstration fixtures. Actual titles, ranks, counts, timestamps
and account names vary in the app. Production keeps working navigation icons, export/account
links and real settings controls even where the static reference simplifies those affordances.
Uploaded personal covers remain available and take precedence; the collection header shows
an optional private cover rather than invented category art. Empty and no-call states stay useful.

See [build contract](../BUILD-CONTRACT.md), [voice](../../../VOICE.md) and
[working captures](../../ui-qa/taste-cabinet/README.md) for implementation verification.
