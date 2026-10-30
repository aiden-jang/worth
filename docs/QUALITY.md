# Quality and visitor review

Run `pnpm check` before a direct commit to main. It runs the dependency audit,
formatting, lint, unused-code detection, unit/component/migrated-D1 tests,
TypeScript, the production build, and the browser journeys. Node and pnpm versions
are pinned in `.nvmrc` and `package.json`.

CI builds once and passes that artifact to two browser shards and deployment.
Browser preparation points the hosted runner’s Azure Ubuntu mirror entry to the
[main Ubuntu archive](https://documentation.ubuntu.com/project/how-ubuntu-is-made/concepts/package-archive/)
before installing the same Playwright dependencies. This avoids observed multi-minute
font-download retries; package signature verification remains enabled. The edit is
conditional on the runner’s mirror-list file existing.

There is no extra browser-status job. CodeQL runs separately through GitHub’s
configured scanning. Inspect the results for the pushed commit, rather than a
previous green run. Failure artifacts last seven days; deployment finishes with
the read-only live check.

## Browser and visual review

The default browser suite covers desktop Chromium at 1440 × 900 and touch-enabled
Chromium at 390 × 780. The responsive matrix also checks 320, 430 and 768px.
Browser APIs are intercepted with synthetic archives; offline tests additionally
exercise the built Worker and service worker. These fixtures do not enter the
production bundle and do not establish that production authentication works.

To capture a new local review, set `WORTH_CAPTURE_UI` to a temporary output directory when running
the responsive, capsule, offline or private-space cases. Responsive captures go
to that run’s `test-results/` directory; the other three use named subdirectories
under the requested location. Feature-specific `WORTH_*_QA` flags remain available
in their respective tests. Keep generated sets, traces and reports local or in
short-lived CI artifacts. Commit authored references and curated README/installation
images only. Earlier run evidence remains in Git history.

Read the current [design contract](../art/ui-mocks/BUILD-CONTRACT.md) and relevant
reference before changing a primary page. Compare desktop and phone captures with
the reference at the same width. Inspect reflow, text wrapping, touch targets,
keyboard focus, reduced motion, and empty/loading/error states. Summarize findings
and unavailable checks in the change description.

Use the existing accessibility checks as regression coverage. An automated scan
does not verify spoken announcements, logical reading order, a native share sheet
or usability for a real visitor.

## Visitor journeys

Use a local synthetic account for the following pass:

1. Open the signed-out landing. Try a name and a call in its labeled example;
   confirm it does not save private records. Open Help and the policy links.
2. Enter an empty archive. Create a list and capture only a name. Add another
   immediately, clear a call, rank independently, and find the record again.
3. Search and open a result. Return with Back, open/close navigation with a
   keyboard, and check that the browser tab identifies the destination.
4. Edit a note, cancel a destructive confirmation, then try again. Simulate a
   failed save and confirm the text remains; retry without duplicating records.
5. Preview a public snapshot before creating its link. Check the signed-out
   snapshot excludes private notes, photos and history, then revoke it.
6. Export a records file, preview a restore, and reject a broken file. Check
   Trash recovery and account/device-copy isolation using disposable local data.
7. Log a workout with blank optional measurements. Compare previous sets, save
   actual results, finish rest, and confirm the finished timer settles.
8. Prepare an offline text copy, disconnect, queue a capture, and explicitly
   review sync after reconnecting. A local queued request must not look saved.

## External checks

Before claiming device verification, test an actual iPhone and Android browser:
sign-in return, keyboard/scrolling, uploads, downloads, offline preparation and
native image sharing. Check VoiceOver or TalkBack, not only an automated scan.
Use a disposable account with permission; never make production data as a smoke
test without authorization. Fresh-visitor observation and provider recovery/alert
delivery remain manual checks described in [release and recovery](../RELEASE.md).
