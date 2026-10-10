# Worth — taste cabinet

Current target: [cabinet edition references](edition/README.md). The user approved the broader
art-direction plan after the earlier refinement passes. The edition archive, first-use,
collection and creation references supersede the corresponding earlier images below.
The landing retains its existing signature composition.

October 10 direction: cute, dry, nonchalant and coherent. The user authorized a stronger
redesign after rejecting incremental polish. These standalone compositions were authored
and inspected before changing the app's primary layouts. They are design references, not
production data. The user accepted this direction and asked to build it.

| Screen     | Desktop                              | Mobile                              | Editable source         |
| ---------- | ------------------------------------ | ----------------------------------- | ----------------------- |
| Signed out | [Landing](landing-desktop.png)       | [Landing](landing-mobile.png)       | [HTML](landing.html)    |
| Archive    | [Archive](archive-desktop.png)       | [Archive](archive-mobile.png)       | [HTML](archive.html)    |
| Collection | [Collection](collection-desktop.png) | [Collection](collection-mobile.png) | [HTML](collection.html) |

The reference HTML and app load the same [composition stylesheet](../../../src/cabinet.css).
[build-reference.py](build-reference.py) regenerates the standalone compositions; local bundled
fonts and cover assets keep the references reproducible. Desktop captures are 1440 × 900;
mobile captures use 390 × 780 and natural page scrolling.

The visual idea is a taste cabinet: dark olive, warm paper, butter accents, open shelves and
one opinion slip. Landing copy is `For the good. And the meh.`. The cream slip contains one
large reaction, a short caption and three clearly labeled choices. Archive collections come
first. The collection uses a working list beside a focused selected item, instead of expanding
a dark control box inside a full-width list. Mobile places the same slip below the selected row.

This deliberately replaces the old rust palette, small framed landing demo, recent-first home,
full-width collection and repeated face buttons. Sans-serif typography, dark canvas, navigation,
lightweight capture and all product semantics remain. Older references are historical.

The static compositions use demonstration fixtures. Actual titles, ranks, counts, timestamps
and account names vary in the app. Production keeps working navigation icons, export/account
links and real settings controls even where the static reference simplifies those affordances.
Uploaded personal covers remain available and take precedence; the collection header shows
an optional private cover rather than invented category art. Empty and no-call states stay useful.

See [build contract](../BUILD-CONTRACT.md), [voice](../../../VOICE.md) and
[working captures](../../ui-qa/taste-cabinet/README.md) for implementation verification.

The subsequent cute pass preserves these compositions and updates the shared face family:
soft oval heads, fuller cheeks and small hands on the large opinion face. Favorite gets
smile eyes and a tiny blush heart; Meh shrugs; Not again keeps a gentle unimpressed frown.
The app adds a single settling reaction with reduced-motion support. See
[cute pass verification](../../ui-qa/cute-pass/README.md).

The second cute pass replaces oval heads with distinct soft character silhouettes and tiny
feet on large reactions. Cream cards/dialogs use 22px corners, shelf images 16px, and call
choices use capsules. Larger verdict art intentionally adds a little vertical space. The
composition and concise copy remain consistent. These reference renders reflect that revision;
see [soft character verification](../../ui-qa/soft-characters/README.md).

Large opinion characters now have distinct finite arrival animations, a shrug/wave, a
floating Favorite heart, and two slow blinks. They settle within five seconds. These static
references show resting poses; the same shared CSS animates the HTML references and app.
See [motion verification and recording](../../ui-qa/animated-calls/README.md).

The current editorial cute refinement uses matte butter, sage and clay characters with
finer ink gestures and no contrasting body outline. A single inset capsule replaces the
three outlined call buttons. Smaller reactions and one slow blink settle within 3.2 seconds.
Reference PNGs and HTML reflect this revision. See [verification](../../ui-qa/editorial-cute/README.md).

The latest signature composition puts a straight, larger opinion card beside the landing
headline and moves the example index underneath the introduction. Mobile shows signup,
opinion card, then index. The selected call slides inside its capsule, with immediate
changes under reduced motion. See [signature verification](../../ui-qa/signature/README.md).

The everyday interaction pass aligns capture corners to 12px and keeps selected rows raised
on hover. Focus, confirmation and link reactions preserve the resting compositions. See
[interaction verification](../../ui-qa/interaction-polish/README.md).
