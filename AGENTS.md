# Worth UI work

Before changing a primary screen, read `DESIGN.md`, the current build references in
`art/ui-mocks/everyday/README.md`, and `art/ui-mocks/BUILD-CONTRACT.md`, then open the
relevant reference image. The October 28 everyday flow and October 29 directory revision are the current
interaction and composition targets for Home, Add, collections, recall and activity.
Use `art/ui-mocks/directory/README.md` for the collections directory. The user
explicitly requested structural simplification after finding the earlier UI complex.
The October 30 app-wide pass in `art/ui-mocks/app-polish/README.md` governs shared
headings, spacing, controls, compact Home cards and supporting pages. The taste-cabinet
references still govern identity, artwork, colors and specialized content. Earlier
compositions are history where these revisions supersede them.

- Match the current reference's layout, typography scale, spacing, palette, rules, and selected states.
- Use the current revision in `art/ui-mocks/BUILD-CONTRACT.md` for exact fonts, colors,
  responsive behavior, and product semantics. Preserve accessibility and existing data behavior.
- Keep signed-in mock fixtures out of the production archive. The signed-out landing
  may use generic demonstration data only in its explicitly labeled `EXAMPLE` section.
- Follow `VOICE.md` for cute ivory faces, visible dry humor, labeled choices, and concise copy. Keep functional labels, errors,
  privacy text, and destructive confirmations clear and preserve user-written content.
- The calls are Favorite / Meh / Not again, with no-call separate. Preserve support for
  all three values in storage, validation, editors, filters, exports, and summaries.
- Before reporting a UI build complete, capture the affected page at the contract's desktop
  and mobile widths and inspect it beside the mock. Fix visible drift; passing tests alone
  does not verify visual fidelity. If screenshot verification is unavailable, report that limitation.
- Document deliberate deviations and their reasons. Do not silently replace the reference
  with a different layout or treat it as optional inspiration.
- Earlier mock versions are historical references. Keep the signed-in dark canvas, sans-serif
  type and left navigation. Warm cream is now intentional for opinion slips and ranked picks,
  not a light theme for the whole collection. The signed-out landing
  has its own simple wordmark/sign-in header and no archive sidebar.

Keep generated review output out of Git; follow the [artifact policy](docs/QUALITY.md#browser-and-visual-review).
