import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, words, moveScene, validateLibrary } from '../src/core/model.ts';
import { analyze } from '../src/modules/analysis.ts';
void test('German words and hyphenation are counted consistently', () => {
  assert.equal(words('„Über die Straße“, sagt Anne-Marie. 2026!'), 6);
  assert.equal(words(''), 0);
});
void test('scene order moves content and keeps original immutable', () => {
  const s = seed().projects[0].scenes;
  const moved = moveScene(s, s[1].id, -1);
  assert.equal(moved[0].id, s[1].id);
  assert.equal(moved[1].text, s[0].text);
  assert.equal(moveScene(s, s[0].id, -1), s);
});
void test('complete backups roundtrip and malformed imports are refused', () => {
  const data = seed();
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(data))), data);
  assert.throws(() => validateLibrary({ version: 2 }));
  const invalid = seed();
  invalid.projects[0].scenes = [];
  assert.throws(() => validateLibrary(invalid));
  const dup = seed();
  dup.projects.push(dup.projects[0]);
  assert.throws(() => validateLibrary(dup));
  const badSnapshot = seed();
  badSnapshot.snapshots = [
    {
      id: 'x',
      date: '2026',
      project: {} as (typeof badSnapshot.projects)[number],
    },
  ];
  assert.throws(() => validateLibrary(badSnapshot));
});
void test('analysis positions refer to exact original text', () => {
  const t = 'Eigentlich war das Fenster offen. Durch das Fenster fiel Licht.';
  const f = analyze(t);
  assert.equal(t.slice(f[0].start, f[0].end), 'Eigentlich');
  const repetition = f.find((x) => x.kind === 'Wiederholung')!;
  assert.equal(t.slice(repetition.start, repetition.end), 'Fenster');
  assert.equal(analyze('Hallo Welt.').length, 0);
  assert.ok(
    analyze('Wort '.repeat(30) + '.').some((x) => x.kind === 'Langer Satz'),
  );
});
