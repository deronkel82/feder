import { newProject, type Library } from './model.ts';
import { withSnapshot } from './history.ts';
export function deletedProjects(l: Library) {
  const live = new Set(l.projects.map((p) => p.id));
  const found = new Set<string>();
  return l.snapshots.filter((s) => {
    if (live.has(s.project.id) || found.has(s.project.id)) return false;
    found.add(s.project.id);
    return true;
  });
}
export function deleteProject(l: Library, id: string): Library {
  const p = l.projects.find((p) => p.id === id);
  if (!p) throw Error('Projekt nicht gefunden.');
  const next = withSnapshot(l, p, 'Vor Löschen des Projekts', 'delete');
  const projects = l.projects.filter((p) => p.id !== id);
  if (!projects.length) projects.push(newProject('Neues Projekt'));
  return {
    ...next,
    projects,
    active: projects.some((p) => p.id === l.active) ? l.active : projects[0].id,
  };
}
export function restoreDeletedProject(l: Library, id: string): Library {
  if (l.projects.some((p) => p.id === id)) return l;
  const snapshot = deletedProjects(l).find((s) => s.project.id === id);
  if (!snapshot) throw Error('Gelöschtes Projekt nicht gefunden.');
  return {
    ...l,
    projects: [...l.projects, structuredClone(snapshot.project)],
    active: id,
  };
}
