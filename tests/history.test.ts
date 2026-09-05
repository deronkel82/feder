import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed } from '../src/core/model.ts';
import {
  withSnapshot,
  reviseScene,
  restoreSnapshot,
} from '../src/core/history.ts';
void test('revision saves original and throttles subsequent checkpoints to ten minutes', () => {
  const initial = seed();
  const p = initial.projects[0],
    s = p.scenes[0];
  const now = Date.now();
  const revision = reviseScene(initial, s.id, { status: 'Überarbeitung' }, now);
  assert.equal(revision.snapshots.length, 1);
  assert.equal(revision.snapshots[0].project.scenes[0].status, 'Entwurf');
  const edit = reviseScene(
    revision,
    s.id,
    { text: 'Neue Fassung' },
    now + 1000,
  );
  assert.equal(edit.snapshots.length, 1);
  const later = reviseScene(edit, s.id, { text: 'Noch neuer' }, now + 600000);
  assert.equal(later.snapshots.length, 2);
  assert.equal(later.snapshots[0].project.scenes[0].text, 'Neue Fassung');
  assert.equal(initial.projects[0].scenes[0].text, s.text);
  assert.equal(later.snapshots[0].number, 2);
});
void test('named restore first safeguards present book including series and cards', () => {
  let library = seed();
  const p = library.projects[0];
  library = withSnapshot(library, p, 'Erste Fassung');
  const savedId = library.snapshots[0].id;
  library.projects[0] = {
    ...p,
    title: 'Neuer Titel',
    series: { enabled: true, title: 'Saga', volume: 'I' },
    cards: [],
  };
  const restored = restoreSnapshot(library, savedId);
  assert.equal(restored.projects[0].title, p.title);
  assert.equal(restored.snapshots[0].project.title, 'Neuer Titel');
  assert.equal(restored.snapshots[0].project.series.title, 'Saga');
  assert.equal(restored.snapshots[0].reason, 'restore');
  assert.equal(restored.snapshots.length, 2);
  assert.deepEqual(restored.snapshots[1], library.snapshots[0]);
});
void test('legacy unnumbered versions and more than 200 snapshots remain intact', () => {
  let l = seed();
  for (let i = 0; i < 205; i++) l = withSnapshot(l, l.projects[0], String(i));
  assert.equal(l.snapshots.length, 205);
  delete l.snapshots[0].number;
  const next = withSnapshot(l, l.projects[0], 'Weiter');
  assert.equal(next.snapshots[0].number, 206);
});
