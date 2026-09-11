import { uid, type Library, type Project, type Card } from './model.ts';
import { applyDefaultAuthor } from './authors.ts';
export type ProjectTemplate = { id: string; name: string; project: Project };
export type SharedWorld = { id: string; name: string; cards: Card[] };
export function purgeProject(l: Library, id: string): Library {
  if (l.projects.some((p) => p.id === id))
    throw Error('Bitte das Projekt zuerst in den Papierkorb verschieben.');
  return {
    ...l,
    snapshots: l.snapshots.filter((s) => s.project.id !== id),
    purgedProjectIds: [...new Set([...(l.purgedProjectIds || []), id])],
  };
}
export function saveTemplate(l: Library, p: Project, name: string): Library {
  if (!name.trim()) throw Error('Bitte die Vorlage benennen.');
  const project: Project = {
    ...structuredClone(p),
    id: uid(),
    readingPosition: undefined,
    reviewPasses: undefined,
    syncResolved: undefined,
    cover: undefined,
    worldId: undefined,
    manualStatus: undefined,
    author: '',
    authorOverride: false,
    cards: [],
    dismissedEntities: [],
    scenes: p.scenes.map((s) => ({
      ...s,
      id: uid(),
      text: '',
      notes: '',
      comments: undefined,
      pov: '',
      date: '',
      status: 'Idee',
    })),
    series: { ...p.series, volume: '' },
  };
  return {
    ...l,
    templates: [
      ...(l.templates || []),
      { id: uid(), name: name.trim(), project },
    ],
  };
}
export function instantiateTemplate(
  l: Library,
  id: string,
  title: string,
): Library {
  const template = l.templates?.find((t) => t.id === id);
  if (!template) throw Error('Vorlage nicht gefunden.');
  const p = applyDefaultAuthor(
    {
      ...structuredClone(template.project),
      id: uid(),
      title: title.trim() || template.name,
      scenes: template.project.scenes.map((s) => ({
        ...structuredClone(s),
        id: uid(),
      })),
      updated: new Date().toISOString(),
    },
    l.defaultAuthor,
  );
  return { ...l, projects: [...l.projects, p], active: p.id };
}
