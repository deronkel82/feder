import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newProject } from '../src/core/model.ts';
import { detectEntities, entityKey } from '../src/modules/entities.ts';
void test('local recognition detects people, places and known first-name references', () => {
  const p = seed().projects[0];
  p.scenes[0].text =
    'Mara sagte etwas. Hans fragte nach Berlin. Frau Anna Weber nickte. Sie war in Nebelhain. Das Haus war leer. Er kam aus Deutschland.';
  const found = detectEntities(p);
  assert.ok(
    found.some((e) => e.name === 'Mara Winter' && e.knownId === p.cards[0].id),
  );
  assert.ok(found.some((e) => e.name === 'Hans' && e.kind === 'Figur'));
  assert.ok(found.some((e) => e.name === 'Anna Weber' && e.kind === 'Figur'));
  for (const name of ['Berlin', 'Nebelhain', 'Deutschland'])
    assert.ok(found.some((e) => e.name === name && e.kind === 'Ort'));
  assert.ok(!found.some((e) => ['Sie', 'Das Haus', 'Er'].includes(e.name)));
});
void test('dismissals, empty cards and repeated names across scenes are handled', () => {
  const p = newProject();
  p.cards = [
    {
      id: 'empty',
      title: '',
      kind: 'Figur',
      subtitle: '',
      text: '',
      stage: 'Sammlung',
    },
  ];
  p.scenes[0].text = 'Hans sagte ja. Hans nickte. Er war in Berlin.';
  p.scenes.push({ ...p.scenes[0], id: 'second' });
  p.dismissedEntities = [entityKey('Ort', 'Berlin')];
  const found = detectEntities(p);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Hans');
  assert.equal(found[0].sceneIds.length, 2);
  assert.equal(found[0].count, 4);
});
void test('demo screenshot regression: grandmother Anna is a person, not light, dust or sender', () => {
  const p = seed().projects[0];
  p.scenes[0].text = p.scenes[0].text.replaceAll(
    'ihrer Großmutter',
    'ihrer Großmutter Anna',
  );
  const found = detectEntities(p);
  assert.ok(found.some((e) => e.name === 'Anna' && e.kind === 'Figur'));
  assert.deepEqual(found.map((e) => e.name).sort(), ['Anna', 'Mara Winter']);
});
void test('prepositions require whole words and common nouns with articles are rejected', () => {
  const p = newProject();
  p.scenes[0].text =
    'Kein Staub, kein Absender. Sein Blick war kalt. Das Licht flüsterte. Der Regen sagte nichts. Das Schicksal antwortete. In Berlin war es still. Nach München ging die Reise. Aus Österreich kam ein Brief.';
  assert.deepEqual(
    detectEntities(p)
      .map((e) => e.name)
      .sort(),
    ['Berlin', 'München', 'Österreich'],
  );
});
void test('family, named introductions and umlauts work without a speech verb', () => {
  const p = newProject();
  p.scenes[0].text =
    'Ihre Großmutter Anna lag im Bett. Onkel Jürgen wartete. Eine Frau namens Élodie kam herein. Özgür flüsterte. Die Stadt Nebelhain schlief. Anna nickte.';
  const found = detectEntities(p);
  for (const name of ['Anna', 'Jürgen', 'Élodie', 'Özgür'])
    assert.ok(
      found.some((e) => e.name === name && e.kind === 'Figur'),
      name,
    );
  assert.ok(found.some((e) => e.name === 'Nebelhain' && e.kind === 'Ort'));
  assert.equal(found.find((e) => e.name === 'Anna')!.count, 2);
});
void test('explicit names override weak location guesses, duplicate rules count one mention', () => {
  const p = newProject();
  p.scenes[0].text =
    'Frau Anna Weber nickte. Anna fragte nach Anna. Ihre Großmutter Anna Weber wartete.';
  const found = detectEntities(p);
  assert.equal(found.length, 1);
  assert.equal(found[0].name, 'Anna Weber');
  assert.equal(found[0].kind, 'Figur');
  assert.equal(found[0].count, 4);
});
void test('new scan reflects edits and dismissals while manually created cards remain authoritative', () => {
  const p = newProject();
  p.scenes[0].text = 'Das Licht hatte sich verändert. Ihre Großmutter wartete.';
  assert.equal(detectEntities(p).length, 0);
  p.scenes[0].text = 'Ihre Großmutter Anna wartete.';
  assert.equal(detectEntities(p)[0].name, 'Anna');
  p.scenes[0].text = 'Ihre Großmutter Greta wartete.';
  assert.deepEqual(
    detectEntities(p).map((e) => e.name),
    ['Greta'],
  );
  p.dismissedEntities = [entityKey('Figur', 'Greta')];
  assert.equal(detectEntities(p).length, 0);
  p.cards = [
    {
      id: 'light',
      title: 'Licht',
      kind: 'Figur',
      subtitle: '',
      text: '',
      stage: 'Sammlung',
    },
  ];
  p.scenes[0].text = 'Licht ging nach Hause.';
  assert.equal(detectEntities(p)[0].knownId, 'light');
});
