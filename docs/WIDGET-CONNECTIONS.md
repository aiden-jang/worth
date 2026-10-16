# Widget connections

The web/API connection foundation is implemented on the isolated cabinet expansion
branch. Native companion source is under `native/`; its build and device status is
tracked separately in [native setup](../native/README.md). These files do not install
widgets, publish an app, deploy a Worker or complete the widget feature.

## Consent and data

An installed companion creates a 32-byte random verifier and state and opens Worth
in the system browser. The query contains only its S256 challenge, state, platform
and a reviewed device name. Shared Accounts login returns to the entire approval
URL. The browser asks for one to five owned collections, including archived ones.
Activity lists and Trash cannot be approved. Ten active devices and pending
requests together is the maximum per owner.

The browser returns a five-minute code to the fixed URI
`com.aidenjang.worth:/widget-callback`. The companion must verify the exact scheme,
empty authority, path, absence of a fragment, exactly one code/state, original state
and pending-request age before exchanging the code with its verifier. It must not
log codes, tokens or proofs or copy browser cookies. A fresh browser approval is
required to change accounts, scopes or renew expired access.

Read access lasts 30 days from approval. Its projection is collection IDs/names and
item IDs/titles/types/ranks. A saved find can select from all saved items, Want to
try, queue or Favorites; this intentionally exposes the chosen item from that
group. Notes, source URLs, private context, visit details, photos, workout data and
Accounts credentials are never in this projection. Top-five entries retain actual
saved ranks; finds use actual eligible active items. No synthetic examples are
inserted into an archive or a widget.

Archiving preserves access. Trash temporarily hides a collection/items; restoring
can expose them again through an existing approved scope. Permanent collection
deletion cascades its scope. Revoking the device blocks every future read. A copy
already on a device may remain until its OS redraws; revocation is not remote
erasure. Website sign-out does not revoke a separate companion connection.

## Endpoints

All paths below start with `/api`. Browser endpoints require the existing Accounts
session; bearer access is accepted only by the three public widget endpoints.

| Endpoint                                                 | Access                             | Result                                          |
| -------------------------------------------------------- | ---------------------------------- | ----------------------------------------------- |
| `POST /widgets/authorize`                                | Browser session, same-origin write | Validate owned scopes, issue code and callback  |
| `GET /widgets/devices`                                   | Browser session                    | Owner's active connections and pending requests |
| `DELETE /widgets/devices/:id`                            | Browser session, same-origin write | Revoke owner device and cancel matching grant   |
| `POST /widgets/token`                                    | Code + matching verifier           | Create/recover scoped read token                |
| `GET /widgets/snapshot?find=all\|want\|queue\|favorites` | Widget bearer                      | Bounded names/types/order/find snapshot         |
| `DELETE /widgets/connection`                             | Widget bearer                      | Self-revoke, including expired credentials      |

Writes with a foreign Origin are rejected; native calls omit Origin. Responses are
no-store, with no permissive browser CORS. Public widget exchange/read/revoke each
allow 30 calls per IP per minute. The IP bucket is hashed and old request windows
are cleaned up after subsequent limited requests. Cloudflare supplies the trusted
IP header in production. These application limits do not replace edge protections.

## Persistence and retry boundaries

Migration `0016_widget_connections.sql` adds devices, collection scopes and short
lived grants. The database keeps only SHA-256 hashes of authorization codes/tokens,
public challenges, device metadata and approved IDs. Unconsumed expired grants are
not usable, and expired grants are cleaned up on the owner's next approval. Device
metadata remains until Worth data deletion; expired/revoked devices cannot read.

The token is `base64url(SHA256(domain + NUL + code + NUL + verifier))`,
where the domain is `worth-widget-access-v1` and each NUL is one zero byte. Both inputs are independently random; the
verifier is never stored by the server. Deterministic derivation lets the same
exchange recover its result within the five-minute grant window if its response
was lost, without storing raw bearer credentials. A consumed grant cannot create
another device, widen scopes or reactivate a revoked connection. Canceling a
request deletes its grant. This is a private scoped-connection protocol, not a
claim to implement a general OAuth authorization server.

Device creation, scope insertion and grant consumption use one D1 transaction.
The insert rechecks owner, current active collection membership, expiry and the
connection limit. Real D1 tests cover simultaneous exchanges and a collection
trashed immediately before the transaction. The S256 implementation uses the
[RFC 7636 Appendix B vector](https://www.rfc-editor.org/rfc/rfc7636#appendix-B).
Native browser flow follows [RFC 8252](https://www.rfc-editor.org/rfc/rfc8252.html).

Connections are outside portable backups/restores. Deleting all Worth data removes
both grants and devices, with scope cascades. Native apps must keep tokens in
platform-protected storage, clear a previous connection's cache on replacement,
handle 401 as reconnection, use fixed trusted HTTPS endpoints without redirects,
show saved timestamps, bound stale cache use and offer revocation plus explicit
local forgetting if offline. Native behavior requires separate device verification.
