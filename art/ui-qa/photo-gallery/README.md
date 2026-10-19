# Photo gallery verification

Manage photos extends the existing optional Photo disclosure with a scrolling
browser dialog. It keeps the dark cabinet, 22px corners, DM Sans controls and 44px
targets. Desktop previews pair with captions/order/cover choices; phones stack.
The parent opinion slip and name-only capture remain unchanged. Photos never
assign a call, rank or date.

| State                                | Desktop                                | Phone                              |
| ------------------------------------ | -------------------------------------- | ---------------------------------- |
| Gallery overview                     | [Desktop](overview-desktop.png)        | [Phone](overview-phone.png)        |
| Separate caption and arrow overlay   | [Desktop](annotated-desktop.png)       | [Phone](annotated-phone.png)       |
| Keyboard arrow position controls     | [Desktop](arrows-desktop.png)          | [Phone](arrows-phone.png)          |
| Before/after slider                  | [Desktop](comparison-desktop.png)      | [Phone](comparison-phone.png)      |
| Full side-by-side originals          | [Desktop](side-by-side-desktop.png)    | [Phone](side-by-side-phone.png)    |
| Lost upload reply and recovery       | [Desktop](upload-recovery-desktop.png) | [Phone](upload-recovery-phone.png) |
| Current saved choices comparison     | [Desktop](conflict-desktop.png)        | [Phone](conflict-phone.png)        |
| Absent original and retained caption | [Desktop](unavailable-desktop.png)     | [Phone](unavailable-phone.png)     |

The first visual pass caught inherited single-photo clipping in the comparison.
Originals now fit without that height cap, inside a bounded comparison frame with
its range control above the image. Captions/arrows remain separate overlays, with
a readable annotation list and labeled keyboard position controls. The editor
lives outside its parent disclosure so clearing a cover cannot hide it. Closing
returns to the available Manage photos control. Header containers are ordinary
groups, avoiding extra banner landmarks in the body-level dialog.

Lost upload replies recover the same prepared bytes and UUID on this account and
device. An already saved upload can retry even if an older metadata draft recovered;
that caption draft stays intact for comparison. Metadata conflicts keep one replaced
draft for copying after an explicit saved-choice replacement. Upload failures and
success feedback sit beside the upload controls. Unavailable originals retain
captions and arrows, with clear records-only restore copy. No sample photo is saved
to production.

Real D1 checks cover existing/trashed photo migration, owner isolation, immutable
concurrent retries, exact byte preservation, revision/future-revision rejection,
source removal without resurrection, SQL owner/capacity guards, version 5 photo
and records-only restore, fresh IDs, old single-photo compatibility and corrupted
original rejection, including maximum-size Unicode metadata. All 168 core tests
across 41 files passed with one worker. Formatting, lint, unused-code, TypeScript
and production build checks passed. The full 237-case desktop/phone browser suite
passed, followed by all 14 focused gallery journeys against the final build. These
cover Axe, 320/430/768px reflow, image retry, absent originals, lost replies,
preserved conflicts, invalid-arrow recovery and account changes removing the
body-level dialog without moving its draft to another owner. All 16 final captures
above were visually inspected.

Uploads may be resized before storage. These checks preserve the stored sources,
without promising a full-resolution camera original. Comparison choices are manual,
with no inferred chronology. Gallery captions/arrows stay out of existing public
snapshot and opt-in booklet/card/guide projections. No physical-phone, native app,
remote CI or deployment verification is claimed here.
