import { type Project, type Library, type Scene, words } from './model.ts';
import { orderedScenes } from './chapters.ts';
import { withSnapshot } from './history.ts';
export type ProjectFormat = 'novel' | 'novella' | 'short';
export const formatNames = {
  novel: 'Roman',
  novella: 'Novelle / Erzählung',
  short: 'Kurzgeschichte',
};
export const projectFormat = (p: Project): ProjectFormat => p.format || 'novel';
export const isShort = (p: Project) => projectFormat(p) === 'short';
export const usesScenes = (p: Project) => !isShort(p) && p.sceneMode !== false;
export const defaultTarget = (format: ProjectFormat) =>
  ({ novel: 50000, novella: 20000, short: 2500 })[format];
export function manuscriptCounts(p: Project) {
  const text = orderedScenes(p)
    .map((s) => s.text)
    .filter(Boolean)
    .join('\n\n')
    .replace(/\r\n?/g, '\n');
  return { words: words(text), characters: Array.from(text).length };
}
export function progressLimits(p: Project) {
  const counts = manuscriptCounts(p);
  const wordActive = !isShort(p) || p.wordLimitEnabled !== false;
  return {
    ...counts,
    wordActive,
    wordExceeded: isShort(p) && wordActive && counts.words > p.target,
    charExceeded:
      isShort(p) && !!p.charTarget && counts.characters > p.charTarget,
  };
}
function merged(scenes: Scene[]): Scene {
  const first = scenes[0];
  if (scenes.length === 1) return first;
  return {
    ...first,
    text: scenes
      .map((s) => s.text)
      .filter(Boolean)
      .join('\n\n'),
    synopsis: scenes
      .map((s) => s.synopsis)
      .filter(Boolean)
      .join('\n\n'),
    notes: scenes
      .map(
        (s) =>
          `${s.title}\nStatus: ${s.status}\nPerspektive: ${s.pov}\nZeitpunkt: ${s.date}\n${s.notes}`,
      )
      .join('\n\n'),
    status: scenes.every((s) => s.status === first.status)
      ? first.status
      : 'Entwurf',
  };
}
export function configureProject(
  l: Library,
  format: ProjectFormat,
  sceneMode: boolean,
) {
  const p = l.projects.find((p) => p.id === l.active)!;
  const all = orderedScenes(p);
  const groups =
    format === 'short'
      ? [all]
      : sceneMode
        ? all.map((s) => [s])
        : [...new Set(all.map((s) => s.chapter))].map((c) =>
            all.filter((s) => s.chapter === c),
          );
  const idMap = new Map<string, string>();
  const scenes = groups.map((g) => {
    for (const s of g) idMap.set(s.id, g[0].id);
    return merged(g);
  });
  const next = withSnapshot(
    l,
    p,
    'Vor Änderung der Projektart / Szenenmethodik',
  );
  return {
    ...next,
    projects: next.projects.map((x) =>
      x.id === p.id
        ? {
            ...x,
            format,
            sceneMode: format === 'short' ? false : sceneMode,
            scenes,
            chapterMeta: format === 'short' ? [] : x.chapterMeta,
            series:
              format === 'short' ? { ...x.series, enabled: false } : x.series,
            cards: x.cards.map((c) =>
              c.manuscriptSceneId
                ? {
                    ...c,
                    manuscriptSceneId:
                      idMap.get(c.manuscriptSceneId) || c.manuscriptSceneId,
                  }
                : c,
            ),
            updated: new Date().toISOString(),
          }
        : x,
    ),
  };
}
