import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, validateLibrary, type Card } from '../src/core/model.ts';
import {
  configureProject,
  usesScenes,
  manuscriptCounts,
  sceneCounts,
  progressLimits,
} from '../src/core/project-format.ts';
import { changeStructure } from '../src/core/structure.ts';
import { placeScene } from '../src/core/scene-board.ts';
import { sendIdea } from '../src/core/plotting.ts';
import { mergeLibraries } from '../src/sync/merge.ts';
import {
  exportMarkdown,
  exportDocument,
  exportEpub,
} from '../src/modules/publishing.ts';
import { unzipSync, strFromU8 } from 'fflate';

void test('all project formats count manuscript words and Unicode characters independently of limits', () => {
  for (const format of ['novel', 'novella', 'short', 'other'] as const) {
    const library = configureProject(seed(), format, false);
    const p = library.projects[0];
    p.scenes.forEach((s, i) => {
      s.text = i ? '' : 'Hallo 😀\r\nWelt';
      s.synopsis = 'Nicht zählen';
    });
    p.wordLimitEnabled = false;
    assert.deepEqual(manuscriptCounts(p), { words: 2, characters: 12 });
    assert.equal(sceneCounts(p.scenes[0]).characters, 12);
    assert.equal(progressLimits(p).words, 2);
    p.scenes[0].text += ' neu';
    assert.deepEqual(manuscriptCounts(p), { words: 3, characters: 16 });
  }
});

void test('short stories retain scene contents and order without chapters and merge safely when disabled', () => {
  const original = seed();
  original.projects[0].scenes.forEach((s, i) => {
    s.text = `Text ${i}`;
  });
  const library = configureProject(original, 'short', true),
    p = library.projects[0];
  assert.ok(usesScenes(p));
  assert.deepEqual(
    p.scenes.map((s) => s.id),
    original.projects[0].scenes.map((s) => s.id),
  );
  assert.equal(new Set(p.scenes.map((s) => s.chapter)).size, 1);
  assert.deepEqual(p.chapterMeta, []);
  assert.deepEqual(validateLibrary(library), library);
  assert.deepEqual(
    mergeLibraries(library, library, library).library.projects[0],
    p,
  );
  const single = configureProject(library, 'short', false);
  assert.equal(single.projects[0].scenes.length, 1);
  assert.equal(single.projects[0].scenes[0].text, 'Text 0\n\nText 1\n\nText 2');
  assert.ok(
    single.snapshots.some(
      (s) => s.project.scenes.length === 3 && s.project.format === 'short',
    ),
  );
  assert.deepEqual(manuscriptCounts(single.projects[0]), manuscriptCounts(p));
  const enabled = configureProject(single, 'short', true);
  assert.equal(enabled.projects[0].scenes.length, 1);
  assert.equal(
    enabled.projects[0].scenes[0].text,
    single.projects[0].scenes[0].text,
  );
});

void test('scene management and ideas work in short stories but chapter actions are rejected', () => {
  let library = configureProject(seed(), 'short', true);
  const p = library.projects[0],
    first = p.scenes[0],
    last = p.scenes.at(-1)!;
  library = changeStructure(library, {
    type: 'renameScene',
    sceneId: first.id,
    name: 'Beginn',
  });
  assert.equal(library.projects[0].scenes[0].title, 'Beginn');
  library = placeScene(library, p.id, last.id, first.chapter, first.id);
  assert.equal(library.projects[0].scenes[0].id, last.id);
  assert.deepEqual(library.projects[0].chapterMeta, []);
  assert.throws(() =>
    changeStructure(library, { type: 'newChapter', chapter: 'Kapitel 2' }),
  );
  assert.throws(() =>
    changeStructure(library, {
      type: 'promote',
      sceneId: first.id,
      chapter: 'Kapitel 2',
    }),
  );
  const idea: Card = {
    id: 'idea',
    title: 'Neue Szene',
    subtitle: 'Plan',
    text: '',
    kind: 'Idee',
    stage: 'Sammlung',
  };
  const sent = sendIdea(library, idea, { kind: 'scene', chapter: 'ignored' });
  library = sent.library;
  assert.equal(library.projects[0].scenes.length, 4);
  assert.equal(library.projects[0].scenes.at(-1)!.synopsis, 'Plan');
  assert.deepEqual(validateLibrary(library), library);
  for (const scene of library.projects[0].scenes)
    library = changeStructure(library, {
      type: 'deleteScene',
      sceneId: scene.id,
    });
  assert.equal(library.projects[0].scenes.length, 1);
  assert.equal(library.projects[0].scenes[0].text, '');
  assert.deepEqual(validateLibrary(library), library);
});

void test('validator rejects multiple short-story chapters and preserves legacy single-text rules', () => {
  const library = configureProject(seed(), 'short', true);
  const invalid = structuredClone(library);
  invalid.projects[0].scenes[1].chapter = 'Verbotenes Kapitel';
  assert.throws(() => validateLibrary(invalid), /keine Kapitel/);
  invalid.projects[0] = { ...library.projects[0], sceneMode: false };
  assert.throws(() => validateLibrary(invalid), /zusammenhängenden Text/);
  const legacy = configureProject(seed(), 'short', false);
  delete legacy.projects[0].sceneMode;
  assert.deepEqual(validateLibrary(legacy), legacy);
  assert.equal(usesScenes(legacy.projects[0]), false);
});

void test('Markdown, HTML and EPUB include every short-story scene in order without chapter headings', async (t) => {
  const p = configureProject(seed(), 'short', true).projects[0];
  p.scenes.forEach((s, i) => {
    s.text = `Manuskriptabschnitt-${i}`;
    s.title = `Szenentitel-${i}`;
  });
  const markdown = exportMarkdown(p),
    html = exportDocument(p);
  for (const output of [markdown, html]) {
    for (let i = 0; i < 3; i++)
      assert.ok(output.includes(`Manuskriptabschnitt-${i}`));
    assert.ok(
      output.indexOf('Manuskriptabschnitt-0') <
        output.indexOf('Manuskriptabschnitt-2'),
    );
    assert.ok(!output.includes('Kapitel 1'));
  }
  let blob: Blob | undefined;
  t.mock.method(URL, 'createObjectURL', (value: Blob) => {
    blob = value;
    return 'blob:test';
  });
  t.mock.method(URL, 'revokeObjectURL', () => {});
  const previousDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  Object.defineProperty(globalThis, 'document', {
    value: { createElement: () => ({ click() {} }) },
    configurable: true,
  });
  t.after(() => {
    if (previousDocument)
      Object.defineProperty(globalThis, 'document', previousDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  });
  await exportEpub(p);
  const files = unzipSync(new Uint8Array(await blob!.arrayBuffer()));
  for (let i = 0; i < 3; i++)
    assert.ok(
      strFromU8(files[`EPUB/scene-${i}.xhtml`]).includes(
        `Manuskriptabschnitt-${i}`,
      ),
    );
  assert.ok(!strFromU8(files['EPUB/nav.xhtml']).includes('Kapitel 1'));
});
