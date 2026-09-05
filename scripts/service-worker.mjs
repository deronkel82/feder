import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const dir = 'dist-pages';
const files = readdirSync(dir, { recursive: true })
  .filter(
    (f) =>
      !f.endsWith('sw.js') &&
      !f.includes('LICENSE') &&
      /\.(html|js|css|json|png|svg|webmanifest)$/.test(f),
  )
  .map((f) => './' + f);
const hash = createHash('sha256');
for (const f of files) hash.update(readFileSync(dir + '/' + f));
hash.update(readFileSync('scripts/sw-template.txt'));
const version = 'feder-' + hash.digest('hex').slice(0, 12);
const template = readFileSync('scripts/sw-template.txt', 'utf8');
writeFileSync(
  dir + '/sw.js',
  template
    .replace('__VERSION__', JSON.stringify(version))
    .replace('__ASSETS__', JSON.stringify(files)),
);
console.log('Offline shell:', files.length, 'files;', version);
