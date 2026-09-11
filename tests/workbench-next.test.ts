import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, validateLibrary } from '../src/core/model.ts';
import {
  combineText,
  differenceGroups,
  searchProject,
  applyComparison,
  exportDefaults,
  validPosition,
} from '../src/core/workbench.ts';
import { detectEntities } from '../src/modules/entities.ts';
import { exportDocument } from '../src/modules/publishing.ts';
import { mergeLibraries } from '../src/sync/merge.ts';
import { readPosition } from '../src/modules/writing-position.ts';
void test('workbench metadata survives validation and sync; malformed options are rejected', () => {
  const base = seed(),
    remote = structuredClone(base);
  const p = remote.projects[0];
  p.readingPosition = {
    sceneId: p.scenes[1].id,
    start: 2,
    end: 2,
    scroll: 23,
    textScroll: 9,
    date: '2026-09-11',
  };
  p.reviewPasses = [
    {
      id: 'pass',
      title: 'Dialog',
      checks: [{ id: 'check', text: 'Stimmig?' }],
      completed: [p.scenes[0].id + ':check'],
    },
  ];
  p.exportPresets = [{ id: 'preset', name: 'Leser', options: exportDefaults }];
  p.cards[0].aliases = ['Mara', 'Restauratorin'];
  assert.deepEqual(validateLibrary(remote), remote);
  assert.deepEqual(mergeLibraries(base, base, remote).library.projects[0], p);
  const bad = structuredClone(remote);
  bad.projects[0].exportPresets![0].options.size = 100;
  assert.throws(() => validateLibrary(bad), /Exportvorlagen/);
  assert.equal(
    validPosition({ sceneId: 'x', start: 4, end: 3, scroll: 0, date: '' }),
    false,
  );
});
void test('project search covers aliases, shared worlds, comments and literal special characters', () => {
  const l = seed(),
    p = l.projects[0],
    s = p.scenes[0];
  s.text = 'Ein [Hinweis]';
  s.synopsis = 'Plan [Hinweis]';
  s.comments = [
    {
      id: 'c',
      start: 4,
      end: 13,
      text: 'Prüfe [Hinweis]',
      quote: '[Hinweis]',
      resolved: false,
    },
  ];
  p.cards[0].aliases = ['[Hinweis]'];
  p.worldId = 'world';
  l.worlds = [
    {
      id: 'world',
      name: 'Welt',
      cards: [{ ...p.cards[0], id: 'shared', title: '[Hinweis]' }],
    },
  ];
  const hits = searchProject(p, l, '[Hinweis]');
  for (const c of ['Manuskript', 'Zusammenfassungen', 'Kommentare', 'Figuren'])
    assert.ok(hits.some((h) => h.category === c));
  assert.ok(hits.some((h) => h.worldId === 'world'));
  assert.equal(hits.find((h) => h.category === 'Kommentare')!.start, 4);
});
void test('individual diff decisions preserve whitespace and full originals', () => {
  for (const [a, b] of [
    ['A alt B', 'A neu B'],
    ['', 'Neu'],
    ['Alt', ''],
    ['A\n\nB', 'A\nB'],
    ['😀 Ende', '😀 neues Ende'],
  ]) {
    const groups = differenceGroups(a, b);
    assert.equal(combineText(a, b, []), a);
    assert.equal(
      combineText(
        a,
        b,
        groups.map((_, i) => i),
      ),
      b,
    );
  }
});
void test('comparison backs up both projects, keeps source, preserves comments and refuses stale drafts', () => {
  const l = seed(),
    target = l.projects[0],
    source = structuredClone(target);
  source.id += '-sync-peer';
  source.scenes[0].text = 'Neue Fassung';
  l.projects.push(source);
  const result = applyComparison(l, target, source, {
    [target.scenes[0].id]: 'Ausgewählt',
  });
  assert.equal(result.projects[0].scenes[0].text, 'Ausgewählt');
  assert.equal(result.projects[1].scenes[0].text, 'Neue Fassung');
  assert.equal(result.snapshots.length, 2);
  assert.equal(l.snapshots.length, 0);
  assert.throws(
    () => applyComparison(result, target, source, {}),
    /inzwischen/,
  );
  assert.deepEqual(validateLibrary(result), result);
});
void test('explicit aliases recognize full nicknames and stay attached to the main figure', () => {
  const p = seed().projects[0];
  p.cards = [
    {
      ...p.cards[0],
      title: 'Anna Winter',
      aliases: ['Oma Anna', 'Frau Winter'],
    },
  ];
  p.scenes[0].text = 'Oma Anna stand am Fenster. Frau Winter nickte.';
  const result = detectEntities(p);
  assert.ok(
    result.some(
      (e) =>
        e.name === 'Anna Winter' &&
        e.count === 2 &&
        e.knownId === p.cards[0].id,
    ),
  );
});
void test('export preview escapes text, applies spacing and hides author when requested', () => {
  const p = seed().projects[0];
  p.author = 'Geheimer Autor';
  p.scenes[0].text = '<script>alert(1)</script>';
  const html = exportDocument(p, {
    ...exportDefaults,
    anonymous: true,
    titlePage: false,
    sceneHeadings: false,
    gap: 17,
  });
  assert.ok(!html.includes('Geheimer Autor'));
  assert.ok(!html.includes('<script>'));
  assert.ok(html.includes('17pt'));
  assert.ok(!html.includes('<h2>'));
});
void test('local reading position tolerates missing and malformed browser preferences', () => {
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => '{broken' },
  });
  assert.equal(readPosition('p'), null);
  const saved = { sceneId: 's', start: 2, end: 5, scroll: 100, date: 'today' };
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: { getItem: () => JSON.stringify(saved) },
  });
  assert.deepEqual(readPosition('p'), saved);
});
