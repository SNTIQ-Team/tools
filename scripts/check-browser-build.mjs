import { readdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import path from 'node:path';

const roots = process.argv.slice(2);
if (!roots.length) throw new Error('Supply directories containing public assets');

const home = homedir().replaceAll('\\', '/').replace(/\/$/, '');
const absolutePath = /(?:file:\/{2,3}(?:[A-Z]:\/)?|(?:^|[^\w:/])\/)(?:home|Users)\/[^\s/"'<>]+\//i;
const networkUrl = /https?:\/\/(?:localhost|127\.0\.0\.1|10(?:\.\d{1,3}){3}|192\.168(?:\.\d{1,3}){2}|172\.(?:1[6-9]|2\d|3[01])(?:\.\d{1,3}){2})(?=[:/\s])/i;
function privateReference(content) {
  const text = content.replaceAll('\\\\', '/').replaceAll('\\/', '/');
  if ((home.length > 1 && text.includes(home + '/')) || absolutePath.test(text)) return 'Local build path';
  if (networkUrl.test(text)) return 'Private network URL';
  return null;
}

function checkFile(root, file) {
  if (!/\.(?:m?js|cjs|css|html?|json|map|svg|xml|txt)$/i.test(file)) return;
  const text = readFileSync(file, 'utf8');
  const embeddedMaps = [...text.matchAll(/sourceMappingURL=data:application\/json[^,\s]*;base64,([A-Za-z0-9+/=]+)/g)];
  const finding = privateReference(text) ?? embeddedMaps.map(match => privateReference(Buffer.from(match[1], 'base64').toString('utf8'))).find(Boolean);
  if (finding) throw new Error(`${finding} in public asset ${path.relative(root, file)}`);
}
function scan(root, directory) {
  for (const item of readdirSync(directory, { withFileTypes: true })) {
    const file = path.join(directory, item.name);
    if (item.isDirectory()) scan(root, file);
    else if (item.isFile()) checkFile(root, file);
  }
}
for (const root of roots) scan(root, root);
