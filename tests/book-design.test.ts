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

void test('series heading precedes book title and has a larger relative size', () => {
  const p = seed().projects[0];
  p.title = 'Einzelband';
  p.series = { enabled: true, title: 'Die große Reihe', volume: '3' };
  const html = exportDocument(p, { ...exportDefaults, halfTitleSeries: true });
  assert.ok(
    html.indexOf('<p class="series-title">Die große Reihe</p>') <
      html.indexOf('<h1>Einzelband</h1>'),
  );
  assert.ok(html.includes('h1{font-size:1.6em}.series-title{font-size:24pt'));
  const no = exportDocument(p, { ...exportDefaults, halfTitleSeries: false });
  assert.ok(!no.includes('>Die große Reihe<'));
});
void test('prologue title page and repeated chapter heading are independently configurable and survive validation', () => {
  const l = seed(),
    p = l.projects[0];
  p.scenes[0].chapter = 'Vor dem Sturm';
  p.chapterMeta = [
    { name: 'Vor dem Sturm', kind: 'prologue', number: '', part: '' },
  ];
  p.exportOptions = {
    ...exportDefaults,
    titlePage: false,
    prologuePage: true,
    prologueInChapter: false,
    hidePrologue: true,
  };
  const html = exportDocument(p);
  assert.ok(
    html.includes(
      'class="front title-page prologue-page"><h1>Vor dem Sturm</h1>',
    ),
  );
  assert.equal(html.split('<h1>Vor dem Sturm</h1>').length - 1, 1);
  const repeated = exportDocument(p, {
    ...p.exportOptions,
    prologueInChapter: true,
  });
  assert.equal(repeated.split('<h1>Vor dem Sturm</h1>').length - 1, 2);
  assert.doesNotThrow(() => validateLibrary(l));
  const files = unzipSync(epubBytes(p));
  assert.ok(strFromU8(files['EPUB/scene-0.xhtml']).includes('prologue-page'));
  p.scenes[0].chapter = 'Prolog';
  p.chapterMeta = [{ name: 'Prolog', kind: 'prologue', number: '', part: '' }];
  assert.ok(
    !exportDocument(p).includes('class="front title-page prologue-page"'),
  );
});
void test('act title pages appear once per act and precede their chapter text', () => {
  const p = seed().projects[0];
  p.chapterMeta = [
    {
      name: p.scenes[0].chapter,
      kind: 'chapter',
      number: '1',
      part: 'Akt Eins',
    },
    {
      name: p.scenes[2].chapter,
      kind: 'chapter',
      number: '2',
      part: 'Akt Zwei',
    },
  ];
  const html = exportDocument(p, {
    ...exportDefaults,
    partPage: true,
    partInChapter: false,
  });
  assert.equal(html.split('class="front title-page part-page"').length - 1, 2);
  assert.ok(
    html.indexOf('<h1>Akt Eins</h1>') <
      html.indexOf(p.scenes[0].text.slice(0, 30)),
  );
  assert.ok(
    html.indexOf('<h1>Akt Zwei</h1>') > html.indexOf('<h1>Akt Eins</h1>'),
  );
  const noPages = exportDocument(p, {
    ...exportDefaults,
    partPage: false,
    partInChapter: false,
  });
  assert.ok(!noPages.includes('class="front title-page part-page"'));
  assert.ok(!noPages.includes('>Akt Eins<'));
});

void test('print margins and series placement roundtrip and reject invalid settings', () => {
  const l = seed(),
    p = l.projects[0];
  p.series = { enabled: true, title: 'Eine Reihe', volume: '3' };
  p.exportOptions = {
    ...exportDefaults,
    halfTitleSeries: true,
    halfTitleSeriesSize: 32,
    halfTitleSeriesPosition: 'below',
    marginTop: 15,
    marginBottom: 35,
    marginLeft: 20,
    marginRight: 30,
  };
  p.exportPresets = [
    { id: 'layout', name: 'Mein Druck', options: { ...p.exportOptions } },
  ];
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(l))), l);
  const html = exportDocument(p);
  assert.ok(html.includes('@page{size:A4;margin:15mm 30mm 35mm 20mm}'));
  assert.ok(html.includes('.series-title{font-size:32pt'));
  assert.ok(
    html.indexOf(`<h1>${p.title}</h1>`) <
      html.indexOf('<p class="series-title">Eine Reihe</p>'),
  );
  assert.ok(html.includes('min-height:230mm'));
  const above = exportDocument(p, {
    ...p.exportOptions,
    halfTitleSeriesPosition: 'above',
    marginTop: 50,
    marginBottom: 50,
  });
  assert.ok(
    above.indexOf('<p class="series-title">Eine Reihe</p>') <
      above.indexOf(`<h1>${p.title}</h1>`),
  );
  assert.ok(above.includes('min-height:180mm'));
  for (const patch of [
    { marginTop: -1 },
    { marginRight: 51 },
    { marginBottom: Infinity },
    { halfTitleSeriesSize: 0 },
    { halfTitleSeriesPosition: 'invalid' },
  ]) {
    const invalid = structuredClone(l);
    Object.assign(invalid.projects[0].exportOptions!, patch);
    assert.throws(() => validateLibrary(invalid));
  }
});
