# Browser identity verification

Added browser tab SVG/ICO, iOS touch icon, 192/512px launcher icons, maskable icon,
web manifest, and generic branded Open Graph/Twitter preview. Sources and intentional
small-size simplification are documented in [brand assets](../../brand/README.md).

Verified all eight referenced asset URLs return 200 with non-HTML content types.
Checked manifest icon sizes against actual PNG dimensions and verified the HTML icon
and social image references. Assets are present in `dist/client` after the production build.
Inspected the icon and 1200 × 630 social card and captured the signed-out landing at
1440 × 900 and 390 × 780 beside the current illustrated cabinet reference. The page
composition is preserved; this pass changes document metadata and static assets only.
Formatting and production build pass. Actual iOS installation and third-party link
crawler cache refresh remain device/service checks after deployment.
