# Worth UI mocks

These are product-direction references, not screenshots to reproduce literally. The generated photos and entries are sample content. The app should display users' own uploads and records, not ship these images as catalog data.

- `worth-archive-home-v2.png`: preferred signed-in archive direction, with one photo, text-led recent entries, and last-time reminders.
- `worth-archive-home-v1.png`: earlier, more image-heavy home exploration. Keep it for comparison, not as the primary build reference.
- `worth-drinks-list-v1.png`: a list with filters and an item's repeat history.
- `worth-drinks-ranked-compact-v1.png`: a denser, ranked collection view. The mock shows 12 visible rows from a longer scrollable list, not a 12-item limit.
- `worth-drinks-show-list-mobile-v1.png`: a clean top-five view to show someone in person. Sharing from it still needs an explicit preview and confirmation.
- `worth-quick-add-mobile-v1.png`: a quick-add form for a run.

Keep the editorial typography, warm ivory/ink palette, muted rust accent, clear hierarchy, and thin rules. The dark archive surface can lead into lighter list and capture surfaces. Don't copy generated text, dates, or control placement without testing them. In particular, the home screen must work when an account has no photos.

## Ranking direction to confirm

Rank is an optional, manually set order within one list. It is not a global score across unrelated records. Sorting by a field must never rewrite that saved order. All items, including unranked ones, stay accessible in Gallery, List, and Compact views. Compact mode should show the full filtered collection in one scrollable table without forced pagination. A public share should contain only the selected list and range, with private notes, dates, and locations excluded unless explicitly chosen in a preview. The in-person Show list view should work without publishing a link.

## Generation prompts

Built-in image generation was used for all four saved mocks. An earlier mobile render was discarded because the text contrast was broken.

### Archive home

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web app mockup, 16:10 landscape, full-page flat screenshot with no browser chrome or device frame.
Primary request: Design the signed-in home screen of WORTH, a private life log for things someone tried, watched, did, owned, and wants to remember. It is not a finance app, social feed, daily diary, or streak tracker. This must look like a buildable 2026 product interface, not concept art.
Style: independent editorial magazine meets useful personal archive. Confident large typography, precise grid, restrained asymmetry, generous negative space, warm off-black ink and bone-white surfaces with one muted persimmon accent. Subtle hairline rules, refined sans-serif interface typography paired with a characterful editorial serif for large headings. Tasteful and cool, not luxury cosplay, glassmorphism, gradients, neon, cards everywhere, or dashboard bento.
Layout: compact top bar with wordmark 'worth' lowercase, navigation 'Archive', 'Lists', 'Search', and an obvious '+ Add' control. Hero line 'The stuff worth keeping.' plus a small date line. Immediately underneath, an asymmetrical yet practical grid that mixes personal photo thumbnails and type-led records. Show four distinct records: a whiskey tried, a movie watched, a 5.2 mi run, and a 1997 Porsche 911 ownership record. Show a small 'Last time' strip with haircut date and restaurant visit. Include a simple search field 'Find something you logged'. Show no analytics chart or fake social metrics. Photography is only plausible user-uploaded personal memories: imperfect candid whiskey glass on a table, parked car in natural light, restaurant table, not ad photography. The entry text must be concise and functional; spelling must be legible and correct.
Exact visible text: 'worth', 'Archive', 'Lists', 'Search', '+ Add', 'The stuff worth keeping.', 'Find something you logged', 'Recently', 'Last time'.
Constraints: visually distinctive but implementable React UI, high contrast and readable controls, clear hierarchy, responsive design logic, no generated gibberish text, no overlapping elements, no watermarks.
```

### Archive home, preferred revision

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web app home screen, wide 16:10 flat screenshot, no browser chrome.
Primary request: Refine the signed-in home screen for 'worth', a private life log of things tried, watched, done, owned and revisited. It must feel cool, contemporary, nonchalant and genuinely useful. Unlike a photo gallery, the layout should work even when many entries have no pictures. This is a shippable product UI, not concept art or marketing landing page.
Visual direction: contemporary independent editorial archive with daring but controlled typography. Deep warm near-black background, warm ivory text, muted persimmon accent, thin quiet rules, sharp grid, one expressive serif title balanced by clean sans-serif UI. The atmosphere is tactile and tasteful, not luxury gold, neon, glassmorphism, grain, glowing gradients, or generic bento cards.
Composition: narrow top navigation with lowercase 'worth' wordmark at left, 'Archive', 'Lists', 'Search' in center, rust '+ Add' button at right. Below, small date label 'SEPTEMBER 2026' and large editorial title 'Lately.' at left. On the right of the title, a compact search box 'Find something you logged'. Main content: asymmetrical 3-column grid. Left wider column features one candid personal photo of a parked vintage car with entry text '1997 Porsche 911' and 'Owned since 2024'. Center column is a very clean text-only recent activity list with four dated entries: '5.2 mi run', 'Booker’s Bourbon', 'A Complete Unknown', 'Emmer & Rye'. Right column is a practical 'Last time' panel listing 'Haircut', 'Nails', and 'Dinner out' with dates, no charts. At the bottom, a slim horizontal strip of list shortcuts 'Drinks 24', 'Movies 38', 'Places 16', 'Cars 3' using type, not tiles. Let the images be plausible user-uploaded memories rather than glossy ad photography. Carefully spaced, clear hierarchy, readable actual controls, subtle select/hover cues.
Exact visible text: 'worth', 'Archive', 'Lists', 'Search', '+ Add', 'SEPTEMBER 2026', 'Lately.', 'Find something you logged', 'Recent', 'Last time', '1997 Porsche 911', 'Owned since 2024', '5.2 mi run', 'Booker’s Bourbon', 'A Complete Unknown', 'Emmer & Rye', 'Haircut', 'Nails', 'Dinner out', 'Drinks', 'Movies', 'Places', 'Cars'.
Constraints: no filler slogans, no social features, no streaks or gamification, no gibberish, no overlapping elements, no watermark.
```

### Drinks list

```text
Use case: ui-mockup
Asset type: high-fidelity desktop web app mockup, 16:10 landscape, flat screenshot without browser chrome or device frame.
Primary request: Design the LIST DETAIL screen for 'worth', a private personal life log. This screen is a collection called 'Drinks', showing how a person can remember wines and whiskeys they have tried. The product also supports movies, cars, workouts, restaurants, and upkeep, but this screen focuses on one useful list. It must feel like the same app as a warm editorial archive home: practical, calm, cool, visually tasteful, not generic SaaS.
Style: contemporary independent magazine and personal archive. Ink-black typography, warm ivory canvas, muted persimmon accent, subtle hairline separators, large expressive serif heading, crisp interface sans, generous whitespace. Buildable UI with clear interactions and accessibility; no glassmorphism, gradients, neon, luxury gold, gimmicky texture or charts.
Layout: top bar with lowercase 'worth' wordmark, links 'Archive', 'Lists', 'Search', and persimmon '+ Add'. The main area begins with a compact overline 'YOUR LISTS', a large headline 'Drinks', and a practical one-line description 'Wines, whiskeys, and the occasional good idea.' Below, clear tabs 'All', 'Whiskey', 'Wine', plus a search field 'Search drinks' and sort dropdown 'Most recent'. Show a vertical list/table of four entries, each with small candid user-photo thumbnail when available, name, type, date last tried, count, and a one-line personal note. Include 'Booker’s Bourbon', 'Barolo', 'Highland Park 12', and 'Chablis'. One entry selected opens a fixed right detail panel with larger natural-light photo, title 'Booker’s Bourbon', 'Tried 3 times', a compact chronological history of dates, and an editable personal note. This makes repeat entries and recall unmistakable. Keep text sparse and readable.
Exact visible text: 'worth', 'Archive', 'Lists', 'Search', '+ Add', 'YOUR LISTS', 'Drinks', 'All', 'Whiskey', 'Wine', 'Search drinks', 'Most recent', 'Booker’s Bourbon', 'Barolo', 'Highland Park 12', 'Chablis', 'Tried 3 times'.
Constraints: polished, realistic, implementation-ready UI. No overlapping labels, no gibberish, no fake app metrics, no social features, no watermarks.
```

### Mobile quick add

```text
Use case: ui-mockup
Asset type: one high-fidelity mobile web app screen, portrait 9:16, flat screenshot only.
Primary request: A clean, practical quick-add form for 'worth', a private personal life log. The user is recording an evening run. It should match a refined editorial web app with the lowercase wordmark 'worth', elegant large serif heading, plain readable sans-serif form controls, and a muted rust-orange save button. This is a shippable UI mockup, not illustration or concept art.
Critical rendering requirement: render on a completely OPAQUE solid warm ivory background from edge to edge. No transparency, no black fill, no texture, no distressed effect, no shadows behind text. All text dark ink and clearly readable.
Layout: top row with 'worth' and X close. Heading 'What happened?' Under it a row of six category tabs: Tried, Watched, Went, Owned, Did, Upkeep, with Did selected. Below are simple aligned form rows: activity title 'Evening run'; distance '5.2 mi'; date 'Today, Sep 30'; place 'Riverside loop'; note 'Good pace. Clear head.'; optional 'Add a photo'. Fixed bottom button 'Save entry'. Comfortable spacing and tap targets. No other elements.
Style: sophisticated but casual, warm off-white canvas, black typography, one small rust-orange accent, hairline dividers rather than card borders. A mobile app someone could actually implement and use in 20 seconds.
Constraints: correct spelling, no gibberish, no gradients, no device frame, no watermark.
```

### Ranked compact list

```text
Create a NEW screen design, not a minor edit. Image 1 is ONLY a visual style reference for Worth's warm ivory editorial typography, black serif wordmark, muted rust accent, thin rules, and restrained navigation. Make a high-fidelity, implementation-ready 16:10 desktop web app screenshot, flat and borderless, for a private life-log app named 'worth'. This is the Drinks collection in its COMPACT full-list mode. Opaque warm ivory canvas, crisp black text, perfect contrast. Header: worth, Archive, Lists (active), Search, + Add. Page heading 'Drinks' in confident editorial serif, small '38 items' and a quiet 'Share list' button. The main interface must visibly make ranking useful: view switch 'Gallery | List | Compact' with Compact active; search 'Search drinks'; category filters 'All | Whiskey | Wine' with All active; rank filter 'All ranks | Top 10 | Unranked' with All ranks active; sort control 'My rank'. Under these, a wide, dense, readable native-table-like layout occupying most of the screen, at least 12 compact rows so the entire collection feels scannable rather than a four-card gallery. Columns: Rank, Name, Type, Last tried, Times. Visible ranks #1 through #10 plus two rows with a dash for unranked. Use plausible simple drink names with accurate spelling; keep data copy short. One row subtly selected; an unobtrusive row menu or 'Move to #' action visible, no side drawer or giant image. At bottom a small line '38 items · All shown' (not pagination). This is an actual product UI, not concept art. No charts, star ratings, score badges, streaks, social feed, unnecessary photos, gradients, glass effects, fake browser chrome, visual overlap, or gibberish.
```

### Show list on a phone

```text
Use case: ui-mockup. Create a high-fidelity, implementation-ready MOBILE web app screenshot, portrait 9:16, flat image with no device frame or browser chrome. Product is 'worth', a private personal life log. This screen is a deliberate full-screen 'Show list' mode opened from the user's ranked Drinks list so they can hand their phone to a friend during a conversation. Make it beautiful, nonchalant, minimal, and obviously readable at arm's length. Completely OPAQUE deep warm charcoal background, warm ivory text with strong contrast, one subtle rust-orange accent, clean editorial grid, thin rules, characterful serif for major names and compact sans-serif for controls. Header: small lowercase wordmark 'worth' at left and 'Close' at right. Small kicker 'MY LIST', large heading 'Drinks', subheading 'Top 5'. Then five full-width ranked rows with very large left-side numbers 01, 02, 03, 04, 05, item name and small type. Use exactly: 01 Booker’s Bourbon / Whiskey; 02 Highland Park 12 / Whiskey; 03 Lagavulin 16 / Whiskey; 04 Barolo / Wine; 05 Chablis / Wine. A tiny 'Shared view' or 'Only ranked names' label may appear, but no personal notes, dates, locations, activity counts, account data, or photos. Fixed bottom action area with a single clearly labelled 'Share top 5' button and a quiet 'Back to list' text link. Make rows spacious but fit all five ranks on one phone screen, no scrolling needed for this five-item example. No cards, charts, star ratings, scores, streaks, social widgets, fake app chrome, transparency, gradients, shadows behind text, blur, gibberish, or overlap. Typography must be legible and spelled correctly.
```
