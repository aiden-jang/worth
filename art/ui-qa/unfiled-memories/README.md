# Unfiled memories verification — October 28, 2026

The user approved optional date, thought and photo capture before choosing a
collection. These screenshots use synthetic fixtures, including the Worth icon
as a test image. No real account or private photo was used.

The [authored references](../../ui-mocks/everyday/README.md) and
[build contract](../../ui-mocks/BUILD-CONTRACT.md#unfiled-memories--october-28)
govern this extension. See [everyday behavior](../../../docs/EVERYDAY.md).

| State                      | Desktop                                | Phone                                |
| -------------------------- | -------------------------------------- | ------------------------------------ |
| Default Add                | [Capture](add-desktop.png)             | [Capture](add-phone.png)             |
| Add with a memory, top     | [Capture](add-memory-top-desktop.png)  | [Capture](add-memory-top-phone.png)  |
| Optional details and photo | [Capture](add-memory-desktop.png)      | [Capture](add-memory-phone.png)      |
| Existing find, top         | [Capture](edit-memory-top-desktop.png) | [Capture](edit-memory-top-phone.png) |
| Saved photo and controls   | [Capture](edit-memory-desktop.png)     | [Capture](edit-memory-phone.png)     |
| Dated recall               | [Capture](memory-recall-desktop.png)   | [Capture](memory-recall-phone.png)   |

Desktop captures are 1440 × 900; phone captures are 390 × 780. Dialogs scroll
inside the viewport. The details/photo captures intentionally show a later scroll
position; their top captures show name and destination first. Recall content
continues below the viewport with clearance for the phone navigation.

## Visual review

Opened and compared the desktop and phone captures with the authored references.
The default composer remains name-first, with details closed. Explicit dated
experiences use a visible date and compact labeled reaction capsule; there is no
required opinion, photo or collection. The existing palette, fonts, 22px dialogs,
12px fields and 44px targets remain.

Deliberate differences from the static prototype:

- Retain the actual editor’s mono field labels, multiline note, close icon, factual
  help, device-draft status, Clear draft and retry controls.
- Compact choices reuse the experience capsule without repeating large faces in
  small buttons. Actual reaction artwork remains elsewhere in the cabinet.
- The existing find editor keeps its Type/context/filing tools. Its optional
  memory disclosure opens for saved dates; the overall call stays independent.
- A chosen or saved photo occupies real space in the scrolling form. The fixture
  image is explicitly synthetic and is not a sample memory added to accounts.

## Checks

The full unit/database run passed 265 checks; its one outdated future-version
assertion was updated for supported JSON version 11 and passed on rerun. This
verifies all 266 cases. Dependency audit, formatting, lint, unused-code analysis,
type checking and the production build also passed.

The 40 existing Chromium everyday/Inbox cases passed on desktop and phone. All
12 new Unfiled-memory cases passed, plus both existing gallery lost-upload-reply
cases. All 15 everyday/Unfiled cases passed in touch-enabled WebKit at phone size.
Reflow checks cover 320, 430 and 768px; automated accessibility checks cover the
Add and edit flows. Timeouts, assertions and retry policy were not weakened.

Coverage includes optional capture with no collection, source links in recall,
separate overall/visit reactions, photo-only saves without invented visits,
confirmed removal and exact retry identities after a lost save/upload/filing reply.
An existing saved note is selected through the textbox’s accessible name before
editing. Safari’s File persistence failure was reproduced and fixed by storing
raw bytes plus file metadata in the shared photo-draft store. Its recovery tests
and the existing gallery recovery tests then passed.

Database checks cover owner boundaries, private no-store photo reads, concurrent
exact uploads, stale edits/removals/filing, removed-upload tombstones, Trash
recovery, old-client memory preservation, full and records-only restore, Excel
columns and atomic transfer to the correct item/visit gallery. A photo-only find
files without creating a visit; a dated memory creates exactly one visit.

An Unfiled find holds one optional experience and one photo. Multiple visits and
specialized calendar/period-summary tools remain collection-based. This was
browser automation and screenshot review; a physical phone, software keyboard,
spoken screen-reader output and independent usability observation were not tested.
