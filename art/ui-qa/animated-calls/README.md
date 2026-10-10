# Animated calls

The user asked for more animation after accepting the soft character direction. Each large call now has its own arrival: Favorite hops and waves, Meh slumps and shrugs, and Not again wobbles reluctantly. Favorite's heart floats into place. Two slow blinks finish within 4.8 seconds, then the character rests. Hover adds a slight lean and raised hands; choices compress gently on press.

[Watch the interaction recording](call-reactions.mp4).

All animations are finite. Reduced motion disables every character animation and hover transform, including hands, eyes and heart. Small row indicators stay static, and no-call remains faceless. No layout or copy change was needed for this animation pass.

## Captures and checks

- [Landing, desktop](landing-desktop.png) and [mobile](landing-mobile.png)
- [Collection, desktop](collection-desktop.png) and [mobile](collection-mobile.png)
- [Browser results](qa-result.json)

Chrome verification samples actual animation poses and blinking eye transforms for all three calls, confirms finite durations under five seconds, and checks reduced motion, clearing a call, static row badges and a single visible slip. Reflow passed at 1440, 390, 320, 430 and 768px. No runtime errors occurred. Signed-in captures use browser-only fixtures, with no database writes.

The three existing call/editor tests, TypeScript, production build and formatting passed. Desktop and mobile captures retain the current reference composition. The shared reference HTML/CSS includes the same motion; reference PNGs show resting poses.
