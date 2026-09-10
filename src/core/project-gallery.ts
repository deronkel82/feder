import type { Project, Library } from './model.ts';
import {
  isStandalone,
  projectFormat,
  type ProjectFormat,
} from './project-format.ts';
export type ProjectSort = 'manual' | 'alphabet' | 'updated';
export function visibleProjects(
  projects: Project[],
  filter: ProjectFormat | 'all',
  sort: ProjectSort,
) {
  const result = projects.filter(
    (p) => filter === 'all' || projectFormat(p) === filter,
  );
  if (sort === 'alphabet') {
    const collator = new Intl.Collator('de', {
      numeric: true,
      sensitivity: 'base',
    });
    const compare = (a: string, b: string) => collator.compare(a, b);
    const series = (p: Project) =>
      !isStandalone(p) && p.series.enabled
        ? p.series.title.trim().replace(/\s+/g, ' ')
        : '';
    result.sort((a, b) => {
      const sa = series(a),
        sb = series(b);
      const group = compare(sa || a.title.trim(), sb || b.title.trim());
      if (group) return group;
      // A standalone title equal to a series name must not split that series.
      if (!!sa !== !!sb) return sa ? -1 : 1;
      if (sa && sb) {
        const va = a.series.volume.trim(),
          vb = b.series.volume.trim();
        if (!!va !== !!vb) return va ? -1 : 1;
        const volume = compare(va, vb);
        if (volume) return volume;
      }
      return compare(a.title, b.title);
    });
  }
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
