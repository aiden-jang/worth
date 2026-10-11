# Worth browser identity

The browser assets reuse the cabinet's existing Meh silhouette, sage `#d4dac3`,
olive `#181915`, cream `#eae5d5`, DM Sans and dry copy. No primary screen layout changes.
The small favicon deliberately omits limbs and blush for legibility at 16px.

- `public/favicon.svg`: vector tab icon; `favicon.ico` contains 16/32/48px PNG frames for older browsers.
- `public/icons/app.svg`: authored launcher source. PNGs are 192/512px; the 512px maskable image
  keeps the face and limbs inside the central safe circle. The background is opaque olive.
- `public/apple-touch-icon.png`: opaque 180px iOS home-screen icon.
- `public/site.webmanifest`: Worth name, root start URL, standalone display, matching launch/browser color.
  This does not add offline caching or a service worker. Saving and account access still need a connection.
- `share-preview.html` and `meh.svg`: editable source for `public/social-card.png` (1200 × 630).
  Render at that viewport after the bundled fonts load. It contains brand copy only; no account data.

`index.html` links these assets and supplies generic Open Graph/Twitter metadata for
link previews. Preview services may cache an older image until they recrawl the URL.
Raster icons were rendered from the SVG with Sharp; the social image was rendered in Chrome.

Verification: inspected the social image and launcher at actual size, checked the served
asset dimensions/content types and manifest references, and verified the production build.
