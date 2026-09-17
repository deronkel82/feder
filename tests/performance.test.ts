import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from '../src/core/autosave.ts';
import { seed, words } from '../src/core/model.ts';
import { manuscriptCounts, sceneCounts } from '../src/core/project-format.ts';
import { detectEntities, recognitionInput } from '../src/modules/entities.ts';
import { analyze } from '../src/modules/analysis.ts';

void test('autosave coalesces typing, has a deadline and flushes the latest state once', (t) => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  const writes: number[] = [];
  const saver = createAutosave<number>((v) => writes.push(v), 450, 2000);
  for (let i = 0; i < 20; i++) {
    saver.schedule(i);
    t.mock.timers.tick(100);
  }
  assert.deepEqual(writes, [19]);
  saver.schedule(20);
  t.mock.timers.tick(449);
  assert.deepEqual(writes, [19]);
  saver.schedule(21);
  saver.flush();
  saver.flush();
  t.mock.timers.tick(3000);
  assert.deepEqual(writes, [19, 21]);
  saver.schedule(22);
  t.mock.timers.tick(450);
  assert.deepEqual(writes, [19, 21, 22]);
});
void test('large manuscripts retain exact counts across edits, Unicode, CRLF, empty scenes and reordering', () => {
  const p = seed().projects[0];
  const text =
    'Mara betrat das alte Haus. Eigentlich wollte sie wirklich nur ihren Brief abholen. '.repeat(
      100,
    );
  p.scenes = Array.from({ length: 100 }, (_, i) => ({
    ...p.scenes[0],
    id: String(i),
    text,
  }));
  assert.equal(manuscriptCounts(p).words, 130000);
  const cached = sceneCounts(p.scenes[1]);
  p.scenes[0] = { ...p.scenes[0], text: '😀 Hallo\r\nWelt!\rEin Text.' };
  p.scenes[2].text = '';
  p.scenes.reverse();
  const combined = p.scenes
    .map((s) => s.text)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\r\n?/g, '\n');
  assert.deepEqual(manuscriptCounts(p), {
    words: words(combined),
    characters: Array.from(combined).length,
  });
  assert.equal(sceneCounts(p.scenes[98]), cached);
  const single = { ...p, scenes: [{ ...p.scenes[0], text: text.repeat(100) }] };
  assert.equal(manuscriptCounts(single).words, 130000);
  const findings = analyze(single.scenes[0].text);
  assert.ok(findings.length > 80);
  assert.ok(
    findings.every(
      (f) => f.start >= 0 && f.end <= single.scenes[0].text.length,
    ),
  );
});
void test('compact recognition input preserves results without transferring covers and unrelated manuscript metadata', () => {
  const p = seed().projects[0];
  const input = recognitionInput(p);
  assert.deepEqual(detectEntities(input), detectEntities(p));
  assert.ok(!('cover' in input));
  assert.deepEqual(Object.keys(input.scenes[0]), ['id', 'text']);
});
