import { isShort, usesScenes } from './project-format.ts';
import { chapterDetails, orderedScenes, type ChapterMeta } from './chapters.ts';
import { moveScene, newScene, type Scene, type Library } from './model.ts';
import { withSnapshot } from './history.ts';
export type StructureAction =
  | {
      type: 'move' | 'promote';
      sceneId: string;
      chapter: string;
      meta?: ChapterMeta;
    }
  | { type: 'rename'; chapter: string; name: string; meta?: ChapterMeta }
  | { type: 'collapse'; chapter: string; target: string }
  | { type: 'deleteScene'; sceneId: string }
  | { type: 'deleteChapter'; chapter: string }
  | { type: 'newChapter'; chapter: string; meta?: ChapterMeta };
export function groupScenes(scenes: Scene[]) {
  const chapters = [...new Set(scenes.map((s) => s.chapter))];
  return chapters.flatMap((c) => scenes.filter((s) => s.chapter === c));
}
export function appendToChapter(scenes: Scene[], scene: Scene) {
  const grouped = groupScenes(scenes);
  const last = grouped.findLastIndex((s) => s.chapter === scene.chapter);
  grouped.splice(last < 0 ? grouped.length : last + 1, 0, scene);
  return grouped;
}
export function reorderInChapter(scenes: Scene[], id: string, delta: number) {
  const source = scenes.find((s) => s.id === id);
  if (!source) return scenes;
  return [...new Set(scenes.map((s) => s.chapter))].flatMap((chapter) => {
    const members = scenes.filter((s) => s.chapter === chapter);
    return chapter === source.chapter ? moveScene(members, id, delta) : members;
  });
}
export function changeStructure(
  library: Library,
  action: StructureAction,
): Library {
  const project = library.projects.find((p) => p.id === library.active)!;
  if (isShort(project))
    throw Error('Kurzgeschichten verwenden einen zusammenhängenden Text.');
  if (
    !usesScenes(project) &&
    ['move', 'promote', 'collapse', 'deleteScene'].includes(action.type)
  )
    throw Error('Die Szenenmethodik ist für dieses Projekt abgeschaltet.');
  let scenes = orderedScenes(project);
  let chapterMeta = [...new Set(scenes.map((s) => s.chapter))].map((name) =>
    chapterDetails(project, name),
  );
  const chapters = new Set(scenes.map((s) => s.chapter));
  const required = (name: string) => {
    if (!name.trim()) throw Error('Bitte einen Kapitelnamen eingeben.');
    return name.trim();
  };
  if (action.type === 'move' || action.type === 'promote') {
    const source = scenes.find((s) => s.id === action.sceneId);
    if (!source) throw Error('Szene nicht gefunden.');
    const target = required(action.chapter);
    if (action.type === 'promote' && chapters.has(target))
      throw Error('Dieser Kapitelname existiert bereits.');
    if (action.type === 'move' && !chapters.has(target))
      throw Error('Zielkapitel nicht gefunden.');
    if (target === source.chapter) return library;
    const rest = scenes.filter((s) => s.id !== source.id);
    const moved = { ...source, chapter: target };
    if (action.type === 'promote') {
      const last = rest.findLastIndex((s) => s.chapter === source.chapter);
      rest.splice(
        last < 0 ? scenes.findIndex((s) => s.id === source.id) : last + 1,
        0,
        moved,
      );
      scenes = rest;
    } else scenes = appendToChapter(rest, moved);
  } else if (action.type === 'rename') {
    const name = required(action.name);
    if (name !== action.chapter && chapters.has(name))
      throw Error('Dieser Kapitelname existiert bereits.');
    scenes = scenes.map((s) =>
      s.chapter === action.chapter ? { ...s, chapter: name } : s,
    );
    chapterMeta = chapterMeta.map((c) =>
      c.name === action.chapter ? { ...(action.meta || c), name } : c,
    );
  } else if (action.type === 'collapse') {
    const target = required(action.target);
    if (target === action.chapter)
      throw Error('Bitte ein anderes Zielkapitel wählen.');
    if (!chapters.has(target)) throw Error('Zielkapitel nicht gefunden.');
    const source = scenes.filter((s) => s.chapter === action.chapter);
    if (!source.length) throw Error('Kapitel nicht gefunden.');
    const merged: Scene = {
      ...source[0],
      title: action.chapter,
      chapter: target,
      text: source.map((s) => s.text).join('\n\n'),
      synopsis: source
        .map((s) => s.synopsis)
        .filter(Boolean)
        .join('\n\n'),
      status: source.every((s) => s.status === source[0].status)
        ? source[0].status
        : 'Entwurf',
      notes:
        source.length === 1
          ? source[0].notes
          : source
              .map(
                (s) =>
                  `${s.title}\nStatus: ${s.status}\nPerspektive: ${s.pov}\nZeitpunkt: ${s.date}\n${s.notes}`,
              )
              .join('\n\n'),
    };
    scenes = appendToChapter(
      scenes.filter((s) => s.chapter !== action.chapter),
      merged,
    );
  } else if (action.type === 'deleteScene')
    scenes = scenes.filter((s) => s.id !== action.sceneId);
  else if (action.type === 'deleteChapter')
    scenes = scenes.filter((s) => s.chapter !== action.chapter);
  else {
    const chapter = required(action.chapter);
    if (chapters.has(chapter))
      throw Error('Dieser Kapitelname existiert bereits.');
    scenes.push(newScene(chapter));
  }
  if ('meta' in action && action.meta && action.type !== 'rename') {
    const name =
      action.type === 'promote' || action.type === 'newChapter'
        ? action.chapter
        : '';
    if (name) chapterMeta.push({ ...action.meta, name: name.trim() });
  }
  if (!scenes.length) scenes = [newScene()];
  chapterMeta = chapterMeta
    .filter((c) => scenes.some((s) => s.chapter === c.name))
    .map((c) => ({
      ...c,
      part: c.kind === 'chapter' ? c.part.trim() : '',
      number: c.kind === 'chapter' ? c.number.trim() : '',
    }));
  scenes = orderedScenes({ ...project, chapterMeta, scenes });
  const deleting =
    action.type === 'deleteScene' || action.type === 'deleteChapter';
  const next = withSnapshot(
    library,
    project,
    deleting
      ? 'Vor Löschen aus dem Manuskript'
      : 'Vor Änderung der Kapitelstruktur',
    deleting ? 'delete' : 'manual',
  );
  return {
    ...next,
    projects: next.projects.map((p) =>
      p.id === project.id
        ? { ...p, scenes, chapterMeta, updated: new Date().toISOString() }
        : p,
    ),
  };
}
