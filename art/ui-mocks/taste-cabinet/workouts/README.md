# Workout sessions — October 10

The user approved workout sessions and last-time comparison as the next product step. These standalone references were rendered and inspected before implementation.

- [Sessions desktop](sessions-desktop.png) / [mobile](sessions-mobile.png): dated, named visit cards with real exercise/set/rep totals, an exercise index, Add exercise and Edit workout. Existing ungrouped logs remain separate.
- [Comparison desktop](comparison-desktop.png) / [mobile](comparison-mobile.png): existing activity editor, workout selector and previous sets above current entry fields.

Keep the cabinet fonts, dark canvas, 192px navigation and 22px cards. Production retains its existing header, latest-activity recall and working filters. New workout sits above those filters; no title/header redesign is intended. Cards use 28px desktop / 22px by 18px mobile padding and 28px/26px headings. Desktop puts Edit workout beside the heading; mobile stacks it. New workout uses the existing native scrolling modal.

The implemented comparison deliberately puts each corresponding previous set directly below its current fields, so it stays visible while entering numbers. Its panel summarizes the last entry and offers all previous sets in a disclosure, plus explicit Use previous sets. Original units remain visible; replacing filled draft sets confirms the change. Dates follow the chosen workout. Sessions are separate visits, even on the same day, rather than inferred date groups. Existing entries stay ungrouped until explicitly assigned.
