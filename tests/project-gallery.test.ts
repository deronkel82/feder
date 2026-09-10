import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProject, seed, validateLibrary } from '../src/core/model.ts';
import { visibleProjects, moveProject } from '../src/core/project-gallery.ts';
import {
  configureProject,
  isOther,
  usesScenes,
  progressLimits,
  manuscriptCounts,
} from '../src/core/project-format.ts';
import { restoreSnapshot } from '../src/core/history.ts';
import { exportHeading } from '../src/modules/publishing.ts';
import { changeStructure } from '../src/core/structure.ts';
void test('filters and sorts preserve stored manual order and support legacy novels and other', () => {
  const projects = ['Zebra', 'Äpfel', 'Birne', 'Notiz'].map(newProject);
  projects[1].format = 'short';
  projects[2].format = 'novella';
  projects[3].format = 'other';
  projects.forEach((p, i) => (p.updated = `2026-09-0${i + 1}T12:00:00Z`));
  const original = structuredClone(projects);
  assert.deepEqual(
    visibleProjects(projects, 'all', 'alphabet').map((p) => p.title),
    ['Äpfel', 'Birne', 'Notiz', 'Zebra'],
  );
  assert.deepEqual(
    visibleProjects(projects, 'all', 'updated').map((p) => p.title),
    ['Notiz', 'Birne', 'Äpfel', 'Zebra'],
  );
  for (const [i, f] of ['novel', 'short', 'novella', 'other'].entries())
    assert.deepEqual(visibleProjects(projects, f as 'novel', 'manual'), [
      projects[i],
    ]);
  assert.deepEqual(projects, original);
});
void test('manual movement survives backup validation without changing project contents or active selection', () => {
  const l = seed();
  l.projects = ['A', 'B', 'C', 'D'].map(newProject);
  l.active = l.projects[1].id;
  const next = moveProject(l, l.projects[0].id, l.projects[2].id);
  assert.deepEqual(
    next.projects.map((p) => p.title),
    ['B', 'C', 'A', 'D'],
  );
  assert.equal(next.active, l.active);
  assert.deepEqual(next.snapshots, l.snapshots);
  assert.deepEqual(validateLibrary(JSON.parse(JSON.stringify(next))), next);
  assert.deepEqual(
    l.projects.map((p) => p.title),
    ['A', 'B', 'C', 'D'],
  );
  assert.equal(moveProject(l, 'missing', l.active), l);
  assert.equal(moveProject(l, l.active, l.active), l);
  assert.deepEqual(
    moveProject(next, l.projects[0].id, l.projects[1].id).projects,
    l.projects,
  );
});
void test('other is one unconstrained text, with recoverable conversion and title-only export', () => {
  const original = seed();
  const l = configureProject(original, 'other', true);
  const p = l.projects[0];
  assert.ok(isOther(p));
  assert.equal(usesScenes(p), false);
  assert.equal(p.scenes.length, 1);
  assert.equal(p.series.enabled, false);
  assert.deepEqual(manuscriptCounts(p), manuscriptCounts(original.projects[0]));
  assert.equal(progressLimits(p).wordActive, false);
  assert.equal(progressLimits(p).wordExceeded, false);
  assert.equal(progressLimits(p).charExceeded, false);
  assert.equal(exportHeading(p, p.scenes[0]), p.title);
  assert.deepEqual(validateLibrary(l), l);
  assert.throws(() =>
    changeStructure(l, { type: 'newChapter', chapter: 'Nein' }),
  );
  assert.deepEqual(
    restoreSnapshot(l, l.snapshots[0].id).projects[0],
    original.projects[0],
  );
  const bad = structuredClone(l);
  bad.projects[0].scenes.push({ ...p.scenes[0], id: 'another' });
  assert.throws(() => validateLibrary(bad));
});
void test('alphabetic sorting groups series by title and naturally orders volumes without splitting namesakes', () => {
  const book = (title: string, series: string, volume: string) => ({
    ...newProject(title),
    series: { enabled: !!series, title: series, volume },
  });
  const projects = [
    book('Anfang', 'Saga', '10'),
    book('Zukunft', ' saga ', '2'),
    book('Saga', '', ''),
    book('Mitte', 'Saga', '1'),
    book('Ohne Band', 'Saga', ''),
    book('Apfel', '', ''),
    book('Andere', 'Welt', '1'),
  ];
  const sorted = visibleProjects(projects, 'all', 'alphabet');
  assert.deepEqual(
    sorted.map((p) => p.title),
    ['Apfel', 'Mitte', 'Zukunft', 'Anfang', 'Ohne Band', 'Saga', 'Andere'],
  );
  assert.deepEqual(visibleProjects(projects, 'all', 'manual'), projects);
});
void test('status filters combine with type and sort; all finished is required for a finished project', async () => {
  const { projectStatus, projectStatuses } =
    await import('../src/core/project-gallery.ts');
  const idea = newProject('Idee');
  const draft = newProject('Entwurf');
  draft.scenes[0].text = 'Begonnen';
  const revision = newProject('Überarbeitung');
  revision.scenes[0].status = 'Überarbeitung';
  const done = newProject('Fertig');
  done.scenes[0].status = 'Fertig';
  done.format = 'short';
  const projects = [idea, draft, revision, done];
  assert.deepEqual(projects.map(projectStatus), projectStatuses);
  assert.deepEqual(
    visibleProjects(projects, 'all', 'manual', ['Idee', 'Fertig']),
    [idea, done],
  );
  assert.deepEqual(visibleProjects(projects, 'short', 'alphabet', ['Fertig']), [
    done,
  ]);
  assert.deepEqual(
    visibleProjects(projects, 'novel', 'alphabet', ['Fertig']),
    [],
  );
  assert.deepEqual(visibleProjects(projects, 'all', 'manual', []), []);
  done.scenes.push({ ...idea.scenes[0], id: 'unfinished' });
  assert.equal(projectStatus(done), 'Entwurf');
  done.scenes[1].status = 'Überarbeitung';
  assert.equal(projectStatus(done), 'Überarbeitung');
});
