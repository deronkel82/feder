import type { Project, Library } from './model.ts';
import { projectFormat, type ProjectFormat } from './project-format.ts';
export type ProjectSort = 'manual' | 'alphabet' | 'updated';
export function visibleProjects(
  projects: Project[],
  filter: ProjectFormat | 'all',
  sort: ProjectSort,
) {
  const result = projects.filter(
    (p) => filter === 'all' || projectFormat(p) === filter,
  );
  if (sort === 'alphabet')
    result.sort((a, b) =>
      a.title.localeCompare(b.title, 'de', {
        numeric: true,
        sensitivity: 'base',
      }),
    );
  if (sort === 'updated')
    result.sort(
      (a, b) => (Date.parse(b.updated) || 0) - (Date.parse(a.updated) || 0),
    );
  return result;
}
export function moveProject(library: Library, id: string, target: string) {
  const from = library.projects.findIndex((p) => p.id === id);
  const to = library.projects.findIndex((p) => p.id === target);
  if (from < 0 || to < 0 || from === to) return library;
  const projects = [...library.projects];
  const [moved] = projects.splice(from, 1);
  projects.splice(to, 0, moved);
  return { ...library, projects };
}
