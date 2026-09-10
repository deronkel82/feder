import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
Object.defineProperty(globalThis, 'localStorage', {
  value: { getItem: () => null },
  configurable: true,
});
import { load, save, rawBackup } from '../src/core/storage.ts';
void test('IndexedDB roundtrip, snapshot persistence and competing windows', async () => {
  const first = await load();
  assert.equal(first.error, null);
  first.library.projects[0].title = 'Persistenztest';
  await save(first.library);
  assert.equal((await load()).library.projects[0].title, 'Persistenztest');
  const peerPath = '../src/core/storage.ts?peer';
  const peer = await import(peerPath);
  const stale = await peer.load();
  first.library.projects[0].title = 'Aktueller Stand';
  await save(first.library);
  stale.library.projects[0].title = 'Veralteter Stand';
  await assert.rejects(peer.save(stale.library), /anderes Fenster/);
  await assert.rejects(peer.backupForUpdate(stale.library), /anderes Fenster/);
  const raw = JSON.parse(await rawBackup());
  assert.equal(raw.projects[0].title, 'Aktueller Stand');
});
void test('permanent deletion atomically removes project history from update backups while preserving other projects', async () => {
  const { backupForUpdate, recoveryBackups } =
    await import('../src/core/storage.ts');
  const { newProject } = await import('../src/core/model.ts');
  const { deleteProject } = await import('../src/core/project-deletion.ts');
  const { purgeProject } = await import('../src/core/library-tools.ts');
  let l = (await load()).library;
  const id = l.active;
  l.projects.push(newProject('Behalten'));
  await save(l);
  await backupForUpdate(l);
  l = purgeProject(deleteProject(l, id), id);
  await save(l);
  const backups = await recoveryBackups();
  assert.ok(backups.length > 0);
  for (const b of backups) {
    const data = b.library as typeof l;
    assert.ok(!data.projects.some((p) => p.id === id));
    assert.ok(!data.snapshots.some((s) => s.project.id === id));
    assert.ok(data.projects.some((p) => p.title === 'Behalten'));
  }
  assert.deepEqual((await load()).library, l);
});
