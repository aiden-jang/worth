# Worth UI work

Before changing a primary screen, read `DESIGN.md`, `art/ui-mocks/BUILD-CONTRACT.md`
and the relevant source in `art/ui-mocks/README.md`, then open its reference image.
The app-wide references own shared headings, spacing, controls and Home cards;
directory and everyday references own their respective compositions. Taste-cabinet
sources supply current identity, artwork, landing and specialized content. Keep
only maintained rules and references; Git records superseded designs.

- Match the current reference's layout, typography scale, spacing, palette, rules, and selected states.
- Use the current revision in `art/ui-mocks/BUILD-CONTRACT.md` for exact fonts, colors,
  responsive behavior, and product semantics. Preserve accessibility and existing data behavior.
- Keep signed-in mock fixtures out of the production archive. The signed-out landing
  may use generic demonstration data only in its explicitly labeled `EXAMPLE` section.
- Follow `VOICE.md` for matte call characters, visible dry humor, labeled choices, and concise copy. Keep functional labels, errors,
  privacy text, and destructive confirmations clear and preserve user-written content.
- The calls are Favorite / Meh / Not again, with no-call separate. Preserve support for
  all three values in storage, validation, editors, filters, exports, and summaries.
- Before reporting a UI build complete, capture the affected page at the contract's desktop
  and mobile widths and inspect it beside the mock. Fix visible drift; passing tests alone
  does not verify visual fidelity. If screenshot verification is unavailable, report that limitation.
- Document deliberate deviations and their reasons. Do not silently replace the reference
  with a different layout or treat it as optional inspiration.
- Keep the signed-in dark canvas, sans-serif type and left navigation. Warm cream
  is intentional for opinion slips and ranked picks,
  not a light theme for the whole collection. The signed-out landing
  has its own simple wordmark/sign-in header and no archive sidebar.

Keep generated review output out of Git; follow the [artifact policy](docs/QUALITY.md#browser-and-visual-review).
