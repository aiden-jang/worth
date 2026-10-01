# Worth design direction

Worth is a private record of what someone tried, did, kept, and decided not to repeat. It is not a social feed, a productivity game, or a polished version of someone else's life.

The product has three jobs:

- **Collect** things worth finding again.
- **Log** what happened with enough context to make it useful later.
- **Rank** what held up, what did not, and what to revisit.

## Core idea

The central interaction is a personal measure of value. A person can rank a wine, a movie, a restaurant, a car, or any other collection item without pretending those rankings are objective.

The same collection can show both ends of the scale:

- **Favorite right now** for what they would choose again.
- **Least likely again** for what they would skip next time.

Neither label deletes the record. Keeping a disappointing experience is useful context, especially when choosing again later.

Use "worth" as a question, not a claim: what was this worth to the person who logged it?

## Signed-out landing page

The landing page should have one visual idea: a horizontal value meter passing through the large `worth` wordmark.

The meter has two small endpoints:

- A muted rust point for **Favorite right now**.
- A warm ivory point for **Least likely again**.

The page contains only:

1. The `WORTH` wordmark and a sign-in link.
2. The meter and its two endpoint labels.
3. `Keep the things worth keeping.`
4. One primary action: `Start your archive →`.
5. A quiet footer line for `COLLECT`, `LOG`, and `RANK`.

The meter may react to hover or keyboard focus, but it should not turn into a demo or a carousel. Signed-out content is illustrative and generic. Do not show fake profiles, fake photos, fabricated personal histories, or a sample activity feed.

## Signed-in home

The home screen uses the same dark surface, thin rules, warm type, and one rust active state. It is a private workspace, not a hero page.

- Left rail: Today, Collections, Activity, Ranked, Shared.
- Main area: one day or date-led activity rail made from the user's actual records.
- Right rail: a short ranked list from the user's collections.
- Bottom: low-key totals or recent activity, only when real data exists.

Empty states should explain the first useful action. They should not manufacture a busy dashboard.

## Visual rules

| Use        | Direction                                                                  |
| ---------- | -------------------------------------------------------------------------- |
| Surface    | Near-black `#0d0d0e` with charcoal secondary surfaces                      |
| Type       | Warm ivory `#f4f0e9`, muted stone gray for secondary text                  |
| Accent     | Muted rust `#a63d38` for selection, one primary action, and meter state    |
| Typography | Modern grotesk for interface and hierarchy; no display serif for hero copy |
| Layout     | Asymmetric grid, generous negative space, precise hairline rules           |
| Shapes     | Mostly square corners; use rounding only when a control needs it           |
| Motion     | Small state changes, no staged reveal sequences or decorative parallax     |

## Avoid

- Green accents, neon color, blue gradients, glassmorphism, or glossy effects.
- Paper textures, fake film grain, vintage archive styling, and decorative material panels.
- Generic rounded SaaS cards, bento grids, or dense dashboard widgets.
- Fake photos, stock lifestyle scenes, testimonials, streaks, or social mechanics.
- Oversized slogans that explain every feature at once.

## Implementation checks

Before changing a primary page, verify that:

- The ranking system is visible where it helps, but does not force a score on every record.
- The screen still reads clearly with no photos, no rankings, or no activity yet.
- The page has one obvious primary action.
- Rust indicates meaningful state, not decoration.
- The layout remains calm at desktop and mobile widths.
