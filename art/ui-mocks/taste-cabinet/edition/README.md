# Worth cabinet edition — current October 10 target

The user approved the broader art-direction plan. This edition keeps the dark cabinet,
sans-serif typography, left navigation and focused cream opinion slip. It gives the
collection shelf an authored visual language and makes first use a complete composition.
The standalone references were rendered and inspected before implementation.

| Reference             | Desktop                                          | Mobile                                          |
| --------------------- | ------------------------------------------------ | ----------------------------------------------- |
| Identity sheet        | [Identity](identity-desktop.png)                 | [Identity](identity-mobile.png)                 |
| Populated archive     | [Archive](archive-desktop.png)                   | [Archive](archive-mobile.png)                   |
| Sparse custom archive | [Sparse](archive-sparse-desktop.png)             | [Sparse](archive-sparse-mobile.png)             |
| Empty archive         | [Empty](archive-empty-desktop.png)               | [Empty](archive-empty-mobile.png)               |
| Collection            | [Collection](collection-desktop.png)             | [Collection](collection-mobile.png)             |
| Empty collection      | [Empty collection](collection-empty-desktop.png) | [Empty collection](collection-empty-mobile.png) |
| No-call collection    | [Undecided](collection-undecided-desktop.png)    | [Undecided](collection-undecided-mobile.png)    |
| Directory             | [Directory](directory-desktop.png)               | [Directory](directory-mobile.png)               |
| Starter choices       | [Starters](starters-desktop.png)                 | [Starters](starters-mobile.png)                 |
| Creation              | [Create](create-collection-desktop.png)          | [Create](create-collection-mobile.png)          |

The landing retains its signature composition in the parent directory. Its character,
colors and voice are the same identity shown here. The existing reaction family remains;
this edition extends its craft into category artwork and first-use illustrations.

Drinks, Movies, Places and Cars use flat authored SVG category covers in sage, clay and
butter. They illustrate categories, never the contents of the person's collection. Uploaded
private photos retain precedence. Other names use layered monogram slips; activity uses
neutral initial artwork without personal-call badges. Cover previews show only the name
and artwork, without invented records, ranks or opinions.

`build-edition.py` generates these HTML compositions with the shared cabinet styles and
`src/cabinet-edition.css`. Viewports are 1440 × 900 and 390 × 780; mobile pages scroll
naturally. The identity sheet is a design artifact, not a production screen. Fixture names
and timestamps vary in the app, and working navigation/account affordances remain.
