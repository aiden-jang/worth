# Worth design direction

Worth is a private record of what someone tried, did, kept, and decided not to repeat. It is not a social feed, a productivity game, or a polished version of someone else's life.

The product has three jobs:

- **Collect** things worth finding again.
- **Log** what happened with enough context to make it useful later.
- **Rank** what held up, what did not, and what to revisit.

## Capture should stay lightweight

Worth must work for someone who only wants to remember a name and, sometimes, where it stands. The fastest
useful flow is: add a name → optionally rank it → leave. Notes, photos, dates, types, personal calls, and
revisit history are optional layers of context, never requirements for creating or keeping a record.

Every primary screen should preserve this low-effort path. Detail views can invite richer reflection without
making the archive feel like a journal that needs to be filled out.

## Core idea

The central interaction is a personal measure of value. A person can rank a wine, a movie, a restaurant, a car, or any other collection item without pretending those rankings are objective.

Rank order and a personal call are separate. Rank says how items compare. An optional call says whether an item is a favorite or something they would not do again. The app must never infer either call from rank position.

- **Favorite** for what they would choose again.
- **Would not again** for what they would skip next time.

Neither label deletes the record. Keeping a disappointing experience is useful context, especially when choosing again later.

Use "worth" as a question, not a claim: what was this worth to the person who logged it?

## Signed-out landing page

The landing page should have one visual idea: a horizontal value meter passing through the large `worth` wordmark.

The meter has two small endpoints:

- A muted rust point for **Favorite**.
- A warm ivory point for **Would not again**.

The hero contains:

1. The `WORTH` wordmark and a sign-in link.
2. The meter and its two endpoint labels.
3. `Keep the things worth keeping.`
4. One primary action: `Start your archive →`.
5. A short explanation: `A private archive for what you tried, did, kept, and would not do again.`

Below the hero, show one clearly labeled `EXAMPLE` ranked index. It may switch between a collection and an
activity example so visitors can understand the product without an account. It must use generic example data,
not fake profiles, testimonials, photos, usage metrics, or personal histories. The proof section should show
the ranking, a small note about private context, and the difference between a collection and an activity log.

Finish with a quiet privacy line and `COLLECT`, `LOG`, and `RANK`.

The meter remains the hero's visual idea. The example index is a product proof, not a carousel or a separate
feature tour. Signed-out content is illustrative and generic. Do not show fake profiles, fake photos,
fabricated personal histories, or a sample activity feed.

## Signed-in home

The home screen uses the same dark surface, thin rules, warm type, and one rust active state. It is a private workspace, not a hero page.

- Left rail: Archive, Collections, Activity, Patterns, Search.
- Main area: one day or date-led activity rail made from the user's actual records.
- Right rail: a short ranked list from the user's collections.
- Bottom: low-key totals or recent activity, only when real data exists.

Collections are a visual directory once they exist. The optional Drinks, Movies, Places, and Cars starting points
may retain their bundled starter cover. Any personal collection may have one private uploaded cover, which always
takes precedence and is visible only behind the signed-in archive routes. Covers are never included in exports or
public ranking snapshots.

Patterns is a quiet reading of real data: record count, revisits, personal calls, most returned item, newest
collection, and most-kept collection. It must not add scores, streaks, goal-setting, or recommendations.

Empty states should explain the first useful action. They should not manufacture a busy dashboard.

## Data ownership

People can download their lists, items, logs, ranks, and personal calls as JSON. The export is deliberately records-only. Photos remain in Worth and are never represented as a backup.

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
- Fake photos, stock lifestyle scenes, testimonials, streaks, or social mechanics in personal archive screens.
- Treating a starter cover as a user's memory or showing any personal cover outside its protected archive route.

The signed-out introduction may use a clearly labeled editorial illustration. It must never be presented as a
member's record, memory, review, or archive photo.

- Oversized slogans that explain every feature at once.

## Implementation checks

Before changing a primary page, verify that:

- The ranking system is visible where it helps, but does not force a score on every record.
- The screen still reads clearly with no photos, no rankings, or no activity yet.
- The page has one obvious primary action.
- Rust indicates meaningful state, not decoration.
- The layout remains calm at desktop and mobile widths.
