# Editorial cute refinement

The user asked for a more current and tasteful 2026 direction. This revision uses matte butter, sage and clay characters, finer features and gestures, faint blush, short rounded feet and a small warm heart. Body outlines now match the fill. One inset capsule groups the three call choices, retaining a clear dark selected segment.

The design is an interpretation of the interest in human imperfection, structured simplicity and purposeful motion described in [Canva's 2026 report](https://www.canva.com/design-trends/) and [Adobe's motion principles](https://spectrum.adobe.com/foundations/behavior/motion). Those references inform the direction; the exact palette, drawings and interactions are Worth-specific choices.

Arrival motion is gentler over 800ms. Favorite waves once, Meh shrugs, Not again wobbles, and one slow blink settles within 3.2 seconds. Small badges remain static. Reduced motion disables character movement and hover transforms. Calls remain optional and reversible, independent of rank; no-call stays faceless.

[Watch the refined reactions](call-reactions.mp4).

## Captures

- [Landing, desktop](landing-desktop.png) and [mobile](landing-mobile.png)
- [Favorite, desktop](landing-favorite-desktop.png) and [mobile](landing-favorite-mobile.png)
- [Not again, desktop](landing-not-again-desktop.png) and [mobile](landing-not-again-mobile.png)
- [Collection, desktop](collection-desktop.png) and [mobile](collection-mobile.png)
- [Archive, desktop](archive-desktop.png) and [mobile](archive-mobile.png)
- [Patterns, desktop](patterns-desktop.png) and [mobile](patterns-mobile.png)

## Verification

Chrome checks passed at 1440, 390, 320, 430 and 768px. Actual animation transforms, finite durations, blinking, reduced motion, static row badges, clearing a call and one visible slip were verified. No horizontal overflow or runtime errors occurred. Signed-in captures use browser-only fixtures; no database writes were made. See [browser results](qa-result.json).

The three existing personal-call/editor tests, TypeScript check, production build and formatting passed. Updated reference captures and app captures were inspected for consistency. The segmented track intentionally adds 8px to the call control height; the established composition, fonts, meaningful labels and data behavior are preserved.
