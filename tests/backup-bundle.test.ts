import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { unzipSync, strFromU8 } from 'fflate';
import { backupBundle } from '../src/core/backup-bundle.ts';
import { imageInventory } from '../src/core/image-inventory.ts';
import { validateLibrary } from '../src/core/model.ts';
import { load, save } from '../src/core/storage.ts';
import { illustratedLibrary, png, jpeg } from './illustrated-fixture.ts';
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null, setItem: () => {} },
  configurable: true,
});
void test('ZIP restores complete JSON and independently extracts exact cover and portrait bytes from every context', async () => {
  const library = illustratedLibrary();
  const files = unzipSync(await backupBundle(library));
  const restored = validateLibrary(
    JSON.parse(strFromU8(files['Feder-Sicherung.json'])),
  );
  assert.deepEqual(restored, library);
  const mapping = JSON.parse(strFromU8(files['Bildzuordnung.json'])) as {
    file: string;
    paths: string[];
  }[];
  assert.equal(mapping.length, 2);
  assert.equal(imageInventory(restored).unique, 2);
  for (const data of [png, jpeg]) {
    const expected = Buffer.from(data.split(',')[1], 'base64');
    assert.ok(
      mapping.some((entry) => Buffer.from(files[entry.file]).equals(expected)),
    );
  }
  assert.ok(mapping.some((entry) => entry.paths.includes('projects[0].cover')));
  assert.ok(
    mapping.some((entry) =>
      entry.paths.includes('projects[0].exportOptions.alternativeCover'),
    ),
  );
  assert.ok(
    mapping.some((entry) =>
      entry.paths.includes('worlds[0].cards[0].character.portrait'),
    ),
  );
  assert.ok(
    mapping.some((entry) => entry.paths.includes('snapshots[0].project.cover')),
  );
  assert.ok(
    mapping.some((entry) =>
      entry.paths.includes('templates[0].project.cards[0].character.portrait'),
    ),
  );
});
void test('covers and portraits survive separate IndexedDB records, JSON export and ZIP restore byte for byte', async () => {
  await load();
  const library = illustratedLibrary();
  await save(library);
  const reopened = await load();
  assert.equal(reopened.error, null);
  assert.deepEqual(reopened.library, library);
  const json = JSON.stringify(reopened.library);
  assert.ok(json.includes(png));
  assert.ok(json.includes(jpeg));
  const files = unzipSync(await backupBundle(JSON.parse(json)));
  await save(
    validateLibrary(JSON.parse(strFromU8(files['Feder-Sicherung.json']))),
  );
  assert.deepEqual((await load()).library, library);
});
void test('a referenced external image aborts full backup creation instead of silently omitting it', async () => {
  const library = illustratedLibrary();
  library.projects[0].cover = 'https://example.test/missing.jpg';
  await assert.rejects(backupBundle(library), /Coverbild/);
});
