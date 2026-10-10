# Worth mock generation — visual calls revision

Generated with the built-in imagegen tool. All five retained images were visually inspected for legible text, visible call states, increased visual content, reduced prose, and desktop/mobile composition. Earlier versions remain for comparison. This is a mock and design-contract revision; the application code and schema were not changed.

The proposed calls are Favorite / Meh / Not again, plus no call. `Meh` is a new explicit neutral state. `Not again` is the shorter display label for the existing `would_not_again` value. The app currently accepts only favorite / would_not_again / null; implementation must add the neutral value with a migration and validation updates before these controls can be shipped.

The archive reuses existing starter cover references. The home output omits the requested printed EXAMPLE label; its records are nevertheless mock-only fixtures. The mobile landing retains one concise example specimen. The mobile collection fits its secondary actions in one row at this width; they should wrap at narrower widths.

## Visual landing — desktop

Output: `worth-landing-desktop-v2.png`

References (style/content, not files to overwrite):

- Image 1: `art/ui-mocks/worth-landing-desktop-v1.png`

```text
Use case: ui-mockup. High-fidelity implementation-ready Worth mock, flat screenshot no browser/device chrome. Private archive for things tried, kept, ranked and revisited. Stylish nonchalant dark editorial UI with more VISUAL communication and MUCH LESS copy than reference. Flat warm near-black #0d0d0e, warm ivory #f4f0e9, gray #a6a29b, rust #a63d38 for selected state and primary action. DM Sans bold grotesk headings and restrained DM Mono metadata. Thin precise rules, mostly square corners. No glossy bento dashboard, charts, scores, stars as ratings, gradients, textures, social metrics, streaks, fake testimonials or decorative paragraphs. Readable real text only.
Key visual motif: three SIMPLE LINE FACE ICONS with a tasteful deadpan expression, like drawn geometric interface glyphs, NOT yellow emoji, stickers, cartoon mascots or glossy 3D. Smile for "Favorite"; half-lidded eyes and straight mouth for "Meh"; small frown for "Not again". These are three discrete optional personal calls, not numerical ratings, inferred rank, or a slider. The "Meh" choice is visibly selected with rust on the example. It means a chosen neutral response, distinct from no call. Humor is visible in the expressive neutral glyph and the short line "It was a thing." No long explanations.
Input image 1: old landing is STYLE REFERENCE ONLY. Create a materially more visual and less wordy NEW desktop landing, landscape16:10, equivalent1440x900. Keep dark brand and type, but redesign the hero.
Header at y35: small "worth" left, "Sign in →" right, thin rule. Hero at y140..570 is a striking two-column composition. Left at x60..610: giant ~112px lowercase "worth" wordmark, below short headline ~46px "Good. Meh." / "Not again." Only one short sentence below, 16px "Keep what you tried." A rust square-corner CTA "Start your archive →". No former character-development paragraphs or privacy aside block.
Right at x730..1370: a BIG minimal visual demonstration of the three personal calls, dominating about HALF OF THE HERO. Three thin-outline expressive faces on one baseline, smile left about105px, deadpan middle about180px, frown right about105px. Middle face is larger and outlined in muted rust. The faces connect to a thin categorical baseline with tiny markers; no arrow, score, slider knob or numeric axis. Beneath each face exact clear label "Favorite", "Meh", "Not again". Beneath central Meh only a dry tiny caption "It was a thing." Add three tasteful small ivory line-art category objects above or behind the baseline: wine glass, cinema ticket, takeaway coffee cup, arranged with generous whitespace; they are generic illustrations, not photos or personal records. Clear label over the whole diagram "YOUR CALL / EXAMPLE". The expression is the joke; make it very deadpan with slightly lowered eyelids and perfectly flat mouth. No emoji-style color fill.
Bottom proof at y640..820: small "COLLECTION / EXAMPLE" and "Drinks". Under it three horizontally arranged open specimen columns with THIN separating rules, no filled cards. Each has one clear item silhouette (wineglass, highball glass, coffee cup) about64px, small ordinal01/02/03, item name exactly "Dry Riesling", "Highball", "Cold brew", and tiny face+call labels respectively "Favorite", "Not again", "Meh". These calls are independent of ranking. No extra descriptions, dates or fabricated notes. Thin footer rule; bottom left "Private by default.", bottom right "COLLECT · LOG · RANK". Strong whitespace, controlled asymmetry and crisp legible minimal text.
```

## Visual collection — desktop

Output: `worth-collection-desktop-v4.png`

References (style/content, not files to overwrite):

- Image 1: `art/ui-mocks/worth-collection-desktop-v3.png`
- Image 2: `art/ui-mocks/worth-landing-desktop-v2.png`

```text
Use case: ui-mockup. High-fidelity implementation-ready Worth mock, flat screenshot no browser/device chrome. Private archive for things tried, kept, ranked and revisited. Stylish nonchalant dark editorial UI with more VISUAL communication and MUCH LESS copy than reference. Flat warm near-black #0d0d0e, warm ivory #f4f0e9, gray #a6a29b, rust #a63d38 for selected state and primary action. DM Sans bold grotesk headings and restrained DM Mono metadata. Thin precise rules, mostly square corners. No glossy bento dashboard, charts, scores, stars as ratings, gradients, textures, social metrics, streaks, fake testimonials or decorative paragraphs. Readable real text only.
Key visual motif: three SIMPLE LINE FACE ICONS with a tasteful deadpan expression, like drawn geometric interface glyphs, NOT yellow emoji, stickers, cartoon mascots or glossy 3D. Smile for "Favorite"; half-lidded eyes and straight mouth for "Meh"; small frown for "Not again". These are three discrete optional personal calls, not numerical ratings, inferred rank, or a slider. The "Meh" choice is visibly selected with rust on the example. It means a chosen neutral response, distinct from no call. Humor is visible in the expressive neutral glyph and the short line "It was a thing." No long explanations.
Input image1: old desktop collection is LAYOUT/STYLE REFERENCE. Create an updated1440x900-equivalent16:10 mock preserving the 220px app rail and dark ranked workspace, but materially reduce prose and ADD useful visual glyphs.
Rail: large lowercaseworth, nav Archive, Collections(selectedrusthairline), Activity, Patterns, Search. Lowerlinks Drinks(selected), Movies, Places. Bottom Private bydefault and+Add, retain readable actual spacing.
Main x280..1380. Big "Drinks" title about80px at y40, small "COLLECTION / EXAMPLE" above, compact "8 items · 5 ranked" below. DELETE "Research. Allegedly." description and all explanatory footer prose. Right upper quietShowlist andShare controls beside a small refined category line illustration: two ivory outlined drinks glasses with one rust liquid line, around100px wide. This is a category glyph, not a user photo or advertising.
Prominent capture input at y215 exactplaceholder "What did you try?" with rust "Keep it →" button. Below only tinyhelper "Rank later." and right "Add several".
At y330 browse subrail with Show, All8(selected), Kept2, Revisited3, Not openedlately; main indexhasYOURINDEXandcompactSearch/Filtercontrols.
Rows: 01 Booker's Bourbon /Whiskey with smileglyph+Favorite at far right;02 HighlandPark12 /Whiskey with no call;03 Lagavulin16 /Whiskey SELECTED with rustlefthairline and deadpanglyph+"Meh" at right;04 Barolo /Wine with smile+Favorite;05 Chablis /Wine with frown+Notagain. Format actual names with spaces and correct spelling. Names24px, typequiet11px, rowheightabout64px.
Underselectedthirdrow a SINGLE inline expanded tray in normalflow, no editoroverlay. CaptionYOURCALL. Three compact icon-and-text options laidouthorizontally, each about120x64px: [smiling face / Favorite], [deadpanface / Meh], [frownface / Not again]. CenterMehselected usingrustoutline andlabel. These are clickable discrete controls with clearlyreadablelabels, NOT numeric scores. Only centeroption has tinycaption "It was a thing." belowinside its area. Under choices onequietrow of compact textactions "Rank", "Note", "Revisit", "Details →". Other rows have NO visible actiontrays.
Afterrankedrows one"UNRANKED · 3" heading and quietrows emdash/Sancerre/Wine;emdash/WildTurkey101/Whiskey;emdash/Riesling/Wine. Verticalscroll permitted. Smallfooteronly"8 items". No paragraphhelper, no status charts, no every-row dropdown, no charts, no photos. Thecallglyphs should make the screen visually distinctive and the humor instantly legible while retaining the useful rank index.
Input image2 is the new face-glyph style reference: match the precise three expressions, particularly the half-lidded deadpan Meh face. Do not copy the public hero into the private collection. Exact names, with spaces: "Booker's Bourbon", "Highland Park 12", "Lagavulin 16", "Barolo", "Chablis", "Sancerre", "Wild Turkey 101", "Riesling". Exact call labels: "Favorite", "Meh", "Not again". Exact helper: "Rank later.". Keep the call controls clearly labeled, and Meh selected.
```

## Visual archive home

Output: `worth-archive-home-v5.png`

References (style/content, not files to overwrite):

- Image 1: `art/ui-mocks/worth-archive-home-v4.png`
- Image 2: `public/art/starter-covers/drinks-v1.webp`
- Image 3: `public/art/starter-covers/movies-v1.webp`
- Image 4: `public/art/starter-covers/places-v1.webp`

```text
Use case: ui-mockup. High-fidelity implementation-ready Worth mock, flat screenshot no browser/device chrome. Private archive for things tried, kept, ranked and revisited. Stylish nonchalant dark editorial UI with more VISUAL communication and MUCH LESS copy than reference. Flat warm near-black #0d0d0e, warm ivory #f4f0e9, gray #a6a29b, rust #a63d38 for selected state and primary action. DM Sans bold grotesk headings and restrained DM Mono metadata. Thin precise rules, mostly square corners. No glossy bento dashboard, charts, scores, stars as ratings, gradients, textures, social metrics, streaks, fake testimonials or decorative paragraphs. Readable real text only.
Key visual motif: three SIMPLE LINE FACE ICONS with a tasteful deadpan expression, like drawn geometric interface glyphs, NOT yellow emoji, stickers, cartoon mascots or glossy 3D. Smile for "Favorite"; half-lidded eyes and straight mouth for "Meh"; small frown for "Not again". These are three discrete optional personal calls, not numerical ratings, inferred rank, or a slider. The "Meh" choice is visibly selected with rust on the example. It means a chosen neutral response, distinct from no call. Humor is visible in the expressive neutral glyph and the short line "It was a thing." No long explanations.
Input image1: existingarchive STYLE/LAYOUTreference. Images2,3,4: EXISTING optional startercollectioncoverart forDrinks,Movies,Places. Reuse these ONLY ascollectioncovers in this private mock; do not pretendthey are usermemoryphotos. This mockcontains clearlylabeledEXAMPLErecords.
Create updateddesktop16:10 equivalent1440x900. Same220pxnavrail, darkwarmcolors, boldsanswordmark, thinrules. PreserveArchiveactive, othernav, bottomAdd.
Main contentx280..1380. Topdate"THURSDAY, OCTOBER8", large"Lately."about80px, small"EXAMPLE RECORDS"label, rightSearchyourrecords. Remove the"A few things happened"andlongfooterasides.
Add directlybelowtitle a smallHORIZONTAL calllegend with the3refinedfacelineglyphs:smileFavorite /deadpanMeh /frownNotagain. Smalllabel"YOUR CALL" and no percentagesorcounts. This is a visuallegendofmeaningfulstates, not analytics or proposedrecommendation.
Main middlehas a wideleft"Recent"index andnarrowright"Shortlist"with a simpledivider. Recent only FOURcalmrows:OCT08 Morningrun /Running ·5.2mi; OCT07 Booker'sBourbon /Drinks withsmileFavoriteglyph; OCT06 PerfectDays /Movies withdeadpanMehglyph; OCT05 Cornertable /Places. Correctspacing in names. No inventedphotosinrows, no everyrowminiparagraph. RightShortlist small"RANKED WITHIN DRINKS",01Booker'sBourbon,02HighlandPark12,03Lagavulin16;then small"Lastdone"withHaircut/5daysago.
Lowerthirdaroundy650show"Your lists"as a PHOTO/COVERSTRIPthatrunsacrosscontent:3landscapecollectioncoverpanels,160pxhigh, withtheEXISTINGreferencephotos:Drinkswhiskeyglass,Moviescinema,Placesdiner. Overlayonlylegiblelargecollectionnameanditemcountonbottomsolidcharcoalcaptionorjustbelowimages, respectivelyDrinks8items,Movies12items,Places6items. Smallsharedcaption"STARTER COVERS" makes theirroleclear. Uploadedpersonalcollectioncoverswouldreplace theseinrealapp; thismockusesbundledart. No roundedcards, nofakecameraiconsorpersonalphotoattribution. Letvisualsbreakupthetextwhilepreserving usefulcatalogspacing. Footeronly"Private bydefault."
Exact strings, always normal word spacing: "Private by default.", "Morning run", "Booker's Bourbon", "Perfect Days", "Corner table", "Highland Park 12", "Lagavulin 16", "Haircut", "5 days ago", "Your lists", "STARTER COVERS". The upper face legend is not a chart or score; keep it small. Use "Favorite", "Meh", "Not again" exactly.
```

## Visual landing — mobile

Output: `worth-landing-mobile-v2.png`

References (style/content, not files to overwrite):

- Image 1: `art/ui-mocks/worth-landing-desktop-v2.png`

```text
Use case: ui-mockup. Create a high-fidelity MOBILE version of the reference Worth landing page. Image1 is STYLE AND CONTENT REFERENCE. Flat portrait 1:2 screenshot equivalent390x780, no deviceframe/browserchrome.
Preserve flat warmnearblack #0d0d0e, ivory #f4f0e9, gray #a6a29b, rust #a63d38, DM Sans grotesk and smallDM Mono, thinrules, squarecorners. Properlegiblewordspacing. No gradient,grain,serif,photos,charts or bento.
Make it MUCH LESS WORDY than the older mobile landing. Header smallworthleft / Signin→right, rule. Below at y105 large "worth" about74px, then clear headline "Good. Meh. Not again." in roughly32px over2lines. No long productparagraph. Underheadline small "Keep what you tried.".
At y275..485 a widevisualgroup ofTHREE minimalist linefaces from desktop, label above "YOUR CALL / EXAMPLE". Smileabout64px / label "Favorite"; half-lidded deadpanmiddleabout100px outlinedrust / label "Meh"; frown64px /label "Not again". Matchthe referenceglyphs exactly, NOTemoji/stickers. Middledeadpanface has tinycaption "It was a thing.". Theseare3discretecalls, notscores. At y525 one48px-tall fullwidthrust "Start your archive →" action. Generousspace butCTAandfacesmust fitabovefirstfold.
Below y600 ruleandsmall "COLLECTION / EXAMPLE", heading "Drinks". Beginrankedgenericexamplewith01 smallwineglassglyph / "Dry Riesling" / smile+"Favorite". Rows02 "Highball" /frown+"Not again" and03 "Cold brew"/deadpan+"Meh" continueBELOWFOLD, withfooter"Private bydefault."below. Do not cram3rowsorprivacyparagraphintophoneviewport. The visualgroup, expressions and clearlabels carrythe message. Correctwordspacing exacttext "Sign in →", "Keep what you tried.", "Private by default.". No duplicatedheroheadingsorcopy, no clipping text, no fakeuserdata.
Use normal spaces in every phrase. Exact heading "Good. Meh. Not again." and exact functional CTA "Start your archive →". Keep the neutral face expression identical to the desktop reference: horizontal upper eyelids, round lower eye shapes, flat mouth, outlined circle. Maintain the dry caption beneath it.
```

## Visual collection — mobile

Output: `worth-collection-mobile-v4.png`

References (style/content, not files to overwrite):

- Image 1: `art/ui-mocks/worth-collection-desktop-v4.png`

```text
Use case: ui-mockup. High-fidelity MOBILE adaptation of this Worth collection reference, flatportrait1:2 screenshot equivalent390x780. Image1 is desktopSTYLEANDCONTENTreference. No deviceorbrowserchrome.
Keep darkwarmnearblack, ivory, gray, mutedrust, DM Sans and DM Mono, thinrules, boldnames, squarecontrols. Use normalwordspacingandlegibletext. No gradients,gloss,serif,photographyorcharts.
24pxsidemargins. Header smallbold "worth" left andaccessiblemenuiconright, thinrule. Smalloverline "COLLECTION / EXAMPLE", large52px "Drinks", compact "8 items · 5 ranked" andquiet "Show list →". Add smallgenericwineglass/highballlineglyph in titlearea ifroom; doNOT displacecaptureorwriteadparagraph. No "Research. Allegedly."description.
Captureline at y205 input "What did you try?" + rust "Keep it" action, below tiny "Rank later." andright "Add several".
Horizontalbrowsestrip All(active) / Kept / Revisited / Notopenedlately, spellingcorrectly "Not opened lately". Then YOURINDEXwithSearchandFilter.
Firstrow 01 "Booker's Bourbon", smallWhiskey, smallsmileicon+"Favorite" onright orbelowname. Secondrow02 "Highland Park 12", Whiskey, nocall. Thirdrow03 "Lagavulin 16", Whiskey, selectedwithrustleftlineanddeadpanglyph+"Meh".
Expandonlythirdrowinline, normaldocumentflow. Label"YOUR CALL". Three EQUALWIDTH choices acrossavailablewidth, 44pxminimumtaphit: smallsmilewith "Favorite"; deadpanrustfacewith "Meh" selected; smallfrownwith "Not again". Cleartextlabels essential iconsaredecorative/secondary. Underoptionsonecentraltinyline "It was a thing.". Underthat 2x2touchfriendlyactiongrid "Rank", "Note", "Revisit", "Details →". Indexscrolls;row04Barolocanbeginbelowfold. No everyrowforms, no tooltipwords, no decorative cardgrid, no inventedmetrics. Keep facechoicescrisp, dryandobviouslyfunctional. Required exacttextwithnormalspacing: "Show list →", "What did you try?", "Keep it", "Rank later.", "Add several", "YOUR INDEX", "Search", "Filter", "YOUR CALL", "Favorite", "Meh", "Not again", "It was a thing.".
```
