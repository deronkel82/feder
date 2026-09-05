import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, validateLibrary, type Card } from '../src/core/model.ts';
import {
  chapterLabel,
  chapterGroups,
  orderedScenes,
} from '../src/core/chapters.ts';
import { changeStructure } from '../src/core/structure.ts';
import { sendIdea } from '../src/core/plotting.ts';
import { restoreSnapshot } from '../src/core/history.ts';
void test('chapter numbers and parts survive metadata edits, rename, backup and import', () => {
  const original = seed();
  let l = changeStructure(original, {
    type: 'rename',
    chapter: 'Kapitel 1',
    name: 'Ankunft',
    meta: {
      name: 'ignored',
      kind: 'chapter',
      number: 'IV',
      part: 'Akt I – Anfang',
    },
  });
  assert.equal(chapterLabel(l.projects[0], 'Ankunft'), 'IV · Ankunft');
  assert.equal(chapterGroups(l.projects[0])[0].part, 'Akt I – Anfang');
  l = changeStructure(l, {
    type: 'rename',
    chapter: 'Ankunft',
    name: 'Heimkehr',
  });
  assert.equal(chapterLabel(l.projects[0], 'Heimkehr'), 'IV · Heimkehr');
  assert.deepEqual(
    validateLibrary(JSON.parse(JSON.stringify(l))),
    JSON.parse(JSON.stringify(l)),
  );
  assert.deepEqual(
    restoreSnapshot(l, l.snapshots.at(-1)!.id).projects[0],
    original.projects[0],
  );
});
void test('prologue and epilogue have no number and surround grouped chapters', () => {
  let l = seed();
  l = changeStructure(l, {
    type: 'newChapter',
    chapter: 'Nachklang',
    meta: { name: '', kind: 'epilogue', number: '99', part: 'ignored' },
  });
  l = changeStructure(l, {
    type: 'newChapter',
    chapter: 'Vor dem Sturm',
    meta: { name: '', kind: 'prologue', number: '1', part: 'ignored' },
  });
  const p = l.projects[0];
  assert.equal(orderedScenes(p)[0].chapter, 'Vor dem Sturm');
  assert.equal(orderedScenes(p).at(-1)!.chapter, 'Nachklang');
  assert.equal(chapterLabel(p, 'Vor dem Sturm'), 'Prolog · Vor dem Sturm');
  assert.equal(chapterLabel(p, 'Nachklang'), 'Epilog · Nachklang');
  assert.equal(p.chapterMeta!.find((c) => c.kind === 'epilogue')!.number, '');
});
void test('parts group complete chapters without losing or duplicating scenes', () => {
  let l = seed();
  l = changeStructure(l, { type: 'newChapter', chapter: 'Drittes' });
  for (const name of ['Kapitel 1', 'Drittes'])
    l = changeStructure(l, {
      type: 'rename',
      chapter: name,
      name,
      meta: { name, kind: 'chapter', number: '', part: 'Akt A' },
    });
  const p = l.projects[0];
  assert.deepEqual(
    chapterGroups(p)[0].chapters.map((c) => c.name),
    ['Kapitel 1', 'Drittes'],
  );
  assert.equal(
    new Set(orderedScenes(p).map((s) => s.id)).size,
    p.scenes.length,
  );
});
const idea: Card = {
  id: 'plot',
  title: 'Die Fahrt',
  subtitle: 'XY fährt nach ZYX',
  text: 'Charakter XY sitzt im Auto.',
  kind: 'Idee',
  stage: 'Entwicklung',
};
void test('idea transfer creates synopsis-only scene, sets status and avoids duplicate transfers', () => {
  const l = seed();
  const sent = sendIdea(l, idea, { kind: 'scene', chapter: 'Kapitel 1' });
  const p = sent.library.projects[0];
  const s = p.scenes.find((s) => s.id === sent.sceneId)!;
  assert.equal(s.text, '');
  assert.equal(s.synopsis, 'XY fährt nach ZYX\n\nCharakter XY sitzt im Auto.');
  assert.equal(s.status, 'Idee');
  assert.equal(p.cards.find((c) => c.id === idea.id)!.stage, 'Im Manuskript');
  const again = sendIdea(sent.library, idea, {
    kind: 'chapter',
    chapter: 'Duplikat',
  });
  assert.equal(again.library, sent.library);
  assert.equal(again.sceneId, sent.sceneId);
  assert.deepEqual(sent.library.snapshots[0].project, l.projects[0]);
});
void test('idea can create a chapter and can be re-sent after deletion; collisions are refused', () => {
  const l = seed();
  assert.throws(() =>
    sendIdea(l, idea, { kind: 'chapter', chapter: 'Kapitel 1' }),
  );
  const sent = sendIdea(l, idea, { kind: 'chapter', chapter: 'Fahrt' });
  const deleted = changeStructure(sent.library, {
    type: 'deleteScene',
    sceneId: sent.sceneId,
  });
  const again = sendIdea(
    deleted,
    deleted.projects[0].cards.find((c) => c.id === idea.id)!,
    { kind: 'scene', chapter: 'Kapitel 1' },
  );
  assert.notEqual(again.sceneId, sent.sceneId);
  assert.equal(
    again.library.projects[0].scenes.filter((s) => s.title === idea.title)
      .length,
    1,
  );
  assert.deepEqual(validateLibrary(again.library), again.library);
});
void test('invalid optional chapter metadata is rejected', () => {
  const l = seed();
  l.projects[0].chapterMeta = [
    { name: 'a', kind: 'chapter', number: '1', part: '' },
    { name: 'a', kind: 'chapter', number: '2', part: '' },
  ];
  assert.throws(() => validateLibrary(l));
});
