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
