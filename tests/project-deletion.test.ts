import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newProject, validateLibrary } from '../src/core/model.ts';
import { withSnapshot } from '../src/core/history.ts';
import {
  deleteProject,
  deletedProjects,
  restoreDeletedProject,
} from '../src/core/project-deletion.ts';
void test('deleting active project keeps others and full recoverable project with all versions', () => {
  let l = seed();
  const original = structuredClone(l.projects[0]);
  l = withSnapshot(l, original, 'Entwurf');
  l.projects.push(newProject('Anderes Buch'));
  const next = deleteProject(l, original.id);
  assert.equal(next.projects.length, 1);
  assert.equal(next.active, l.projects[1].id);
  assert.equal(next.snapshots.length, 2);
  assert.deepEqual(deletedProjects(next)[0].project, original);
  assert.deepEqual(validateLibrary(next), next);
  const restored = restoreDeletedProject(next, original.id);
  assert.equal(restored.active, original.id);
  assert.deepEqual(restored.projects.at(-1), original);
  assert.equal(restored.snapshots.length, 2);
  assert.equal(deletedProjects(restored).length, 0);
  assert.equal(restoreDeletedProject(restored, original.id), restored);
  assert.equal(l.projects.length, 2);
});
void test('last project can be deleted without restoring demo text, backup survives JSON roundtrip', () => {
  const l = seed();
  const next = deleteProject(l, l.active);
  assert.equal(next.projects.length, 1);
  assert.notEqual(next.active, l.active);
  assert.equal(next.projects[0].scenes[0].text, '');
  assert.equal(next.projects[0].cards.length, 0);
  const imported = validateLibrary(JSON.parse(JSON.stringify(next)));
  assert.deepEqual(deletedProjects(imported)[0].project, l.projects[0]);
  assert.deepEqual(
    restoreDeletedProject(imported, l.active).projects.at(-1),
    l.projects[0],
  );
});
void test('deleting inactive project preserves selection and rejects unknown IDs', () => {
  const l = seed();
  const other = newProject('Andere');
  l.projects.push(other);
  assert.equal(deleteProject(l, other.id).active, l.active);
  assert.throws(() => deleteProject(l, 'missing'));
  assert.throws(() => restoreDeletedProject(l, 'missing'));
});
