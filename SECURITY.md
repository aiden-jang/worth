# Security

Only the current `main` branch is maintained. Keep dependencies and the shared
Accounts client current, and run `pnpm audit` when updating dependencies.

Report suspected vulnerabilities through [GitHub private vulnerability reporting](https://github.com/aiden-jang/worth/security/advisories/new).
Include the affected route, a minimal reproduction with synthetic records, and the
expected access boundary. Do not post cookies, share tokens, photos, backups or
someone else's records in public issues. Do not test against another person's archive.

Private routes verify the shared Accounts session and scope database access by owner.
Public share links expose fixed ranked titles/types for seven days; downloaded images
cannot be revoked. Local drafts and exported files can contain private data. See
[architecture](docs/ARCHITECTURE.md) and [release/recovery](RELEASE.md) for these boundaries.

A passing scan does not establish that all vulnerabilities are absent. Review ownership,
input limits, cache behavior and sharing scope when changing data routes.

Photo text recognition runs in browser workers with self-hosted code/data and no
photo-processing API. Image bytes/dimensions are bounded before decoding, and
recognition output remains editable text. CSP permits same-origin workers and
WebAssembly, without JavaScript string evaluation or third-party script origins. Optional
ISBN lookup permits a JSON connection to Open Library only after an explicit
action, with a fixed host/path, a checked numeric ISBN, omitted credentials and
referrer, response bounds and no remote script/image loading. See [photo text architecture](docs/PHOTO-TEXT.md) for cancellation,
account isolation, storage and dependency notices.
