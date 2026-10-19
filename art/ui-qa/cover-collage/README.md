# Cover collage verification

Workbench opens a secondary scrolling browser dialog over the accepted cabinet.
The collage keeps DM Sans, the dark palette, 22px corners and 44px controls. Sources
use a three-column shelf on desktop and two columns on phones; keyboard geometry
controls pair on desktop and stack on phones. This deliberate supporting tool does
not rearrange the underlying collection or opinion slip.

| State                        | Desktop                                  | Phone                                |
| ---------------------------- | ---------------------------------------- | ------------------------------------ |
| Saved source choices         | [Desktop](overview-desktop.png)          | [Phone](overview-phone.png)          |
| Manual arrangement sketch    | [Desktop](arrangement-desktop.png)       | [Phone](arrangement-phone.png)       |
| Keyboard geometry and layers | [Desktop](keyboard-controls-desktop.png) | [Phone](keyboard-controls-phone.png) |
| Exact prepared cover         | [Desktop](prepared-desktop.png)          | [Phone](prepared-phone.png)          |
| Current saved-cover review   | [Desktop](conflict-review-desktop.png)   | [Phone](conflict-review-phone.png)   |
| Unavailable source and draft | [Desktop](unavailable-desktop.png)       | [Phone](unavailable-phone.png)       |
| Route leave confirmation     | [Desktop](navigation-desktop.png)        | [Phone](navigation-phone.png)        |

The arrangement sketch and exact prepared image are separate. Sources fit inside
manual frames without cropping; typed captions are optional and independent of
saved gallery captions/arrows. Existing captions also describe source-choice
buttons for assistive technology. Edits invalidate prepared files. Only the exact
inspected WebP/PNG saves or downloads. The source files, calls and ranks stay intact.
The saved private cover uses existing full backups; arrangements stay on this
account/device for seven days when storage is available. Prepared files stay in
the current tab. Missing sources retain their frame names, positions and captions.

The first pass found an error when draft metadata reached the strict image schema,
then a low-contrast sketch caption. Rendering now receives only the layout fields;
caption labels have an explicit dark background. Reloading the same source chooser
really refetches its saved photos. Error copy distinguishes an existing prepared
file from a preparation that produced none. Cover review waits for the saved image
to load, retaining a retry path if it fails.

Migration `0021_cover_revisions.sql` adds an independent cover counter without
rewriting images. All current web cover editors supply it. Unrelated collection
activity and repeated/backward timestamps cannot make a stale cover edit current.
Owner/active-parent/revision guards share the write transaction. Exact retries can
confirm identical current bytes without writing; deleting a cover increments the
counter so an old request cannot recreate it. A different current cover requires
review and another deliberate save. Cache URLs use the same cover counter.

Unit/API cases exercise shape and dimension bounds, source privacy, account changes,
concurrent/stale writes, repeated timestamps, removal, backup and parent races.
Desktop/phone journeys cover exact download/upload byte matching, keyboard geometry,
layer order, invalidated previews, lost responses, saved-cover image failures,
conflict review, source reload, draft recovery, blocked storage, 320/430/768px reflow,
account changes and stopped preparation. A separate focused Axe journey checks the
caption backing and controls. Browser Back requires an explicit leave choice;
cancelling keeps a blocked-storage draft. Closing returns focus to Cover collage.
Collage confirmation controls have independently verified 44px targets. Test fixtures never become production records.

No physical-phone, native-app, remote-CI or deployment verification is claimed.
All 173 core tests across 42 files passed, with formatting, lint, unused-code,
TypeScript and production build checks. The full 249-case desktop/phone regression
passed before the final navigation refinement. All 14 focused collage journeys then
passed against the final build, including measured confirmation targets and focus
restoration. All 14 captures above were visually inspected. The expansion tracker
records this group alongside the remaining unfinished scope.
