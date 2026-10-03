import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { seed } from '../src/core/model.ts';
const preferences = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (key: string) => preferences.get(key) ?? null,
    setItem: (key: string, value: string) => preferences.set(key, value),
  },
  configurable: true,
});
async function db() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('feder', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('workspace');
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function edit(fn: (store: IDBObjectStore) => void) {
  const database = await db();
  await new Promise<void>((resolve, reject) => {
    const tx = database.transaction('workspace', 'readwrite');
    fn(tx.objectStore('workspace'));
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  database.close();
}
let instance = 0;
async function fresh() {
  preferences.clear();
  await edit((store) => store.clear());
  const path = '../src/core/storage.ts?recovery=' + instance++;
  return import(path) as Promise<typeof import('../src/core/storage.ts')>;
}
void test('failed load blocks saves at storage boundary and preserves unsupported originals', async () => {
  const storage = await fresh();
  const original = { ...seed(), version: 99 };
  await edit((store) =>
    store.put({ library: original, revision: 0 }, 'feder.library.v1'),
  );
  const result = await storage.load();
  assert.ok(result.error);
  await assert.rejects(storage.save(result.library), /gesperrt/);
  assert.deepEqual(JSON.parse(await storage.rawBackup()), original);
});
void test('missing index with surviving manuscript never seeds or overwrites demo', async () => {
  const storage = await fresh();
  const original = (await storage.load()).library;
  original.projects[0].scenes[0].text = 'Unersetzbarer Text';
  await storage.save(original);
  await edit((store) => store.delete('feder.library.v1'));
  assert.ok((await storage.load()).error);
  await assert.rejects(storage.save(seed()), /gesperrt/);
  const dump = JSON.parse(await storage.rawBackup());
  assert.equal(
    dump.records[
      'scene:' + original.active + ':' + original.projects[0].scenes[0].id
    ].text,
    'Unersetzbarer Text',
  );
});
void test('missing scene blocks editing and raw rescue retains every other block and backup', async () => {
  const storage = await fresh();
  const original = (await storage.load()).library;
  await storage.save(original);
  const scene = original.projects[0].scenes[0];
  await edit((store) =>
    store.delete('scene:' + original.active + ':' + scene.id),
  );
  assert.ok((await storage.load()).error);
  const dump = JSON.parse(await storage.rawBackup());
  assert.ok(dump.records['project:' + original.active]);
  assert.ok(dump.records['backup:auto']);
  assert.deepEqual((await storage.recoveryBackups())[0].library, original);
});
void test('evicted database with prior-use marker fails closed; genuine first start works', async () => {
  const storage = await fresh();
  assert.equal((await storage.load()).error, null);
  await storage.save(seed());
  await edit((store) => store.clear());
  assert.ok((await storage.load()).error);
  await assert.rejects(storage.save(seed()), /gesperrt/);
});
void test('aborted scene write leaves the complete last committed manuscript intact', async () => {
  const storage = await fresh();
  const original = (await storage.load()).library;
  await storage.save(original);
  const next = structuredClone(original);
  next.projects[0].scenes[0].text = 'Neue Fassung';
  // oxlint-disable-next-line typescript/unbound-method
  const put = IDBObjectStore.prototype.put;
  IDBObjectStore.prototype.put = function (value, key) {
    if (typeof key === 'string' && key.startsWith('scene:'))
      throw new DOMException('Disk full', 'QuotaExceededError');
    return put.call(this, value, key);
  };
  try {
    await assert.rejects(storage.save(next), /Speicher/);
  } finally {
    IDBObjectStore.prototype.put = put;
  }
  await assert.rejects(storage.save(next), /Speicher/);
  assert.deepEqual((await storage.load()).library, original);
});
void test('restart saves retain a previous independent recovery generation', async () => {
  const storage = await fresh();
  const original = (await storage.load()).library;
  original.projects[0].title = 'Mein Buch';
  await storage.save(original);
  await storage.load();
  const next = structuredClone(original);
  next.projects[0].title = 'Nach Neustart';
  await storage.save(next);
  const backups = await storage.recoveryBackups();
  assert.equal(backups.length, 2);
  assert.equal(
    (backups.find((b) => b.key === 'backup:auto')!.library as typeof original)
      .projects[0].title,
    'Mein Buch',
  );
  assert.deepEqual((await storage.load()).library, next);
});
