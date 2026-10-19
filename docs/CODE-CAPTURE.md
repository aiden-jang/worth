# Barcodes and reviewed book lookup

The authenticated `/code` page reads one EAN-8, EAN-13 or UPC-A barcode from a
JPEG, PNG or still WebP. Barcode decoding runs in a lazy self-hosted ZXing worker;
photos are never uploaded for recognition. A photo is held only in page memory,
its preview URL is revoked on change/unmount, and leaving discards it. This flow
does not attach photos to records. Type/paste supports ISBN-10 (including a final
X) and ISBN-13 too. Manual naming remains available without decoding or lookup.

Input shares the reader’s 10 MiB, 20 megapixel and 10,000px-side pre-decode header
bounds. The worker checks decoded dimensions, scales to at most 3,000px/6 megapixels,
uses only the supported product formats and tries upright/rotated local pixels.
It does not scan QR codes, follow encoded links or identify arbitrary products.
Check digits catch some entry mistakes, not incorrect matches or nonexistent
products. Users must confirm the printed digits and any suggested edition.

Stop, page exit, account recovery, failure, result and a 15-second timeout call
Worker.terminate; generation checks reject late preparation/results. Unsupported
workers/image APIs and unreadable photos leave manual entry usable. Replacing an
existing code requires confirmation and preserves the chosen name/note. A new code
clears the earlier book suggestion/source choice without rewriting private text.

## Optional external metadata

Only Look up ISBN with Open Library sends a request. The browser sends a checked
ISBN to the fixed HTTPS `/api/books` JSON endpoint; it omits credentials/referrer,
rejects redirects and never sends photos, notes or Worth account headers. The
provider sees the ISBN, the browser’s IP address and ordinary network information.
This is catalog metadata, not an AI processing provider. Worth does not add a paid
API key or remote scanning SDK. No catalog titles, covers or links load on entry,
photo selection, decoding or draft recovery.

The request is bounded to 12 seconds and 512 KiB, with at least 1.1 seconds between
uncached lookups in a document. At most 50 public results (including no match) can
be cached in memory for 24 hours. This cache exposes no history/listing UI and is
not an archive or account cache. The provider can still reject or limit requests.
Cancellation, errors, unreadable responses, rate limits and no match keep manual
capture available. No bulk lookup or scraping runs in the background.

Only the requested ISBN’s bounded plain title, author names, publisher names and
publication text enter the suggestion. Returned HTML, URLs, images, identifiers
and arbitrary metadata are not rendered/fetched. React renders the text literally.
Copying a title or details is explicit; replacing filled fields asks first. A
long title is visibly shortened to the record’s 120-character name limit and stays
editable. Publication text is a note, never a purchase/visit date.

## Kept content and recovery

The review shows the exact composed private note and optional fixed Open Library
ISBN source link. Keeping the code in the note and keeping the source are separate
visible choices. A name alone remains enough; invalid/unreadable codes can be
omitted. The combined note must fit 4,000 characters. No call, type or rank is
inferred. A transfer stages only the chosen name/note/source with the immutable
account binding and opens a clean `/capture` URL. Existing incoming-draft
replacement, destination/duplicate review and explicit Save still apply.

The code/name/note/suggestion draft is owner-scoped for seven days, including
restored source/code choices. Settings’ device cleanup and Clear code draft remove
it; the ephemeral photo is not part of that stored draft. Account changes abort
lookup, terminate decoding and unmount the old page. Old drafts cannot follow a
new metadata-cache account. Saved contents use existing record/context fields,
Trash and backup paths; no new table or backup format is introduced. Private
metadata is excluded from the existing title/type-only public snapshot projection.

CSP adds only `https://openlibrary.org` to connect-src. Script/worker origins remain
self; JSONP, external scripts and external cover/image hosts remain disabled.
Barcode code is bundled only into its worker, loaded after Read. See
[notices](../THIRD_PARTY_NOTICES.md), [ZXing source/examples](https://github.com/zxing-js/library),
[Open Library Books API](https://openlibrary.org/dev/docs/api/books) and
[human lookup/rate guidance](https://openlibrary.org/developers/api).

Local QA uses a real generated barcode with the real decoder, including a vertical
photo, while deterministic metadata fixtures exercise review/recovery. The QA
README records live-service verification separately. Browser viewports emulate
phone layout; they do not establish real-camera capture or native/PWA installation.
