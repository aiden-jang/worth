# Browser capture and private shortcuts

`/capture` accepts a name directly, or incoming title/text/link content for review.
It never saves on a GET request or on opening a shared URL. Choose Use incoming
share, review/edit the fields, keep the default Inbox destination or choose a current collection, then Review capture
and Save reviewed capture. Exact normalized name/type duplicates need a separate
keep-both choice. Calls remain unset and new records remain unranked; Want to try
is explicit. Inbox needs no collection. An unavailable selected collection or failed destination duplicate check blocks saving.

Incoming content can arrive in a fragment (the desktop bookmark code) or the
manifest's text/link GET share target. Fragment values stay outside the receiving
HTTP request; GET share-target values are part of the initial request to Worth.
They are removed from the displayed URL after parsing. No source URL is fetched,
no page is scraped, and no external AI is involved. Unsupported/oversized input
has a manual-entry fallback; invalid source protocols and credential-bearing URLs
cannot be saved. Text is rendered as text, never HTML.

Before sign-in, incoming content is staged in this tab's session storage. It is
ignored after 15 minutes and removed on the next capture open, on dismissal/use,
or with Clear device drafts/all-data deletion. The Accounts return URL contains
only `/capture`, not the incoming content. Blocked storage has an explicit copy
fallback before sign-in. Applying a share to an existing draft needs confirmation.
After application, the existing account-specific seven-day draft mechanism keeps
it; changing accounts does not restore another account's draft.

Saving to a collection uses the reviewed-import API for one item; saving to Inbox uses its own guarded creation transaction. Before the first save,
the client persists an immutable destination/payload and retry key. A lost reply
can be retried after reload without another record. That endpoint enforces owner,
parent availability, payload fingerprint and one atomic creation receipt. A later
move/merge/Trash state is reported instead of silently recreating the record.
Offline drafts remain editable on an already loaded page, but no background save
or offline archive reading is implied. Those larger offline features are pending.

## Getting to capture

Settings, Inbox and the Add list picker link to Web capture. New accounts can save a name to Inbox before creating any collection. The manifest offers Capture,
Shortlist, Saved find and Log a workout shortcuts. The optional text/link
`share_target` appears only when an installed browser supports that API; there is
no claim of universal Share menu support. Files are not accepted in this flow.
Manual paste works without installation. Desktop bookmark code opens Worth in a
separate tab with `noopener,noreferrer` and a fragment containing the current page
title, address and selection. Some browsers/pages block bookmarklets, so the
manual fallback remains available. The code is copied as text; the app never
executes incoming code.

## Quick picks

`/quick` shows up to five actual ranked records, or draws from all saved items,
Want to try, the revisit queue or Favorites. Each eligible record appears once
before a deck repeats; changing collection/group resets the draw. Calls and ranks
are read-only here. Archived collections require an explicit include choice.
Unavailable/foreign destinations expose no record and require choosing a new one.

Copy private shortcut creates an ordinary authenticated website URL containing
only collection ID, mode and group. It creates no public token. Bookmarking the
URL preserves the exact selection. Remember for app shortcuts optionally stores
only those navigation choices under the current account on this device; generic
manifest shortcuts can reuse them after checking the current account's owned
collections. Forget choices, Clear device drafts and all-data deletion clear that
preference. Browser/OS installation and shortcut menus vary; no installation,
external app distribution or deployment is performed by this implementation.

References: [Chrome Web Share Target](https://developer.chrome.com/docs/capabilities/web-apis/web-share-target),
[manifest share target](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/share_target),
[manifest shortcuts](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Manifest/Reference/shortcuts).

## Account changes in another tab

The page binds its shared API client to the first signed-in account. Private
requests include that expected account; the Worker compares it with the current
resolved session before reads, counters or writes. A mismatch returns 409 and
refreshes account metadata. Account metadata and public snapshots remain outside
this precondition. The header is a consistency check, never an authorization token.

When a different account is detected, the old app shell is removed and Worth asks
for a full reload. A fresh document gets a fresh query cache and draft scope. The
old document keeps its original request binding even for delayed asynchronous
continuations, preventing an old save/import/delete from running under the new
session. Focus revalidates the account without forcing a reload for the same user.

## Bound staging and private handoffs

Incoming content received while signed in is bound to that account for its
15-minute staging window. External content received before sign-in can follow
normal sign-in once, then binds to the selected account without extending expiry.
Signed-out pages withhold owned handoffs; another account discards the handoff
without opening its contents. The original account’s saved/device drafts remain.

Internal private transfers, including photo text, stage an explicit owner and
navigate to a clean capture URL. They never put private handoff text in a URL or
Accounts return link. A same-document memory fallback retains the account binding
when storage is blocked. Dismissal and Settings cleanup clear that memory too.
Draft/photo/staging hooks freeze their initial account and check the shared
document binding; a metadata-cache update cannot retarget an open draft while
account recovery unmounts the app. The owner tag is a consistency boundary, not
an API credential or substitute for server-side session/ownership checks.
