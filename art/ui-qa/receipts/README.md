# Reviewed receipts QA

The cabinet contract governs this web-only extension. Capture deliberately pairs
a dark source panel with a cream review panel, matching Read photo. Reviewed line
cards sit on the dark canvas; optional notes disclose rather than adding a tall
blank field to every line. The exact prepared image has its own review heading,
full-size link and two explicit choices. Preparation focuses that heading;
recovered drafts preserve the reader's position. Directory cards and the authored
faceless receipt empty state reuse the secondary-page scale and palette.

Captures use isolated synthetic fixtures at 1440 × 900 and 390 × 780. Entry,
reviewed lines, attachment review, saved/renamed sources, directory/empty states,
uncertain save, unavailable sources, navigation confirmation and long-text reflow
are captured. Additional browser checks cover 320, 430 and 768px and Axe after
hovering a cream-panel control. Private production records are never seeded.

The desktop happy path runs the real self-hosted on-device OCR worker. Attachment
checks compare the device's exact prepared file with the submitted bytes, then
compare decoded preview/saved pixels, without weakening the app's network CSP.
Other journeys cover reply loss and reload, checking a saved review without a
second upload, missing prepared files, stopping a late canvas job, blocked device
storage, account changes, removal, and receipt-only restore. Results are recorded
in [Cabinet expansion](../../../docs/CABINET-EXPANSION.md).
