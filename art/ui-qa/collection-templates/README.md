# Collection setup and templates — October 16

References: current [cabinet build contract](../../ui-mocks/BUILD-CONTRACT.md),
[creation artwork](../../ui-mocks/taste-cabinet/personal-tools/README.md) and the
existing Workbench/detail-editor composition. The new Collection setup tab and
collapsed creation template/field disclosures deliberately extend those screens.
The cabinet palette, fonts, sidebar, title scale, corners and optional capture
path remain. No production demonstration records were added.

| State                   | Desktop, 1440 × 900                     | Phone, 390 × 780                      |
| ----------------------- | --------------------------------------- | ------------------------------------- |
| Reusable names          | [Setup](setup-desktop.png)              | [Setup](setup-phone.png)              |
| Save setup preview      | [Template](save-template-desktop.png)   | [Template](save-template-phone.png)   |
| Creation preview        | [Choose template](template-desktop.png) | [Choose template](template-phone.png) |
| Explicit field addition | [Details](suggested-desktop.png)        | [Details](suggested-phone.png)        |
| Template-only restore   | [Restore](restore-desktop.png)          | [Restore](restore-phone.png)          |

All captures were visually inspected. Modal captures use natural internal scroll
positions; controls below the viewport remain reachable by scrolling. Preview
art is authored collection artwork or a monogram, never an uploaded private cover.
Existing full-width Unicode spelling in an item field stays unchanged while
normalized identity prevents adding a second equivalent suggested name.

The full browser regression passed 111 journeys. Sixteen cover setup save,
record preservation, draft recovery, revision conflicts, duplicate validation,
lost-response retry identity, creation replacement/cancellation/removal, blank
field addition, field capacity, account isolation, template-only restore and
failed template loading with name-only creation still available. Reflow checks
cover 320/430/768px, with reduced motion and Axe checks in the main journeys.

Real D1 tests cover ownership/origin, strict projection, identical/concurrent
retries, deleted-template tombstones, concurrent capacity, whole-restore rollback,
old backups, template-only restore and all-data deletion. All 110 core tests and
the production build passed. No remote CI or deployment was run on this local branch.
