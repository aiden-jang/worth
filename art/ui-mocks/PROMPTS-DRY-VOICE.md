# Worth mock generation — dry voice revision

Generated with the built-in imagegen tool. All five retained images were visually inspected for text, contrast, layout, and preserved interaction states. Existing versions remain available for comparison. This revision changes the proposed theme and mock references; it does not implement the running app.

The two landing pages are new screens. The three signed-in screens are constrained copy edits of the earlier mock set. Reference image roles and final prompts are preserved below.

## Signed-out landing — desktop

Output: `worth-landing-desktop-v1.png`

Style reference: `worth-archive-home-v3.png`.

```text
Use case: ui-mockup.
Asset type: high-fidelity signed-out Worth landing-page visual reference, flat desktop screenshot 16:10 landscape, composition equivalent to 1440x900, no device or browser chrome.
Primary request: Worth is a private archive for things tried, collected, logged, ranked and revisited. Create a tasteful, nonchalant, quietly funny landing page. Humor is dry and sparse, an aside rather than a comedy routine. This is a real buildable product page, not concept art.
Input image 1: STYLE REFERENCE ONLY for palette, sans typography, thin rules and understated layout. Create a NEW signed-out page. It must have no signed-in sidebar, personal record feed, account controls or user data.
Visual system: flat warm near-black #0d0d0e, warm ivory #f4f0e9, stone-gray #a6a29b, hairline rules #30302f, muted rust #a63d38 for one CTA and one small meter point. Existing DM Sans modern grotesk, bold large type with tight tracking; tiny DM Mono metadata. Plenty of negative space. Mostly square corners. No serif, imagery, gradients, grain or fake texture.
Layout: 60px outer page margins. Slim header top left lowercase bold sans "worth" about28px, right simple "Sign in →", thin full-width rule beneath.
Hero at y120..440 in a wide asymmetrical grid: left large lowercase "worth" around220px tall, occupying about two thirds of width. One precise horizontal hairline passes through the oversized wordmark, with a tiny ivory endpoint on the left and tiny rust endpoint on the right. Place endpoint labels below the ends "Would not again" left and "Favorite" right, 12px monospace. This meter is an editorial metaphor for personal calls, NOT a scored rating control, no numbers, no slider knob.
Right hero block at x960 y150: large ~38px headline broken onto three short lines: "Some things" / "were worth it." Beneath in muted 20px: "Some were character development." Then 16px clear product sentence: "A private archive for what you tried, kept, and would not do again." One solid rust square-corner button "Start your archive →". Quiet 12px aside below "No audience required." Do not invent features or repeat CTAs elsewhere.
Below hero around y500 thin rule and clearly labeled "COLLECTION / EXAMPLE" overline. Section heading "Drinks" at x60, and a quiet contextual note "Entirely subjective." beside it. Wide readable three-row rank-first example index takes left ~760px, exact names "01 Dry Riesling" / "Wine", "02 Highball" / "Whiskey", "03 Cold brew" / "Coffee". Thin horizontal row separators, rank mono, main name22px sans, type muted, no stars/scores/photos. On right x1000 align a compact plain text aside caption "PRIVATE CONTEXT", sentence "Good enough to order twice.", smaller clear explanation "Notes, dates, and photos stay yours." This is generic demonstration context explicitly part of EXAMPLE, not a testimonial or fabricated personal memory.
Footer around y800 one hairline, left "Private by default.", right short separate words "COLLECT", "LOG", "RANK", small mono. Place the quiet brand aside "Your taste. Nobody's business." below privacy if space allows. No feature cards, no fake profiles or stats, no testimonials, no cookie popup, no premium badge, no illustrations.
Require all exact text legible with correct spelling, no overlap, no gibberish. Careful spacing, confident type, dry humor paired with clear utility.
```

## Signed-out landing — mobile

Output: `worth-landing-mobile-v1.png`

Style reference: `worth-landing-desktop-v1.png`.

```text
Use case: ui-mockup.
Asset type: high-fidelity mobile signed-out Worth landing-page visual reference, flat portrait 1:2 image equivalent to 390x780 viewport. No device frame or browser chrome.
Input image 1: desktop landing STYLE AND CONTENT REFERENCE; reflow into this new mobile screen faithfully. Preserve warm dark colors, sans-serif type, dry-humor copy and meter metaphor. No signed-in navigation.
Visual system: flat warm near-black #0d0d0e, warm ivory #f4f0e9, gray #a6a29b, rust #a63d38 one main action, hairline #30302f. DM Sans bold grotesk, DM Mono small metadata. Square corners, no photos, serif, gradient, texture, shadows or cards.
Layout: 24px side margins. Top header at y24 small bold lowercase "worth" left, "Sign in →" right, rule underneath. At y95 huge lowercase "worth" across available width about100px type, one hairline horizontal meter through wordmark, small ivory left endpoint and rust right endpoint. Labels below the ends "Would not again" and "Favorite", small mono.
Below at y250 about28px hero headline "Some things were worth it.", breaking across two lines if needed. At y325 a muted18px aside "Some were character development." Below 14px readable explanation "A private archive for what you tried, kept, and would not do again." At y420 a full width rust 48px tall action "Start your archive →", below small "No audience required.".
At y520 begin a clearly labeled "COLLECTION / EXAMPLE" proof area. Heading "Drinks" about28px and gray caption "Entirely subjective." Three text rows with ordinals "01" / "Dry Riesling" / "Wine", "02" / "Highball" / "Whiskey", "03" / "Cold brew" / "Coffee", clean hairline separators. Rows should be comfortably readable; page scrolls below viewport. If footer is visible at bottom it says "Private by default." The private-context aside and full COLLECT/LOG/RANK footer can continue BELOW fold, not crammed onto this phone screen.
Exact user-facing wording consistent with reference, clear CTA, restrained dry wit, hierarchy and readable controls. No clipping horizontal labels, no duplicate heading, no extra CTA, no invented testimonials or personal data.
```

## Archive home — dry voice

Output: `worth-archive-home-v4.png`

Edit target: `worth-archive-home-v3.png`.

```text
Use case: text-localization.
Asset type: revised high-fidelity desktop Worth archive mock.
Input image 1 is the EDIT TARGET. Keep the entire composition, canvas size, sidebar, modern sans typography, colors, spacing, row data, rank context, controls and rules identical. Do not redesign.
Make only these two copy changes to add sparse nonchalant dry humor:
1. Replace the small "EXAMPLE RECORDS" label beneath the Lately. heading with "EXAMPLE RECORDS · A few things happened." in the same compact metadata style. Keep the example label readable.
2. Replace ONLY the main-content bottom footer "Private by default." with "Private by default. Your taste has no audience." Keep the sidebar footer "Private by default." unchanged.
Keep "Lately.", all section names, dates, data rows, and function labels unchanged. No additional jokes, imagery, texture or ornament. Use flat warm matte background. Text legible, no overlap.
```

## Desktop collection — dry voice

Output: `worth-collection-desktop-v3.png`

Edit target: `worth-collection-desktop-v2.png`.

```text
Use case: text-localization.
Asset type: revised high-fidelity desktop Worth collection mock.
Input image 1 is the EDIT TARGET. Preserve all layout, canvas size, sans typography, sizing, spacing, sidebar, selected third row, inline actions, ranked order, unranked section, warm dark palette and hairline separators. Do not redesign.
Make only these three exact copy changes:
1. Below "Drinks", replace "The ones worth remembering." with "Research. Allegedly." using the same muted sentence styling.
2. Below capture field replace "Rank it later if you want." with "Rank it later. No homework."
3. At index bottom replace "8 items · Ranking is optional" with "8 items · Entirely subjective."
Keep all functional labels unchanged: Keep it, Add several, Search, Filter, Favorite, Would not again, Place in ranking, Add a note, Log revisit, Open details, Show list, Share. Keep all sample records and counts identical. Humor remains sparse; no extra jokes, images or decoration. Legible text, no overlap.
```

## Mobile collection — dry voice

Output: `worth-collection-mobile-v3.png`

Edit target: `worth-collection-mobile-v2.png`.

```text
Use case: text-localization.
Asset type: revised high-fidelity mobile Worth collection mock.
Input image 1 is the EDIT TARGET. Preserve the entire composition and canvas size, header, sans typography, selected third row, personal calls, action grid, capture form, horizontal browse strip, rank data, colors, hairlines and scrolling logic.
Make only these exact copy changes:
1. In the top overline replace "COLLECTION / EXAMPLE RECORDS" with "COLLECTION / EXAMPLE", retaining the same small monospace style.
2. Add a single short muted small description "Research. Allegedly." directly under the large Drinks heading. Reclaim room by a small reduction in the existing surrounding whitespace; keep capture and index positions as close to reference as possible. Do not enlarge the canvas.
3. Below capture replace "Rank it later if you want." with "Rank it later. No homework.", preserving readability alongside "Add several".
Leave every functional label and all item names unchanged. This is the same screen with sparse dry humor. No extra jokes, decorative styling, fields, cards or photos. No text overlap or clipping.
```
