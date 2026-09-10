import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newProject, validateLibrary } from '../src/core/model.ts';
import {
  textDiff,
  findMatches,
  replaceMatches,
  addComment,
  reanchorComments,
} from '../src/core/text-tools.ts';
import {
  saveTemplate,
  instantiateTemplate,
  purgeProject,
} from '../src/core/library-tools.ts';
import { reviseScene, restoreSnapshot } from '../src/core/history.ts';
import { configureProject } from '../src/core/project-format.ts';
import { changeStructure } from '../src/core/structure.ts';
import { deleteProject } from '../src/core/project-deletion.ts';
import { projectStatus, visibleProjects } from '../src/core/project-gallery.ts';
void test('diff reconstructs both originals with whitespace, additions, removals and bounded large changes', () => {
  for (const [before, after] of [
    ['Hallo alte Welt', 'Hallo neue Welt'],
    ['', 'Neu'],
    ['Alt', ''],
    ['Gleich', 'Gleich'],
    ['A\n\nB', 'A\nB'],
    ['😀 Katze', '😀 Hund'],
    ['a '.repeat(900), 'b '.repeat(900)],
  ]) {
    const diff = textDiff(before, after);
    assert.equal(
      diff
        .filter((p) => p.type !== 'add')
        .map((p) => p.text)
        .join(''),
      before,
    );
    assert.equal(
      diff
        .filter((p) => p.type !== 'remove')
        .map((p) => p.text)
        .join(''),
      after,
    );
  }
});
void test('literal unicode search, selective replacement and stale checks preserve backups and comments', () => {
  const l = seed(),
    p = l.projects[0];
  p.scenes[0].text = 'Mara und Maras Katze. MARA [x]';
  p.scenes[1].text = 'Mara';
  assert.equal(findMatches(p, 'Mara', false, true).length, 3);
  assert.equal(findMatches(p, 'Mara', true, true).length, 2);
  assert.equal(findMatches(p, '[x]', false, false).length, 1);
  p.scenes[0] = addComment(p.scenes[0], 14, 19, 'Katze beschreiben');
  const matches = findMatches(p, 'Mara', false, true);
  const changed = replaceMatches(l, p.id, [matches[0]], 'Anna Marie');
  assert.equal(
    changed.projects[0].scenes[0].text,
    'Anna Marie und Maras Katze. MARA [x]',
  );
  assert.equal(changed.projects[0].scenes[1].text, 'Mara');
  assert.equal(changed.projects[0].scenes[0].comments![0].start, 20);
  assert.deepEqual(
    restoreSnapshot(changed, changed.snapshots[0].id).projects[0],
    p,
  );
  assert.throws(() => replaceMatches(changed, p.id, [matches[0]], 'X'));
  assert.deepEqual(validateLibrary(changed), changed);
});
void test('comments follow preceding edits, become orphaned on overlap, and survive merging', () => {
  const l = seed();
  const p = l.projects[0];
  p.scenes[0].text = 'Hallo Anna';
  p.scenes[1].text = 'Ort';
  p.scenes[0] = addComment(p.scenes[0], 6, 10, 'Name prüfen');
  p.scenes[1] = addComment(p.scenes[1], 0, 3, 'Wo?');
  assert.equal(reanchorComments(p.scenes[0], 'Neu Hallo Anna')![0].start, 10);
  assert.equal(reanchorComments(p.scenes[0], 'Hallo Emma')![0].orphaned, true);
  const edited = reviseScene(l, p.scenes[0].id, { text: 'Hallo Emma' });
  assert.ok(edited.projects[0].scenes[0].comments![0].orphaned);
  const merged = configureProject(l, 'short', false);
  assert.equal(merged.projects[0].scenes[0].comments!.length, 2);
  assert.deepEqual(validateLibrary(merged), merged);
  const collapsed = changeStructure(l, {
    type: 'collapse',
    chapter: p.scenes[0].chapter,
    target: p.scenes[2].chapter,
  });
  assert.deepEqual(validateLibrary(collapsed), collapsed);
  const invalid = structuredClone(l);
  invalid.projects[0].scenes[0].comments![0].end = 100;
  assert.throws(() => validateLibrary(invalid));
});
void test('manual project status overrides filters without changing scene states', () => {
  const p = newProject();
  p.manualStatus = 'Fertig';
  assert.equal(projectStatus(p), 'Fertig');
  assert.equal(p.scenes[0].status, 'Idee');
  assert.equal(visibleProjects([p], 'all', 'manual', ['Fertig']).length, 1);
  delete p.manualStatus;
  assert.equal(projectStatus(p), 'Idee');
});
void test('templates create independent projects without manuscript content, cover, comments or shared links', () => {
  let l = seed();
  l.defaultAuthor = 'Ada';
  l.projects[0].worldId = 'world';
  l.projects[0].manualStatus = 'Fertig';
  l.projects[0].scenes[0] = addComment(l.projects[0].scenes[0], 0, 3, 'Notiz');
  l = saveTemplate(l, l.projects[0], 'Drei Akte');
  const t = l.templates![0];
  const created = instantiateTemplate(l, t.id, 'Neues Buch');
  const p = created.projects.at(-1)!;
  assert.equal(p.author, 'Ada');
  assert.equal(p.scenes.length, 3);
  assert.ok(p.scenes.every((s) => !s.text && !s.comments));
  assert.equal(p.worldId, undefined);
  assert.equal(p.manualStatus, undefined);
  assert.equal(p.cards.length, 0);
  assert.notEqual(p.scenes[0].id, t.project.scenes[0].id);
  assert.deepEqual(validateLibrary(created), created);
});
void test('shared worlds roundtrip with multiple project references; trash purge leaves shared data and other projects intact', () => {
  let l = seed();
  const original = l.projects[0];
  l.projects.push(newProject('Band 2'));
  l.worlds = [{ id: 'world', name: 'Saga', cards: [original.cards[0]] }];
  l.projects.forEach((p) => (p.worldId = 'world'));
  l = deleteProject(l, original.id);
  const purged = purgeProject(l, original.id);
  assert.equal(
    purged.snapshots.filter((s) => s.project.id === original.id).length,
    0,
  );
  assert.equal(purged.worlds![0].cards.length, 1);
  assert.equal(purged.projects.length, 1);
  assert.deepEqual(validateLibrary(purged), purged);
  assert.throws(() => purgeProject(purged, purged.active));
  const bad = structuredClone(purged);
  bad.worlds![0].cards[0].kind = 'invalid' as never;
  assert.throws(() => validateLibrary(bad));
});
