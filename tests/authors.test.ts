import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newProject, validateLibrary } from '../src/core/model.ts';
import {
  applyDefaultAuthor,
  hasOwnAuthor,
  setAuthorOverride,
  setDefaultAuthor,
} from '../src/core/authors.ts';
import { deleteProject } from '../src/core/project-deletion.ts';
void test('default author populates new and empty projects, preserving legacy authors and snapshots', () => {
  const l = seed();
  l.projects.push({ ...newProject('Pseudonym'), author: 'Ada' });
  const previous = structuredClone(l);
  const next = setDefaultAuthor(l, '  Anna  ');
  assert.equal(next.defaultAuthor, 'Anna');
  assert.equal(next.projects[0].author, 'Anna');
  assert.equal(hasOwnAuthor(next.projects[0]), false);
  assert.equal(next.projects[1].author, 'Ada');
  assert.equal(hasOwnAuthor(next.projects[1]), true);
  assert.equal(
    applyDefaultAuthor(newProject(), next.defaultAuthor).author,
    'Anna',
  );
  assert.deepEqual(l, previous);
  assert.deepEqual(next.snapshots, l.snapshots);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(next))), next);
});
void test('overrides including an explicitly empty author survive default changes; disabling rejoins default', () => {
  let l = setDefaultAuthor(seed(), 'Anna');
  l.projects[0] = {
    ...setAuthorOverride(l.projects[0], true, l.defaultAuthor),
    author: '',
  };
  l = setDefaultAuthor(l, 'Ben');
  assert.equal(l.projects[0].author, '');
  l.projects[0] = setAuthorOverride(l.projects[0], false, l.defaultAuthor);
  assert.equal(l.projects[0].author, 'Ben');
  l = setDefaultAuthor(l, 'Clara');
  assert.equal(l.projects[0].author, 'Clara');
  assert.equal(deleteProject(l, l.active).projects[0].author, 'Clara');
  assert.equal(setDefaultAuthor(l, '').projects[0].author, '');
});
void test('malformed author preferences are rejected while old backups stay valid', () => {
  const l = seed();
  assert.deepEqual(validateLibrary(l), l);
  assert.throws(() => validateLibrary({ ...l, defaultAuthor: 42 }));
  assert.throws(() =>
    validateLibrary({
      ...l,
      projects: [{ ...l.projects[0], authorOverride: 'yes' }],
    }),
  );
});
