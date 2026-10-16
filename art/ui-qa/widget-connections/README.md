# Widget connection web QA

The connection approval is a deliberate secondary page extending the cabinet
Settings reference. It preserves the 192px desktop rail, 68px/50px headings,
dark olive, DM Sans/Mono, rules, wrapping content and labeled 44px actions.
Settings adds a collapsed connection disclosure between restore and device cleanup;
it lengthens the page without changing the accepted primary layouts. Signed-out
approval uses a focused wordmark/sign-in column and preserves the complete return URL.

Desktop captures are 1440×900 and phone captures 390×780, with natural page scrolling.
All six captures were inspected. The first review caught inherited full-width
checkboxes and mono labels; those were corrected before the final captures.

- `approval-desktop.png`, `approval-phone.png`: no implicit collection selection;
  actual approved archived/current choices, names and counts.
- `connections-desktop.png`, `connections-phone.png`: connected and pending devices,
  scopes, expiry and separate revoke/cancel actions.
- `signin-desktop.png`, `signin-phone.png`: explicit browser sign-in before consent.

Synthetic account/collection/device records exist only in browser fixtures. Tests
cover 1–5 choice limits, invalid requests, preserved choices on errors, altered
callback rejection, pending cancel, revocation retry, empty/loading failures,
login return URLs, Axe and long-name reflow at 320/430/768px.

These captures verify the website only. Native build status, installed widgets,
VoiceOver/TalkBack, OS refresh timing and background redraws are tracked in
[native setup](../../../native/README.md). They remain unverified here.
