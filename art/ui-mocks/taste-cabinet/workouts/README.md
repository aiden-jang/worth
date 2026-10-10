# Workout sessions — October 10

The user approved workout sessions and last-time comparison as the next product step. These standalone references were rendered and inspected before implementation.

- [Sessions desktop](sessions-desktop.png) / [mobile](sessions-mobile.png): dated, named visit cards with real exercise/set/rep totals, an exercise index, Add exercise and Edit workout. Existing ungrouped logs remain separate.
- [Comparison desktop](comparison-desktop.png) / [mobile](comparison-mobile.png): existing activity editor, workout selector and previous sets above current entry fields.

Keep the cabinet fonts, dark canvas, 192px navigation and 22px cards. Production retains its existing header, latest-activity recall and working filters. New workout sits above those filters; no title/header redesign is intended. Cards use 28px desktop / 22px by 18px mobile padding and 28px/26px headings. Desktop puts Edit workout beside the heading; mobile stacks it. New workout uses the existing native scrolling modal.

The implemented comparison deliberately puts each corresponding previous set directly below its current fields, so it stays visible while entering numbers. Its panel summarizes the last entry and offers all previous sets in a disclosure, plus explicit Use previous sets. Original units remain visible; replacing filled draft sets confirms the change. Dates follow the chosen workout. Sessions are separate visits, even on the same day, rather than inferred date groups. Existing entries stay ungrouped until explicitly assigned.

## Reusable routines

[routines desktop](routines-desktop.png) / [mobile](routines-mobile.png) extend the approved session composition. They were authored, rendered and inspected before building routines. Save ordered exercise names, start a new dated visit, then use its unlogged exercise checklist to open the existing set editor. Reps and weights start blank; the existing last-time comparison remains visible. No exercise log exists until Save log succeeds.

Production deliberately retains the existing activity header, latest recall and filters. Routine cards use a two-column shelf on desktop and a single column at <=960px to keep multiple saved lineups compact; the reference illustrates one full-width card. New routine sits beside the section label for direct access. Pending names use the same indexed button rows as completed exercise entries, with a labeled Log exercise action. Session counts include only saved entries. Start moves keyboard focus and scroll to the new visit, clearing history filters so it stays visible. Reduced motion makes scrolling immediate.

Routine editing/deletion applies to the saved lineup only. Each visit snapshots names/order, so historical visits survive changes. A matching normalized exercise name in that visit marks a planned name as logged; removing or renaming that entry restores the pending name. Save as routine includes the visit's planned names first, followed by any additional logged exercise names, removing duplicates. The editable draft opens before saving. Routine names and ordered exercises remain owner-scoped and part of records exports.
