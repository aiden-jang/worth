# Photo text reading

`/read` recognizes English printed text in an explicitly selected JPEG, PNG or
WebP. It never uploads a source photo for recognition and uses no external AI
provider. The user starts processing, checks editable output, chooses/types a name
and optionally copies text into a private note. Review this capture stages only
that selected name/note for the original account and navigates to a clean capture
URL. Private handoff text never enters a URL or Accounts return link. The source
photo and unused text remain on this device. Nothing saves automatically, and no
price, date, call, rank or destination is inferred.

This is recognition assistance, not the complete receipt feature. Attaching
receipts and mapping multiple receipt lines to records remain pending. Handwriting,
blur, rotation and other languages can produce poor output; manual paste/name
entry remain available. Physical iOS/Safari and Android device testing is not
claimed by the local Chrome desktop/phone checks.

## Limits and recovery

Files are bounded to 10 MiB, 20 megapixels and 10,000 pixels per side. Header
inspection rejects unsupported/oversized dimensions before decoding. Browser
canvas preparation normalizes orientation/transparency and bounds recognition to
3,000px per side and six megapixels; unusually large PNG output falls back to JPEG.
The worker accepts only a Blob, never a URL to fetch. Read text is limited to
16,000 characters with a truncation notice; kept names/notes use 120/4,000. Up to
100 short lines are offered as literal name choices, without interpreting them.

Photo and text drafts use the current account’s existing seven-day device storage.
Blocked storage is reported. Remove photo and Clear photo and text draft do not
delete saved records; Settings cleanup and all-data deletion include this account’s
device drafts. A lost/changed account unmounts the reader and requires the existing
full reload boundary. Another account does not inherit this source photo or text, including a pending
private handoff. Signed-out pages withhold owned handoffs. External incoming shares
bind to the first selected signed-in account; unknown external content can still
survive ordinary sign-in. Blocked storage has a same-document memory fallback.
Draft hooks freeze their initial account and enforce the shared document binding
so a metadata-cache transition cannot retarget an old draft to a different account.

Reading locks draft edits until success, error or Stop. Replacing existing text
requires confirmation; names/notes remain intact. A parent worker owns the library’s
nested worker, allowing cancellation even during initialization. Cancellation,
unmount, account change, result, failure and a two-minute timeout terminate worker
resources. A generation guard prevents late preparation/results from starting
another job or overwriting a newer draft. Failed assets and unsupported capabilities
leave manual review available. Full offline archive reading/sync are separate,
unfinished features; this page may need a connection to obtain reading files.

## Build and browser policy

Tesseract.js/core 7.0.0 and the packaged English data 1.0.0 come from the locked
Node dependencies. `scripts/prepare-ocr.mjs` copies the worker, every current core
variant, quantized English data and supplied license/metadata files into generated
`public/ocr/v7/`. `pnpm dev`, `pnpm build` and therefore normal CI prepare these
assets. Generated vendor files are ignored by Git/format/lint; do not edit them.
Use the normal build command before running the built Worker. Revisit the asset
prefix and runtime options together when updating recognition dependencies.

The reader code is lazy; opening it does not request OCR engine/data assets.
Processing fetches only Worth-hosted static files after Read text on this device.
The library’s blob-worker fallback is disabled. CSP keeps script/connect/worker
origins at self and permits WebAssembly with `wasm-unsafe-eval`; JavaScript string
evaluation and remote script hosts are not enabled. There is no new OCR API,
server image processing, service worker cache or native companion.

See [third-party notices](../THIRD_PARTY_NOTICES.md),
[Tesseract.js API](https://github.com/naptha/tesseract.js/blob/master/docs/api.md),
[local assets](https://github.com/naptha/tesseract.js/blob/master/docs/local-installation.md)
and [WebAssembly CSP](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Content-Security-Policy/script-src#unsafe_webassembly_execution).
