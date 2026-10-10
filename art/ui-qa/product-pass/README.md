# Worth product pass — October 10

All screenshots use isolated browser fixtures; no production account was changed.
References: the current cabinet edition, the exercise comparison/routine references,
and the [active workout flow](../../ui-mocks/taste-cabinet/workouts/flow.html).

Desktop is 1440 × 900; mobile is 390 × 780. Page and open-dialog overflow checks
also run at 320, 430 and 768px. Native dialogs scroll internally. The browser script
checks keyboard save, real form labels, next-exercise focus, rest persistence,
finish/reopen, visit-only swap/reorder, skip/restore, no-call/visit filters, queue
independence, exercise search, draft/photo reload recovery, failed-photo retries and
offline save availability. First-routine setup creates no exercise logs.

## Intentional adaptations

- The activity header, latest recall, routines and filters remain above visit cards,
  as documented in the earlier workout reference. The new flow does not rearrange
  that accepted composition. Mobile pending exercise actions stack beside Skip.
- Queue state has its own quiet row above the slip's original Rank / Note / Revisit /
  Details strip. Favorite / Meh / Not again remain one capsule, independently stored.
- Date and visit filters stay in the existing disclosure. At 320px they stack in one
  column so native date controls remain usable; 390px uses two columns.
- New item/activity photo choices live in the existing optional-photo disclosure.
  Draft status and offline messages remain factual. Photos restore locally through
  account-scoped IndexedDB; text drafts use account-scoped local storage. Drafts older
  than seven days are not restored. Saving/discarding removes that draft.
- Existing workout sessions migrate to Finished, preserving historical visits rather
  than presenting all previous sessions as active. New visits start Active. Finish is
  a reversible status; recap counts include only saved individual sets and reps.
- Pages load on demand. A page-load failure offers Reload and preserves saved records.

## Release checks

46 tests passed. Worker types, type checking, formatting and the production build
passed. Captures were inspected against the reference compositions before commit. The worker tests cover private exports,
owner boundaries, idempotent single-record capture and migration preservation.
Cloudflare access was checked: this machine is not authenticated. Remote migrations
and deployment were not attempted; sign-in is needed to complete the release.

The [verification script](verify.cjs) runs with Playwright and Chrome against the local
preview. Set `WORTH_PLAYWRIGHT_MODULE` if Playwright is provided by the host runtime;
`WORTH_BROWSER_PATH` and `WORTH_PREVIEW_URL` are optional overrides. Every API request
is intercepted, so browser fixtures never reach a real archive.
