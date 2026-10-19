# Recognition software notices

Photo text reading bundles these locked dependencies for use in the browser:

- [Tesseract.js](https://github.com/naptha/tesseract.js), version 7.0.0: Apache-2.0.
- [Tesseract.js-core](https://github.com/naptha/tesseract.js-core), version 7.0.0: Apache-2.0.
- [Packaged English language data](https://github.com/naptha/tessdata),
  `@tesseract.js-data/eng` version 1.0.0: package metadata declares MIT.

The build copies the supplied Tesseract.js/core license files, English package
README/metadata and exact versions alongside the static reading assets at
`/ocr/v7/licenses/`. Source packages and their notices remain in the Node package
installation. Recognition assets are served by Worth; no source photo is part of
them. Existing fonts, icons and other dependencies retain their package licenses.

## Barcode reading

On-device barcode reading bundles [ZXing TypeScript](https://github.com/zxing-js/library),
`@zxing/library` version 0.23.0, under Apache-2.0. Its supplied full license is
served at `/licenses/zxing-apache-2.0.txt`. The project is in maintenance mode;
reading is isolated to a lazy browser worker with bounded image inputs, and
manual entry remains available. No hosted scanning SDK or paid service is used.

The installed barcode dependency’s supplied notices also include `ts-custom-error`
3.3.1 (MIT, `/licenses/ts-custom-error-mit.txt`) and `@zxing/text-encoding` 0.9.0
(Unlicense OR Apache-2.0, `/licenses/zxing-text-encoding.txt`). These public copies
come from the locked packages; refresh them with dependency upgrades.

## Embedded booklet and field-guide fonts

Booklets and field guides embed the locked `@fontsource/dm-sans` 5.3.0 Latin
regular/medium files for standalone reading and printing. Their generated HTML
also includes the package's supplied copyright and full SIL Open Font License
1.1 in an inert `worth-font-license` template. The notice is imported from the
locked package alongside the fonts, so dependency upgrades carry their supplied
notice. Preview/print composition and private record fields are unaffected.
