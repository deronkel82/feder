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
