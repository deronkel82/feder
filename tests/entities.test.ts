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
