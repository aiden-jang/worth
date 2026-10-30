# Collections directory — October 29

The user approved correcting the sparse directory shown in their screenshot.
These references were authored, rendered and opened before applying the new
composition. They supersede the cabinet edition's directory page, preserving
its colors, artwork, fonts and creation flow. All fixtures are synthetic.

| State                    | Desktop                            | Phone                            |
| ------------------------ | ---------------------------------- | -------------------------------- |
| One collection           | [Reference](sparse-desktop.png)    | [Reference](sparse-phone.png)    |
| Collections and activity | [Reference](populated-desktop.png) | [Reference](populated-phone.png) |
| Archived                 | [Reference](archived-desktop.png)  | [Reference](archived-phone.png)  |
| Empty                    | [Reference](empty-desktop.png)     | [Reference](empty-phone.png)     |

The [HTML](index.html) uses `?state=sparse`, `populated`, `archived` or `empty`.
Viewports are 1440 × 900 and 390 × 780. The sidebar and bottom navigation are
simplified placeholders; production retains working icons, account links, safe
areas and the established first-use starter choices.

Use one header with factual counts, a primary New collection action and quiet
New activity link, followed by one toolbar. Current/Archived remain available.
Search and ordering appear for more than three collections, or while a saved
query/nondefault order needs to stay reachable. Once shown, controls stay open for that directory visit, so clearing or
changing filters does not shift the toolbar or lose focus. Section titles appear only when both collections and activity are present.

Cards keep artwork, name and metadata in one compact surface. Two columns fit
wide desktop views; narrower layouts use one. Artwork retains its 1.6 crop and
private-cover precedence. Names and descriptions wrap. The phone uses a smaller
thumbnail and 16px form inputs. Controls remain at least 44px, with visible focus
and reduced-motion support. No data is created or reorganized by this revision.

Implementation screenshots and checks are in [directory verification](../../ui-qa/directory-polish/README.md).
