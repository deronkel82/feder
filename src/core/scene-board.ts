import type { Library, Project } from './model.ts';
import { chapterDetails, chapterGroups } from './chapters.ts';
import { withSnapshot } from './history.ts';
import { isStandalone, usesScenes } from './project-format.ts';
export function boardChapters(p: Project) {
  if (isStandalone(p)) return [p.scenes[0].chapter];
  const visible = chapterGroups(p).flatMap((g) =>
    g.chapters.map((c) => c.name),
  );
  return [
    ...visible,
    ...(p.chapterMeta || [])
      .map((c) => c.name)
      .filter((n) => !visible.includes(n)),
  ];
}
export function placeScene(
  l: Library,
  projectId: string,
  sceneId: string,
  chapter: string,
  beforeId?: string,
): Library {
  const p = l.projects.find((p) => p.id === projectId);
  if (!p || !usesScenes(p))
    throw Error('Die Szenenmethodik muss eingeschaltet sein.');
  const names = boardChapters(p);
  const source = p.scenes.find((s) => s.id === sceneId);
  if (!source || !names.includes(chapter))
    throw Error('Szene oder Kapitel wurde inzwischen geändert.');
  if (beforeId === sceneId) return l;
  if (
    beforeId &&
    !p.scenes.some((s) => s.id === beforeId && s.chapter === chapter)
  )
    throw Error('Das Einfügeziel wurde geändert.');
  const scenes = names.flatMap((name) => {
    const members = p.scenes.filter(
      (s) => s.chapter === name && s.id !== sceneId,
    );
    if (name === chapter)
      members.splice(
        beforeId ? members.findIndex((s) => s.id === beforeId) : members.length,
        0,
        { ...source, chapter },
      );
    return members;
  });
  if (
    scenes.every(
      (s, i) => s.id === p.scenes[i]?.id && s.chapter === p.scenes[i]?.chapter,
    )
  )
    return l;
  const backed = withSnapshot(l, p, 'Vor Verschieben auf der Szenenwand');
  return {
    ...backed,
    projects: backed.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            scenes,
            chapterMeta: isStandalone(p)
              ? []
              : names.map((name) => chapterDetails(p, name)),
            updated: new Date().toISOString(),
          }
        : x,
    ),
  };
}
