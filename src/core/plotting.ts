import { isShort, usesScenes } from './project-format.ts';
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
  if (isShort(p) && target.kind === 'chapter')
    throw Error('Kurzgeschichten haben keine Kapitel.');
  const chapter = isShort(p) ? p.scenes[0].chapter : target.chapter.trim();
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
  const appendPlan = !usesScenes(p) && target.kind === 'scene';
  const existing = appendPlan
    ? p.scenes.find((s) => s.chapter === chapter)
    : undefined;
  const sceneId = existing?.id || scene.id;
  const updatedCard = {
    ...card,
    stage: 'Im Manuskript' as const,
    manuscriptSceneId: sceneId,
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
                scenes: existing
                  ? x.scenes.map((s) =>
                      s.id === existing.id
                        ? {
                            ...s,
                            synopsis: [s.synopsis, scene.synopsis]
                              .filter(Boolean)
                              .join('\n\n'),
                          }
                        : s,
                    )
                  : appendToChapter(x.scenes, scene),
              }),
              cards: x.cards.some((c) => c.id === card.id)
                ? x.cards.map((c) => (c.id === card.id ? updatedCard : c))
                : [...x.cards, updatedCard],
              updated: new Date().toISOString(),
            }
          : x,
      ),
    },
    sceneId,
  };
}
