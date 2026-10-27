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

## Web expansion on main

The user approved the expanded feature set on October 15. The detailed
[cabinet expansion tracker](CABINET-EXPANSION.md) records the complete scope and
its verification. The expansion was integrated into main in `cefcf56`
(`feat: complete web app expansion`). The following groups are implemented:

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
- Reviewed web capture, recoverable text/link shares, browser bookmark code and private
  shortlist/saved-find shortcuts with account-scoped remembered choices.
- Reusable collection detail names and private setup templates, including reviewed creation,
  safe retries, removal and atomic backup restore.
- Private visit-specific location, edition, order/setup and reaction, with draft
  recovery and revision-aware detail editing.

- Inbox, reviewed on-device photo text reading and optional free ISBN lookup.
- Ranking/opinion history, private record connections, personal field guides and
  a literal-date revisit/activity calendar.
- Multiple source photos, separate captions/arrows, keyboard before/after
  comparison and manually prepared cover collages.
- Cross-collection boards, independent archiving, and manual trip replay with a
  complete readable stop list.
- Reviewed receipts, on-device extraction, explicit line-to-record choices and
  optional exact image attachments, with recoverable saves and backups.
- Routine target snapshots, explicit named measurements and exercise aliases that
  group history while preserving original entries and units.

The approved web expansion is complete within the documented scopes, including private capsules, granular text collaboration, two-person reveals and encrypted offline text with explicit pending sync. See the feature tracker for verification and limits.

Worth remains a web app. Native iOS/Android companions and widget APIs were
removed at the user's request. Home-screen access uses web/PWA shortcuts.
Recognition stays on-device without paid external AI or processing uploads.
The separate optional book lookup sends only a checked ISBN to Open Library.

Existing exercise history/progress, routines, exports and share images should be
extended only where the new behavior adds value. Public feeds, streaks and five-star
scores remain low priority. Future work needs its own concrete design and verification.
