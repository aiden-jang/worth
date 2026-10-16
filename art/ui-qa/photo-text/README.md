# On-device photo text verification

The reader deliberately extends the cabinet with a dark source panel and cream
review slip. It retains the 192px rail, 68/50px titles, DM Sans/Mono, 22px panels,
12px fields and 44px controls. At 960px and below the panels stack in reading
order; optional notes stay collapsed until requested or already filled. This is
a web page, with no native app or external processing provider.

| State           | Desktop, 1440 × 900                   | Phone, 390 × 780                  |
| --------------- | ------------------------------------- | --------------------------------- |
| Page entry      | [Desktop](entry-desktop.png)          | [Phone](entry-phone.png)          |
| Selected photo  | [Desktop](source-desktop.png)         | [Phone](source-phone.png)         |
| Reviewed words  | [Desktop](review-desktop.png)         | [Phone](review-phone.png)         |
| Capture handoff | [Desktop](keep-desktop.png)           | [Phone](keep-phone.png)           |
| Manual fallback | [Desktop](manual-desktop.png)         | [Phone](manual-phone.png)         |
| Changed account | [Desktop](account-change-desktop.png) | [Phone](account-change-phone.png) |

These are viewport captures, including explicitly scrolled panels; they do not
claim every optional field fits one phone screen. The example receipt is drawn
only by the browser test and never seeded into a real archive. Source photo/text
reading never uploads that file. The saved record is created only after a second
capture review and explicit Save.

Browser checks run the real English reader against PNG/JPEG and prepare a WebP
for cancellation. They verify self-hosted assets, no third-party requests,
reviewed literal text, no inferred prices/dates/calls, seven-day draft recovery,
clearing, failed reading files, unsupported capabilities, blocked storage,
Stop/unmount/account-change worker termination and a private handoff across
sign-out/account changes. Handoff content never enters a URL. Unit tests cover
byte/header/dimension bounds, owned staging, expiry and immutable draft owners.
Axe checks the actual reader and review; long text reflows at 320, 430 and 768px.

The full core and browser results are recorded with the thirteenth implementation
in the expansion tracker. Full receipt attachment/line mapping and offline sync
remain separate unfinished features. No real-phone camera, native companion,
remote CI or deployment is implied by this local verification.
