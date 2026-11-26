import { copyFileSync, mkdirSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(path.join(root, 'apps/web/package.json'));
const packageFile = require.resolve('pdfjs-dist/package.json');
const { version } = JSON.parse(readFileSync(packageFile, 'utf8'));
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('Unexpected PDF.js version');
const destination = path.join(root, 'apps/web/public/pdfjs', version);
mkdirSync(destination, { recursive: true });
// Native browser modules preserve import.meta.url as the public resource URL.
for (const filename of ['pdf.min.mjs', 'pdf.worker.min.mjs']) {
  copyFileSync(path.join(path.dirname(packageFile), 'build', filename), path.join(destination, filename));
}
console.log(`Prepared same-origin PDF.js runtime and worker ${version}`);
