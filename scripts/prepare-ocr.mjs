import { createRequire } from 'node:module';
import { copyFile, mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const library = require.resolve('tesseract.js/package.json');
const core = createRequire(library).resolve('tesseract.js-core/package.json');
const language = require.resolve('@tesseract.js-data/eng/package.json');
const target = fileURLToPath(new URL('../public/ocr/v7/', import.meta.url));
await mkdir(join(target, 'core'), { recursive: true });
await mkdir(join(target, 'lang'), { recursive: true });
await mkdir(join(target, 'licenses'), { recursive: true });
await copyFile(join(dirname(library), 'dist/worker.min.js'), join(target, 'worker.min.js'));
// Include every current engine variant; the library chooses one for the device.
for (const name of (await readdir(dirname(core))).filter((name) => name.endsWith('.wasm.js')))
  await copyFile(join(dirname(core), name), join(target, 'core', name));
await copyFile(
  join(dirname(language), '4.0.0_best_int/eng.traineddata.gz'),
  join(target, 'lang/eng.traineddata.gz'),
);
await copyFile(join(dirname(library), 'LICENSE.md'), join(target, 'licenses/tesseract-js.txt'));
await copyFile(join(dirname(core), 'LICENSE'), join(target, 'licenses/tesseract-core.txt'));
await copyFile(language, join(target, 'licenses/english-data-package.json'));
await copyFile(join(dirname(language), 'README.md'), join(target, 'licenses/english-data-readme.md'));
await writeFile(
  join(target, 'licenses/versions.json'),
  JSON.stringify(
    {
      library: JSON.parse(await readFile(library, 'utf8')).version,
      core: JSON.parse(await readFile(core, 'utf8')).version,
      english: JSON.parse(await readFile(language, 'utf8')).version,
    },
    null,
    2,
  ),
);
