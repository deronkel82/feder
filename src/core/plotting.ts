import { newScene, type Library, type Card } from './model.ts';
import { appendToChapter } from './structure.ts';
import { withSnapshot } from './history.ts';
import { orderedScenes } from './chapters.ts';
export function sendIdea(
  library: Library,
  card: Card,
  target: { kind: 'scene' | 'chapter'; chapter: string },
) {
  const p = library.projects.find((p) => p.id === library.active)!;
  if (card.kind !== 'Idee' || !card.title.trim())
    throw Error('Bitte der Idee zuerst einen Titel geben.');
  const stored = p.cards.find((c) => c.id === card.id);
  const linked = stored?.manuscriptSceneId || card.manuscriptSceneId;
  if (linked && p.scenes.some((s) => s.id === linked))
    return { library, sceneId: linked };
  const chapter = target.chapter.trim();
  if (!chapter) throw Error('Bitte ein Zielkapitel angeben.');
  const exists = p.scenes.some((s) => s.chapter === chapter);
  if (target.kind === 'chapter' && exists)
    throw Error('Dieser Kapitelname existiert bereits.');
  if (target.kind === 'scene' && !exists)
    throw Error('Zielkapitel nicht gefunden.');
  const scene = {
    ...newScene(chapter),
    title: card.title.trim(),
    synopsis: [card.subtitle, card.text].filter(Boolean).join('\n\n'),
  };
  const updatedCard = {
    ...card,
    stage: 'Im Manuskript' as const,
    manuscriptSceneId: scene.id,
  };
  const next = withSnapshot(library, p, 'Vor Übernahme einer Idee');
  return {
    library: {
      ...next,
      projects: next.projects.map((x) =>
        x.id === p.id
          ? {
              ...x,
              scenes: orderedScenes({
                ...x,
                scenes: appendToChapter(x.scenes, scene),
              }),
              cards: x.cards.some((c) => c.id === card.id)
                ? x.cards.map((c) => (c.id === card.id ? updatedCard : c))
                : [...x.cards, updatedCard],
              updated: new Date().toISOString(),
            }
          : x,
      ),
    },
    sceneId: scene.id,
  };
}
