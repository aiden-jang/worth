# Collection navigation review

Returning from Show list retains the collection's Favorites filter and restores
its previous scroll position. The browser review uses an isolated local account
and multilingual item names with emoji. No collection-layout or navigation change
was needed for this behavior.

Existing unit checks cover collection-scoped preferences and history restoration.
The browser checks the real collection flow and horizontal overflow at the build
contract's desktop and phone widths.

- [Desktop](collection-1440.png)
- [Phone](collection-390.png)

Fixtures live only in the isolated local review database. Browser emulation does
not establish physical-device gestures, native keyboards or spoken screen-reader
output.
