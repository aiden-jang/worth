# Worth UI work

Before changing a primary screen, read `DESIGN.md`, the current build references in
`art/ui-mocks/taste-cabinet/README.md`, and `art/ui-mocks/BUILD-CONTRACT.md`, then open the
relevant reference image. The October 10 taste cabinet is the current build target.
The user authorized a stronger redesign after rejecting incremental polish. Earlier
personality and generated references remain history; their different layouts do not govern this revision.

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
