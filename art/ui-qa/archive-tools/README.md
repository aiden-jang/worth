# Archive tools QA

The first feature release preserves the October 10 cabinet structure and adds
optional selection tools, Want to try, merged originals in Details, and Trash in Settings.
All captures use synthetic browser fixtures, never a production account.

## Visual inspection

- [Desktop selection](selection-1440.png), [phone selection](selection-390.png).
- [Desktop confirmation](trash-confirm-1440.png), [phone confirmation](trash-confirm-390.png).
- [Desktop merged originals](merged-desktop.png), [phone merged originals](merged-phone.png).
- [Desktop recovery](trash-desktop.png), [phone recovery](trash-phone.png).

Desktop uses 1440×900; phone uses 390×780. Full-page captures include scrolling content;
dialog captures show the visible native-dialog viewport, scrolled to original details.
Inspected against the corresponding cabinet collection references. Fonts, palette,
rail, ranked/unranked index, opinion slip and mobile inline selection remain intact.

Intentional changes: a 44px Want to try option follows quick capture; its browse view
joins the existing scrollable strip. Select reveals its toolbar and 44px labeled row
targets. Dialogs preview the affected names before mutation and remain open on failure.
Merged originals extend the existing scrolling details dialog. Settings gains a Trash
section with retention and restore controls. Actions wrap at narrow widths.

## Behavior and checks

- Formatting, ESLint/hooks, unused-code checks, TypeScript and production build pass.
- 73 unit/component/real-D1 tests pass, including 100-item Trash/Undo, foreign selections,
  preserved merge photos/history, search, backup/import, idempotent actions and retention.
- The full browser suite passes 29 checks, including eight new desktop/phone journeys.
- Capture/filtering preserves calls and ranks; unfinished Want to try capture recovers
  after a reload. Selection previews, failed-save retry, merge/separate, moves, immediate
  Undo and recovery after navigation are exercised.
- Axe WCAG 2 A/AA and 2.1 AA checks include the new confirmation dialog and populated Trash.
- Document/dialog overflow and 44px selection targets pass at 320, 390, 430, 768 and 1440px.

Browser journeys intercept synthetic API responses; real D1 tests separately verify
the Worker operations and migrations. Native-phone behavior and real-account production
recovery are not represented by those fixtures. Remote migration/deployment happens
through the existing protected-main release workflow after merge approval.
