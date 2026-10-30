# Worth cabinet edition — current October 10 target

The user approved the broader art-direction plan. This edition keeps the dark cabinet,
sans-serif typography, left navigation and focused cream opinion slip. It gives the
collection shelf an authored visual language and makes first use a complete composition.
The standalone references were rendered and inspected before implementation.

| Reference             | Desktop                                   | Mobile                                    |
| --------------------- | ----------------------------------------- | ----------------------------------------- |
| Identity sheet        | [Identity](identity.html)                 | [Identity](identity.html)                 |
| Populated archive     | [Archive](archive.html)                   | [Archive](archive.html)                   |
| Sparse custom archive | [Sparse](archive-sparse.html)             | [Sparse](archive-sparse.html)             |
| Empty archive         | [Empty](archive-empty.html)               | [Empty](archive-empty.html)               |
| Collection            | [Collection](collection.html)             | [Collection](collection.html)             |
| Empty collection      | [Empty collection](collection-empty.html) | [Empty collection](collection-empty.html) |
| No-call collection    | [Undecided](collection-undecided.html)    | [Undecided](collection-undecided.html)    |
| Directory             | [Directory](directory.html)               | [Directory](directory.html)               |
| Starter choices       | [Starters](starters.html)                 | [Starters](starters.html)                 |
| Creation              | [Create](create-collection.html)          | [Create](create-collection.html)          |

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

## Finishing references

The October 10 finishing pass extends the accepted cabinet to Search and Patterns.
`build-finishing.py` regenerates these fixtures. Personal names wrap rather than disappear.

| Screen         | Desktop                          | Mobile                           |
| -------------- | -------------------------------- | -------------------------------- |
| Search start   | [Reference](search-empty.html)   | [Reference](search-empty.html)   |
| Search results | [Reference](search-results.html) | [Reference](search-results.html) |
| Empty Patterns | [Reference](patterns-empty.html) | [Reference](patterns-empty.html) |
| Patterns       | [Reference](patterns.html)       | [Reference](patterns.html)       |

Motion is a finite 200ms/6px entrance on opened panels and selected slips, disabled for
reduced motion. The signature landing, settings and sharing retain their existing layout.
