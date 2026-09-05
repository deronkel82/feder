import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, validateLibrary, type Card } from '../src/core/model.ts';
import {
  configureProject,
  usesScenes,
  isShort,
  manuscriptCounts,
  progressLimits,
  defaultTarget,
} from '../src/core/project-format.ts';
import { changeStructure } from '../src/core/structure.ts';
import { restoreSnapshot } from '../src/core/history.ts';
import { sendIdea } from '../src/core/plotting.ts';
import { exportHeading } from '../src/modules/publishing.ts';
void test('chapter-only conversion joins texts and notes with full recoverable original and remapped links', () => {
  const l = seed();
  const p = l.projects[0];
  p.scenes[1].text = 'Zweiter Text';
  p.scenes[1].notes = 'Wichtige Notiz';
  p.cards.push({
    id: 'idea',
    kind: 'Idee',
    title: 'Plan',
    subtitle: '',
    text: '',
    stage: 'Im Manuskript',
    manuscriptSceneId: p.scenes[1].id,
  });
  const converted = configureProject(l, 'novel', false);
  const q = converted.projects[0];
  assert.equal(usesScenes(q), false);
  assert.equal(q.scenes.length, 2);
  assert.equal(q.scenes[0].text, p.scenes[0].text + '\n\nZweiter Text');
  assert.ok(q.scenes[0].notes.includes('Wichtige Notiz'));
  assert.equal(q.cards.at(-1)!.manuscriptSceneId, q.scenes[0].id);
  assert.deepEqual(validateLibrary(converted), converted);
  assert.deepEqual(
    restoreSnapshot(converted, converted.snapshots[0].id).projects[0],
    p,
  );
  assert.throws(() =>
    changeStructure(converted, {
      type: 'move',
      sceneId: q.scenes[0].id,
      chapter: 'Kapitel 2',
    }),
  );
});
void test('short story conversion creates one text, hides series and can restore original', () => {
  const l = seed();
  l.projects[0].series = { enabled: true, title: 'Saga', volume: '3' };
  const changed = configureProject(l, 'short', false);
  const p = changed.projects[0];
  assert.ok(isShort(p));
  assert.equal(p.scenes.length, 1);
  assert.equal(p.series.enabled, false);
  assert.deepEqual(p.chapterMeta, []);
  assert.equal(exportHeading(p, p.scenes[0]), p.title);
  assert.deepEqual(validateLibrary(changed), changed);
  assert.deepEqual(
    restoreSnapshot(changed, changed.snapshots[0].id).projects[0],
    l.projects[0],
  );
  assert.throws(() =>
    changeStructure(changed, { type: 'newChapter', chapter: 'Nein' }),
  );
});
void test('word/character limits switch only above boundary and count only manuscript', () => {
  const l = configureProject(seed(), 'short', false);
  const p = l.projects[0];
  p.scenes[0].text = 'Hallo Welt';
  p.scenes[0].synopsis = 'Nicht mitzählen';
  p.target = 2;
  p.charTarget = 10;
  assert.deepEqual(manuscriptCounts(p), { words: 2, characters: 10 });
  assert.equal(progressLimits(p).wordExceeded, false);
  assert.equal(progressLimits(p).charExceeded, false);
  p.scenes[0].text += '!';
  assert.equal(progressLimits(p).charExceeded, true);
  p.scenes[0].text += ' Ja';
  assert.equal(progressLimits(p).wordExceeded, true);
  p.wordLimitEnabled = false;
  assert.equal(progressLimits(p).wordExceeded, false);
  assert.equal(progressLimits(p).charExceeded, true);
  p.charTarget = 0;
  assert.equal(progressLimits(p).charExceeded, false);
});
void test('Unicode character counting and paragraph separators are stable across merging', () => {
  const l = seed();
  l.projects[0].scenes[0].text = 'Ä 😀\r\nB';
  l.projects[0].scenes[1].text = 'C';
  l.projects[0].scenes[2].text = '';
  assert.deepEqual(manuscriptCounts(l.projects[0]), {
    words: 3,
    characters: 8,
  });
  assert.deepEqual(
    manuscriptCounts(configureProject(l, 'short', false).projects[0]),
    manuscriptCounts(l.projects[0]),
  );
});
void test('ideas append only planning in short/chapter-only mode without creating hidden scenes', () => {
  const l = configureProject(seed(), 'short', false);
  const idea: Card = {
    id: 'new',
    title: 'Fahrt',
    subtitle: 'Im Auto',
    text: 'Nach Berlin',
    kind: 'Idee',
    stage: 'Sammlung',
  };
  const sent = sendIdea(l, idea, { kind: 'scene', chapter: 'ignored' });
  assert.equal(sent.library.projects[0].scenes.length, 1);
  assert.equal(
    sent.library.projects[0].scenes[0].text,
    l.projects[0].scenes[0].text,
  );
  assert.ok(
    sent.library.projects[0].scenes[0].synopsis.endsWith(
      'Im Auto\n\nNach Berlin',
    ),
  );
  assert.throws(() => sendIdea(l, idea, { kind: 'chapter', chapter: 'Fahrt' }));
  const chapterOnly = configureProject(seed(), 'novel', false);
  const next = sendIdea(chapterOnly, idea, {
    kind: 'chapter',
    chapter: 'Fahrt',
  });
  assert.equal(next.library.projects[0].scenes.length, 3);
  assert.deepEqual(validateLibrary(next.library), next.library);
});
void test('legacy projects stay novels with scenes and defaults reflect shorter forms', () => {
  const l = seed();
  assert.equal(usesScenes(l.projects[0]), true);
  assert.equal(defaultTarget('novel'), 50000);
  assert.equal(defaultTarget('novella'), 20000);
  assert.equal(defaultTarget('short'), 2500);
  assert.deepEqual(validateLibrary(l), l);
  const invalid = { ...l, projects: [{ ...l.projects[0], format: 'short' }] };
  assert.throws(() => validateLibrary(invalid));
});
