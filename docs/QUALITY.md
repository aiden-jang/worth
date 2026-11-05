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

The populated-account journeys use 25 lists, 360 saved names, 694 dated entries,
97 workouts and 12 Unfiled finds. They cover name-only capture, older search
pages and retry, workout draft recovery, individually reachable chart points,
unit-specific progress, JSON/Excel
downloads and explicit restore preview. The migrated-D1 tests use the same
synthetic archive for actual JSON export/restore and scoped search pagination.
The busy-archive pass also uses 1,000 finds concentrated in one collection and 156
completed workouts. It checks bounded row rendering, older matches, all-history
exercise progress, visible-only bulk selection and delayed/lost-reply capture.
Its migrated-D1 test verifies complete records and insight counts independently
of the display window. Optional `WORTH_BUSY_QA` output stays in a temporary folder;
local timings describe that run rather than a production speed guarantee.

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

Mobile save cases exercise short windows and resized/panned visual viewports,
focused-field clearance, retry errors and nested confirmations. These browser
simulations do not replace physical iPhone/Android keyboard checks.

## Complete interface pass

The Home and collections design continues through the shared working-page frame,
readers, editors and public pages. The visual review uses isolated synthetic records
at the contract's desktop and phone sizes, with the narrow-width checks alongside
the existing browser journeys. The maintained composition sources are listed in
the [reference index](../art/ui-mocks/README.md).

| Area           | Pages and states reviewed                                                                                  |
| -------------- | ---------------------------------------------------------------------------------------------------------- |
| Archive        | Home, directory, archived/current controls, collection, new collection/activity, ranked display            |
| Recall         | Look back Memories/Insights, direct Memories, search, Unfiled, record readers/editors                      |
| Activity       | Workout list, active/finished visits, routines, exercise logging and progress/history                      |
| Capture        | Web capture and signed-out review, quick picks, photo text, barcode/ISBN, receipt directory/review/detail  |
| Archive tools  | Calendar, period summary, boards/trips and replay, connections, field guide                                |
| Private copies | Capsule directory/creation/closed/opened views, shared spaces, space detail and invitations                |
| Ownership      | Settings downloads/restore/Trash/offline/device/deletion/account sections, confirmations and recovery      |
| Public/device  | Landing and local example, Help, Privacy, Terms, missing pages, public ranking/expired links, offline copy |

Settings section links and document contents are covered by browser checks. Help
and policy text retain their full wording and update dates. Signed-in missing
pages use the existing shell rather than repeating public navigation and footers.
The standalone offline entry retains its separate account, encryption and sync
boundaries. No private review fixtures are added to the production archive.

Home and workout-completion cases cover stable source selection, refreshed counts,
source links, failed/confirmed finishes, incomplete totals, history access, focus,
filter recovery and narrow layouts. Migrated-D1 tests exercise private Home evidence
and verify original photo bytes after record restoration in an isolated local database.

Saved-record cases cover read-only search/recall links, explicit Edit with draft
recovery, same-page Unfiled navigation after capture, exact set/measurement display,
closing deep links, and focus return. Shell cases delay or fail a page's code to
verify that navigation stays available during loading and Home can recover from
failure. Creation checks keep the name-only submit action before optional sections.

## Visitor journeys

Use a local synthetic account for the following pass:

1. Open the signed-out landing. Try a name and a call in its labeled example;
   confirm it does not save private records. Open Help and the policy links.
2. Enter an empty archive. Create a list and capture only a name. Add another
   immediately, preview it without writes, then use Edit to clear and save a call.
   Rank independently from the row options, and find the record again.
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
