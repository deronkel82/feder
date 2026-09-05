import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, validateLibrary, newScene } from '../src/core/model.ts';
import {
  changeStructure,
  appendToChapter,
  reorderInChapter,
} from '../src/core/structure.ts';
import { restoreSnapshot } from '../src/core/history.ts';
void test('moving and promoting scenes preserves contents, groups and original snapshots', () => {
  const l = seed(),
    p = l.projects[0],
    s = p.scenes[0];
  const moved = changeStructure(l, {
    type: 'move',
    sceneId: s.id,
    chapter: 'Kapitel 2',
  });
  assert.deepEqual(
    moved.projects[0].scenes.map((s) => s.chapter),
    ['Kapitel 1', 'Kapitel 2', 'Kapitel 2'],
  );
  assert.equal(moved.projects[0].scenes.at(-1)!.text, s.text);
  assert.deepEqual(moved.snapshots[0].project, p);
  const promoted = changeStructure(l, {
    type: 'promote',
    sceneId: s.id,
    chapter: 'Ankunft',
  });
  assert.deepEqual(
    promoted.projects[0].scenes.map((s) => s.chapter),
    ['Kapitel 1', 'Ankunft', 'Kapitel 2'],
  );
  assert.deepEqual(
    promoted.projects[0].scenes.find((x) => x.id === s.id),
    { ...s, chapter: 'Ankunft' },
  );
  assert.throws(() =>
    changeStructure(l, {
      type: 'promote',
      sceneId: s.id,
      chapter: 'Kapitel 2',
    }),
  );
  assert.throws(() =>
    changeStructure(l, {
      type: 'move',
      sceneId: s.id,
      chapter: 'Nicht vorhanden',
    }),
  );
});
void test('chapter to scene conversion preserves ordered text and original metadata through restore', () => {
  const l = seed(),
    p = l.projects[0];
  p.scenes[0].notes = 'Notiz A';
  p.scenes[1].text = 'Zweiter Text';
  p.scenes[1].notes = 'Notiz B';
  p.scenes[1].pov = 'Andere Person';
  const changed = changeStructure(l, {
    type: 'collapse',
    chapter: 'Kapitel 1',
    target: 'Kapitel 2',
  });
  const merged = changed.projects[0].scenes.at(-1)!;
  assert.equal(merged.title, 'Kapitel 1');
  assert.equal(merged.text, p.scenes[0].text + '\n\nZweiter Text');
  assert.ok(merged.notes.includes('Notiz A'));
  assert.ok(merged.notes.includes('Andere Person'));
  assert.equal(changed.projects[0].scenes.length, 2);
  assert.deepEqual(
    restoreSnapshot(changed, changed.snapshots[0].id).projects[0],
    p,
  );
});
void test('deleting chapters, scenes and last scene is valid and recoverable', () => {
  let l = seed();
  const original = structuredClone(l.projects[0]);
  l = changeStructure(l, { type: 'deleteChapter', chapter: 'Kapitel 1' });
  assert.equal(l.projects[0].scenes.length, 1);
  assert.deepEqual(l.snapshots[0].project, original);
  const last = structuredClone(l.projects[0]);
  l = changeStructure(l, { type: 'deleteScene', sceneId: last.scenes[0].id });
  assert.equal(l.projects[0].scenes.length, 1);
  assert.equal(l.projects[0].scenes[0].text, '');
  assert.notEqual(l.projects[0].scenes[0].id, last.scenes[0].id);
  assert.deepEqual(validateLibrary(l), l);
  assert.deepEqual(restoreSnapshot(l, l.snapshots[0].id).projects[0], last);
});
void test('chapter rename updates all scenes; appending and ordering cannot split a chapter', () => {
  const l = seed();
  const next = changeStructure(l, {
    type: 'rename',
    chapter: 'Kapitel 1',
    name: 'Anfang',
  });
  assert.equal(
    next.projects[0].scenes.filter((s) => s.chapter === 'Anfang').length,
    2,
  );
  assert.throws(() =>
    changeStructure(l, {
      type: 'rename',
      chapter: 'Kapitel 1',
      name: 'Kapitel 2',
    }),
  );
  const n = newScene('Kapitel 1'),
    scenes = appendToChapter(l.projects[0].scenes, n);
  assert.equal(scenes[2].id, n.id);
  assert.deepEqual(reorderInChapter(scenes, n.id, 1), scenes);
  assert.equal(reorderInChapter(scenes, n.id, -1)[1].id, n.id);
});
