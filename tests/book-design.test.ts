import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, validateLibrary } from '../src/core/model.ts';
import { exportDefaults } from '../src/core/workbench.ts';
import { emptyCharacter } from '../src/core/characters.ts';
import { placeScene, boardChapters } from '../src/core/scene-board.ts';
import {
  exportDocument,
  epubBytes,
  paragraphs,
} from '../src/modules/publishing.ts';
import { unzipSync, strFromU8 } from 'fflate';
import { detectEntities } from '../src/modules/entities.ts';
import { searchProject } from '../src/core/workbench.ts';
const image =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jA9sAAAAASUVORK5CYII=';
void test('new export and character fields roundtrip; legacy presets remain valid', () => {
  const l = seed(),
    p = l.projects[0];
  p.exportOptions = {
    ...exportDefaults,
    coverMode: 'alternative',
    alternativeCover: image,
    imprintEnabled: true,
    imprint: 'Impressum',
    dedicationEnabled: true,
    dedication: 'Für dich',
    contents: true,
    partPage: true,
    header: 'Kopf',
    footer: 'Fuß',
  };
  p.cards[0].character = {
    ...emptyCharacter,
    firstName: 'Mara',
    lastName: 'Winter',
    nickname: 'Funke',
    roles: ['Mentor', 'Love Interest'],
  };
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(l))), l);
  assert.doesNotThrow(() => validateLibrary(seed()));
  const bad = structuredClone(l);
  bad.projects[0].cards[0].character!.roles.push('Statist');
  assert.throws(() => validateLibrary(bad));
  const unsafe = structuredClone(l);
  unsafe.projects[0].exportOptions!.alternativeCover =
    'https://tracker.invalid/p.png';
  assert.throws(() => validateLibrary(unsafe));
});
void test('book front matter order, cover choice, optional title elements and escaped content', () => {
  const p = seed().projects[0];
  p.cover = image;
  p.author = 'Autorname';
  p.series = { enabled: true, title: 'Meine Reihe', volume: '2' };
  const html = exportDocument(p, {
    ...exportDefaults,
    coverMode: 'project',
    halfTitleTitle: false,
    halfTitleSeries: true,
    halfTitleVolume: true,
    imprintEnabled: true,
    imprint: '<script>Impressum</script>',
    dedicationEnabled: true,
    dedication: 'Für dich',
    contents: true,
  });
  assert.ok(
    html.indexOf('class="front cover-image"') <
      html.indexOf('class="front title-page"'),
  );
  assert.ok(
    html.indexOf('class="front imprint"') <
      html.indexOf('class="front title-page dedication"'),
  );
  assert.ok(
    html.indexOf('class="front title-page dedication"') <
      html.indexOf('class="front contents"'),
  );
  assert.ok(html.includes('Meine Reihe'));
  assert.ok(html.includes('Band 2'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('<script>'));
  const none = exportDocument(p, {
    ...exportDefaults,
    coverMode: 'none',
    titlePage: false,
    anonymous: true,
  });
  assert.ok(!none.includes('<img'));
  assert.ok(!none.includes('Autorname'));
});
void test('special labels and act repetition can be disabled independently of act pages', () => {
  const p = seed().projects[0];
  p.scenes[0].chapter = 'Prolog';
  p.scenes[0].title = 'Erste Begegnung';
  p.chapterMeta = [
    { name: 'Prolog', kind: 'prologue', number: '', part: '' },
    {
      name: p.scenes[1].chapter,
      kind: 'chapter',
      number: '1',
      part: 'Erster Akt',
    },
  ];
  const html = exportDocument(p, {
    ...exportDefaults,
    hidePrologue: true,
    partPage: true,
    partInChapter: false,
  });
  assert.ok(!html.includes('>Prolog<'));
  assert.ok(html.includes('Erste Begegnung'));
  assert.equal(html.split('Erster Akt').length - 1, 1);
});
void test('EPUB embeds a cover resource and ordered front matter; optional contents is linear only when enabled', () => {
  const p = seed().projects[0];
  const bytes = epubBytes(p, {
    ...exportDefaults,
    coverMode: 'alternative',
    alternativeCover: image,
    imprintEnabled: true,
    imprint: 'Test',
    dedicationEnabled: true,
    dedication: 'Widmung',
    contents: true,
  });
  const files = unzipSync(bytes);
  const opf = strFromU8(files['EPUB/package.opf']);
  assert.ok(files['EPUB/cover.png']);
  assert.ok(opf.includes('properties="cover-image"'));
  assert.ok(strFromU8(files['EPUB/cover.xhtml']).includes('src="cover.png"'));
  assert.ok(!strFromU8(files['EPUB/cover.xhtml']).includes('data:image'));
  const spine = opf.slice(opf.indexOf('<spine>'));
  assert.ok(
    spine.indexOf('idref="imprint"') < spine.indexOf('idref="dedication"'),
  );
  assert.ok(spine.includes('idref="nav"'));
  const no = unzipSync(epubBytes(p));
  assert.ok(no['EPUB/nav.xhtml']);
  assert.ok(!strFromU8(no['EPUB/package.opf']).includes('idref="nav"'));
});
void test('center blocks support inline emphasis but never execute HTML', () => {
  const html = paragraphs(
    'Davor\n\n:::center\n**Widmung**\nZeile zwei\n:::\n\nDanach <img src=x onerror=alert(1)>',
  );
  assert.ok(
    html.includes(
      '<p class="centered"><strong>Widmung</strong><br/>Zeile zwei</p>',
    ),
  );
  assert.ok(!html.includes('<img'));
  assert.ok(html.endsWith('&gt;</p>'));
});
void test('scene board reorders within and across chapters without losing content, comments or IDs', () => {
  const l = seed(),
    p = l.projects[0],
    s = p.scenes[0];
  s.comments = [
    {
      id: 'c',
      text: 'Notiz',
      quote: 'Als',
      start: 0,
      end: 3,
      resolved: false,
    },
  ];
  const originals = structuredClone(p.scenes);
  const moved = placeScene(l, p.id, s.id, p.scenes[2].chapter, p.scenes[2].id);
  const next = moved.projects[0];
  assert.equal(next.scenes.length, p.scenes.length);
  assert.equal(new Set(next.scenes.map((s) => s.id)).size, p.scenes.length);
  assert.deepEqual(
    next.scenes.find((x) => x.id === s.id),
    { ...s, chapter: p.scenes[2].chapter },
  );
  assert.deepEqual(l.projects[0].scenes, originals);
  assert.ok(moved.snapshots.length > l.snapshots.length);
  assert.doesNotThrow(() => validateLibrary(moved));
  const reorder = placeScene(l, p.id, p.scenes[1].id, s.chapter, s.id);
  assert.equal(reorder.projects[0].scenes[0].id, p.scenes[1].id);
  const empty = placeScene(l, p.id, p.scenes[2].id, s.chapter);
  assert.ok(boardChapters(empty.projects[0]).includes(p.scenes[2].chapter));
  assert.throws(() => placeScene(l, p.id, 'missing', s.chapter));
});
void test('character profile is searchable and nickname resolves to existing figure', () => {
  const l = seed(),
    p = l.projects[0];
  p.cards[0].character = {
    ...emptyCharacter,
    nickname: 'Funke',
    faction: 'Nordbund',
    roles: ['Mentor'],
  };
  p.scenes[0].text = 'Funke betrat das Haus.';
  assert.ok(
    searchProject(p, l, 'Nordbund').some((h) => h.cardId === p.cards[0].id),
  );
  assert.ok(detectEntities(p).some((e) => e.name === p.cards[0].title));
});
