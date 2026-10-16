# Feature roadmap

Keep name-only capture, the private cabinet composition, and independent calls,
rankings and revisit plans. New features should remain optional.

## First release: archive tools

Shipped in commit `4a1e9e8` on main. CI, CodeQL, migration, deployment and live checks passed.
See [behavior and limits](ARCHIVE-TOOLS.md) and [visual verification](../art/ui-qa/archive-tools/README.md).

- Want to try in capture, details, selection actions and browsing, with local draft recovery.
- Move items with original photos, notes, merged records and visits.
- Reversible merges with preserved originals and separation in Details.
- Bulk queue, Want to try, type, move, merge and Trash actions.
- Immediate deletion Undo and 30-day Trash recovery for lists, items and logs.

## Expansion in progress

The user approved the expanded feature set on October 15. The detailed
[cabinet expansion tracker](CABINET-EXPANSION.md) records the complete scope and
its verification. The following groups are committed and verified locally on
`feat/worth-cabinet-tools`, without a push, pull request or deployment:

- Ranking sandbox, blind head-to-head placement, saved views/context rankings,
  private comparisons, decision draws and more authored collection artwork.
- Private sources, recommendations, labels/stamps, custom fields, purchases,
  loans and reviewed calendar-file return reminders.
- Selected-record booklets and individual recommendation cards.
- Private shelves, bookends, keepsakes, dedications, record inscriptions and a
  faceless undecided paper creature.
- Reviewed CSV import and editable address-based link name suggestions.
- Existing-record duplicate suggestions with reversible keep-separate reviews,
  Details and explicit revisit-composer actions.

- Reversible collection archiving with retained Search, Patterns, links and backups.

Remaining work includes history/time-machine views,
templates, inbox, offline sync, richer visits
and relationships, boards, revisit planning, routines/measurements, photo tools,
field guides, blind two-person choices and private collaboration. See the tracker
for individual unchecked features; a related completed tool does not complete
these automatically.

The user chose actual widgets for both iOS/iPadOS and Android. Recognition and
extraction must stay on-device, with no paid external AI provider. These native
and recognition integrations are pending. Web shortcuts and address parsing do
not count as those integrations.

Existing exercise history/progress, routines, exports and share images should be
extended only where the new behavior adds value. Public feeds, streaks and five-star
scores remain low priority. Future work needs its own concrete design and verification.
