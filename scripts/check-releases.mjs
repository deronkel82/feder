import { readFileSync } from 'node:fs';
const read = (path) => JSON.parse(readFileSync(path, 'utf8'));
const releases = read('src/core/releases.json');
const version = read('package.json').version;
const lock = read('package-lock.json');
if (
  !releases.length ||
  releases[0].version !== version ||
  lock.version !== version ||
  lock.packages[''].version !== version
)
  throw Error(
    'Neue Veröffentlichung: Versionshistorie und Paketversionen müssen übereinstimmen. src/core/releases.json ergänzen.',
  );
let previous;
for (const release of releases) {
  if (
    !/^\d+\.\d+\.\d+$/.test(release.version) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(release.date) ||
    !Number.isFinite(Date.parse(release.date)) ||
    !release.title?.trim() ||
    !release.changes?.length ||
    !release.changes.every((c) => typeof c === 'string' && c.trim())
  )
    throw Error(
      'Unvollständiger Eintrag in der Versionshistorie: ' + release.version,
    );
  const parts = release.version.split('.').map(Number);
  if (previous) {
    const difference = parts
      .map((n, i) => n - previous[i])
      .find((n) => n !== 0);
    if (difference === undefined || difference >= 0)
      throw Error(
        'Versionshistorie muss eindeutig und absteigend sortiert sein.',
      );
  }
  previous = parts;
}
console.log(
  `Versionshistorie: ${releases.length} Veröffentlichungen, aktuell ${version}.`,
);
