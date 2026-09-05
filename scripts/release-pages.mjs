import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
mkdirSync('docs', { recursive: true });
rmSync('docs/assets', { recursive: true, force: true });
cpSync('dist-pages', 'docs', { recursive: true });
writeFileSync('docs/.nojekyll', '');
