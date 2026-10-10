# Worth voice

Worth is cute, relaxed, opinionated, and dry. The humor should be visible in the interaction,
not hidden in several lines of tasteful marketing copy. Say less and show the reaction.

## Current direction

The personal calls are **Favorite / Meh / Not again**, with a separate no-call state.
Pair them with a smile, a half-lidded deadpan face, and a frown. Use softly drawn ivory heads,
ink features, tiny dusty-peach cheek marks, and rounded strokes; butter marks the active state on the dark interface. Opinion slips use a dark filled choice.
Large faces can have little shrug arms. Small row indicators stay compact and can use an
outlined variant. The tone stays deadpan even when the drawing is cute. No yellow platform
emoji, glossy effects, scores, or mascot chatter.
The neutral face and its occasional caption `It was a thing.` carry the joke.

`Meh` means someone deliberately chose a neutral opinion. It never means they forgot to
choose, never comes from rank, and never automatically applies to an unranked record.
`Not again` is the shorter display label for the existing Would not again meaning.

## Copy in the current product

| Location                  | Exact copy                                      |
| ------------------------- | ----------------------------------------------- |
| Landing headline          | For the good. And the meh.                      |
| Product line              | Keep what you try. Find what’s worth repeating. |
| Signup action             | Start your archive →                            |
| Personal calls            | Favorite / Meh / Not again                      |
| Neutral aside             | It was a thing.                                 |
| Collection capture helper | Rank later. No rush.                            |
| Capture action            | Keep it                                         |
| Selected-row actions      | Rank / Note / Revisit / Details →               |
| Archive heading           | The archive.                                    |
| Landing footer            | Meh is a complete sentence.                     |

Use the neutral aside sparingly. It is interface copy, not a note to save on the person's
record. Remove the earlier character-development pitch, Research. Allegedly. description,
long privacy asides, and repeated explanations from primary screens.

## Working rules

- Use short, plain labels. Humor comes from the actual reaction and expression.
- Keep Sign in, Keep it, Search, Filter, and sharing actions clear.
- Personal calls remain optional, reversible, and independent of rank.
- Preserve user-written descriptions, notes, and item names; never replace them with a joke.
- Errors, account access, privacy explanations, deletion, and share confirmations stay factual.
- Joke about subjective taste, not the person, their body, spending, or activity level.
- Avoid motivational praise, streak language, puns everywhere, or jokes on every row.
- Do not explain the joke underneath it.

Signed-out examples stay explicitly labeled EXAMPLE. Signed-in mocks use demonstration
fixtures; the running archive must use real records and keep a useful empty state.
No-call can be represented by a quiet dash or omitted call indicator, never the Meh face.
Generic category objects can have cute faces as illustration, but they must not acquire a
meaningful call without an explicit labeled choice. Activity logs do not gain item-call icons
just to decorate a row.

## Current implementation

The app saves `favorite`, `meh`, `would_not_again`, and `null`. Migration 0005 preserves
existing calls, ranks, logs, and photos. Selecting the active choice again clears it.

The user's latest direction removes the repeated `Private by default.` tagline. The signed-in
footer contains useful account and legal links. Explain visibility where someone shares,
exports, or uploads a photo; do not repeat privacy as a marketing slogan. The product
line above describes what someone can keep and why they would return to it.
The latest taste cabinet pass uses `For the good. And the meh.` and `Meh is a complete sentence.`
on the landing. Selected call captions are `Yes, again.`, `It was a thing.`, and `Once was plenty.`.
They are interface copy only, never notes saved onto a person's record. Show one caption for
the active call; avoid turning every row into a joke.

Empty archive: `A clean slate. Suspicious.` with a clear collection/activity action.
Empty collection: `Nothing to judge. Yet.` followed by `Add the first thing you tried. A name will do.`.
Capture stays `Keep it` with `Rank later. No rush.`. Search says `Find that thing.`.
Patterns: `A few patterns. No personality diagnosis.`. Call breakdown: `Mixed feelings, on record.`.
Private ranked display: `In your very particular order.`. Share controls and visibility stay factual.
The humor is understated; avoid exclamation marks, cheering, mascot chatter, and random quips.
Current desktop/mobile references are in
[taste cabinet](art/ui-mocks/taste-cabinet/README.md).

The selected opinion slip shows one large face and one caption. The three call buttons use
plain labels, avoiding repeated illustrations. No-call says `Undecided.` / `No opinion required.`
and does not display a reaction face. Archive aside: `Opinions may vary. Yours, mostly.`.

## Cute refinement

Keep the accepted taste cabinet composition. The shared faces now have softly oval ivory heads,
slightly fuller blush and rounded features. Favorite has contented smile eyes and a tiny blush
heart on its large opinion face. Meh gives a small, half-hearted shrug; Not again has a shallow
unimpressed frown and resting arms. Compact row faces omit hands and the heart.

A changed opinion gives the large face one small settling motion. A pointer hover adds a slight
tilt; reduced motion disables both. There is no repeating animation or added mascot copy.
No-call still has no face, and all choices keep their plain labels and existing meanings.
