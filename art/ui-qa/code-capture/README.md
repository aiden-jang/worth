# Barcode and ISBN capture verification

This web page deliberately reuses the photo reader’s dark source/cream review
layout, cabinet typography, 192px rail, 22px panels and 44px controls. A small
faceless paper barcode slip marks an empty source. Metadata uses clear label/value
rows on desktop and stacks on phone; book lookup and private notes are optional
disclosures. No product or personal call is invented by the artwork.

| State                    | Desktop, 1440 × 900               | Phone, 390 × 780              |
| ------------------------ | --------------------------------- | ----------------------------- |
| Page entry               | [Desktop](entry-desktop.png)      | [Phone](entry-phone.png)      |
| Real decoded barcode     | [Desktop](read-desktop.png)       | [Phone](read-phone.png)       |
| Reviewed book suggestion | [Desktop](suggestion-desktop.png) | [Phone](suggestion-phone.png) |
| Kept text/source choices | [Desktop](review-desktop.png)     | [Phone](review-phone.png)     |
| Manual fallback          | [Desktop](manual-desktop.png)     | [Phone](manual-phone.png)     |

All ten captures were inspected alongside the current cabinet/reader compositions.
These are viewport captures of explicitly scrolled sections; optional fields and
long photos remain reachable through normal page scrolling. The barcode is drawn
only by the test, with independent EAN-13 patterns. The real worker decodes it
upright on desktop and vertically on phone. No production fixtures are added.

Twelve barcode journeys pass within the full 177-journey browser regression. They
cover explicit-only lookup, omitted credentials/referrer/account headers, ignored
remote covers, an unapplied suggestion, name/note replacement cancellation, changed
codes, no match, provider rate errors, unreadable photos, unsupported capabilities,
invalid check digits, offline/manual capture, stopped initialization, account-change
cancellation, seven-day text recovery, ephemeral photos and reviewed Inbox saves.
Axe runs on the actual result/review. Long input and controls fit 320, 430 and 768px.
A delayed worker download is allowed to finish after Stop, verifying it cannot
continue decoding and its browser target is cleaned up.

A separate one-request live browser smoke check used the real Open Library JSON
endpoint on October 16, 2026. It returned Fantastic Mr. Fox for 9780140328721,
passed the deployed asset CSP locally, omitted private headers/referrer, loaded no
remote cover and left the Name field unchanged. Automated CI uses deterministic
metadata fixtures rather than relying on the third-party service.

All 139 core tests across 35 files, formatting, lint, unused-code checks, TypeScript
and production build pass. The production dependency audit reported no known
vulnerabilities. Phone viewports are Chrome emulation; no real-phone camera,
native companion, remote CI, push or deployment is claimed.
