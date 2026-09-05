import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { seed, validateLibrary } from '../src/core/model.ts';
import {
  load,
  save,
  rawBackup,
  recoveryBackups,
  backupForUpdate,
} from '../src/core/storage.ts';
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null },
  configurable: true,
});
function oldLibrary() {
  const data = JSON.parse(JSON.stringify(seed()));
  data.version = 1;
  for (const p of data.projects) {
    delete p.series;
    delete p.dismissedEntities;
  }
  data.snapshots = [
    {
      id: 'old-version',
      date: '2026-09-01T12:00:00Z',
      project: structuredClone(data.projects[0]),
    },
  ];
  return data;
}
async function record(library: unknown, revision: number) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('feder', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('workspace');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('workspace', 'readwrite');
    tx.objectStore('workspace').put({ library, revision }, 'feder.library.v1');
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
void test('version 1 migration preserves books, scenes, cards and snapshots without mutating input', () => {
  const old = oldLibrary();
  const before = structuredClone(old);
  const next = validateLibrary(old);
  assert.deepEqual(old, before);
  assert.equal(next.version, 2);
  assert.deepEqual(next.projects[0].scenes, old.projects[0].scenes);
  assert.deepEqual(next.projects[0].cards, old.projects[0].cards);
  assert.equal(next.active, old.active);
  assert.equal(next.snapshots[0].id, 'old-version');
  assert.deepEqual(next.snapshots[0].project.series, {
    enabled: false,
    title: '',
    volume: '',
  });
});
void test('migration and update backups survive storage reload; unsupported versions never overwrite originals', async () => {
  const old = oldLibrary();
  await record(old, 4);
  const opened = await load();
  assert.equal(opened.error, null);
  assert.equal(opened.library.version, 2);
  assert.deepEqual((await recoveryBackups())[0].library, old);
  assert.equal(JSON.parse(await rawBackup()).version, 2);
  opened.library.projects[0].series = {
    enabled: true,
    title: 'Lichtchroniken',
    volume: '2',
  };
  opened.library.projects[0].scenes[0].text = 'Mein unersetzbarer Text';
  await backupForUpdate(opened.library);
  assert.deepEqual((await load()).library, opened.library);
  const backup = (await recoveryBackups()).find(
    (b) => b.key === 'backup:update',
  )!;
  assert.deepEqual(backup.library, opened.library);
  opened.library.projects[0].title = 'Nach dem Update';
  await save(opened.library);
  assert.notEqual(
    (backup.library as typeof opened.library).projects[0].title,
    'Nach dem Update',
  );
  const future = { ...old, version: 99 };
  await record(future, 100);
  assert.ok((await load()).error);
  assert.deepEqual(JSON.parse(await rawBackup()), future);
  assert.deepEqual(
    (await recoveryBackups()).find((b) => b.key === 'backup:migration:1')!
      .library,
    old,
  );
});
