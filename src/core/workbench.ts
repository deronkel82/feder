import { isStandalone, usesScenes } from './project-format.ts';
import { validBookDesign, type BookDesign } from './book-design.ts';
import { characterSearch } from './characters.ts';
import { type Library, type Project, type Scene, type Card } from './model.ts';
import { withSnapshot } from './history.ts';
import { textDiff, reanchorComments } from './text-tools.ts';
export type ReadingPosition = {
  sceneId: string;
  start: number;
  end: number;
  scroll: number;
  textScroll?: number;
  date: string;
};
export type ReviewPass = {
  id: string;
  title: string;
  checks: { id: string; text: string }[];
  completed: string[];
};
export type ExportOptions = BookDesign & {
  font: 'serif' | 'sans' | 'mono';
  size: number;
  line: number;
  gap: number;
  chapterBreak: boolean;
  sceneHeadings: boolean;
  titlePage: boolean;
  anonymous: boolean;
};
export type ExportPreset = { id: string; name: string; options: ExportOptions };
export const exportDefaults: ExportOptions = {
  font: 'serif',
  size: 12,
  line: 1.6,
  gap: 8,
  chapterBreak: true,
  sceneHeadings: true,
  titlePage: true,
  anonymous: false,
};
export function validExport(o: ExportOptions) {
  return (
    o &&
    validBookDesign(o) &&
    ['serif', 'sans', 'mono'].includes(o.font) &&
    Number.isFinite(o.size) &&
    o.size >= 8 &&
    o.size <= 24 &&
    Number.isFinite(o.line) &&
    o.line >= 1 &&
    o.line <= 3 &&
    Number.isFinite(o.gap) &&
    o.gap >= 0 &&
    o.gap <= 30 &&
    ['chapterBreak', 'sceneHeadings', 'titlePage', 'anonymous'].every(
      (k) => typeof o[k as keyof ExportOptions] === 'boolean',
    )
  );
}
export function validPosition(p: ReadingPosition) {
  return (
    p &&
    typeof p.sceneId === 'string' &&
    typeof p.date === 'string' &&
    ['start', 'end', 'scroll'].every(
      (k) =>
        Number.isFinite(p[k as keyof ReadingPosition]) &&
        Number(p[k as keyof ReadingPosition]) >= 0,
    ) &&
    Number.isInteger(p.start) &&
    Number.isInteger(p.end) &&
    (p.textScroll === undefined ||
      (Number.isFinite(p.textScroll) && p.textScroll >= 0)) &&
    p.end >= p.start
  );
}
export type SearchHit = {
  key: string;
  category: string;
  title: string;
  text: string;
  sceneId?: string;
  cardId?: string;
  worldId?: string;
  field: string;
  start: number;
  end: number;
};
export function searchProject(
  p: Project,
  library: Library,
  query: string,
): SearchHit[] {
  const q = query.trim();
  if (!q) return [];
  const pattern = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'iu');
  const hits: SearchHit[] = [];
  const add = (
    key: string,
    category: string,
    title: string,
    text: string,
    field: string,
    extra: Partial<SearchHit>,
  ) => {
    const m = pattern.exec(text);
    if (m)
      hits.push({
        key,
        category,
        title,
        text,
        field,
        start: m.index,
        end: m.index + m[0].length,
        ...extra,
      });
  };
  for (const s of p.scenes) {
    for (const [field, category] of [
      ['text', 'Manuskript'],
      ['synopsis', 'Zusammenfassungen'],
      ['notes', 'Notizen'],
      ['title', 'Kapitel & Szenen'],
      ['chapter', 'Kapitel & Szenen'],
      ['pov', 'Perspektiven'],
    ] as const)
      add(
        s.id + field,
        category,
        isStandalone(p)
          ? usesScenes(p)
            ? s.title
            : p.title
          : s.chapter + ' · ' + s.title,
        s[field],
        field,
        { sceneId: s.id },
      );
    for (const c of s.comments || [])
      add(c.id, 'Kommentare', s.title, c.text + '\n' + c.quote, 'comment', {
        sceneId: s.id,
        start: c.start,
        end: c.end,
      });
  }
  const cards = (cards: Card[], worldId?: string) => {
    for (const c of cards)
      add(
        (worldId || 'local') + c.id,
        {
          Figur: 'Figuren',
          Ort: 'Orte',
          Idee: 'Ideen',
          Recherche: 'Recherche',
        }[c.kind],
        c.title,
        [
          c.title,
          c.subtitle,
          c.text,
          characterSearch(c.character),
          ...(c.aliases || []),
        ].join('\n'),
        'card',
        { cardId: c.id, worldId },
      );
  };
  cards(p.cards);
  const world = library.worlds?.find((w) => w.id === p.worldId);
  if (world) cards(world.cards, world.id);
  return hits;
}
export function differenceGroups(before: string, after: string) {
  const groups: { same: boolean; before: string; after: string }[] = [];
  for (const part of textDiff(before, after)) {
    const same = part.type === 'same';
    let last = groups.at(-1);
    if (!last || last.same !== same) {
      last = { same, before: '', after: '' };
      groups.push(last);
    }
    if (part.type !== 'add') last.before += part.text;
    if (part.type !== 'remove') last.after += part.text;
  }
  return groups;
}
export function combineText(before: string, after: string, remote: number[]) {
  return differenceGroups(before, after)
    .map((g, i) => (g.same || !remote.includes(i) ? g.before : g.after))
    .join('');
}
export function applyComparison(
  l: Library,
  target: Project,
  source: Project,
  texts: Record<string, string>,
): Library {
  if (
    target.id === source.id ||
    l.projects.find((p) => p.id === target.id) !== target ||
    l.projects.find((p) => p.id === source.id) !== source
  )
    throw Error(
      'Ein Projekt wurde inzwischen geändert. Bitte Vergleich neu öffnen.',
    );
  let next = withSnapshot(l, target, 'Vor Zusammenführen mit ' + source.title);
  next = withSnapshot(next, source, 'Vergleichsquelle: ' + source.title);
  const scenes: Scene[] = target.scenes.map((s) =>
    texts[s.id] === undefined
      ? s
      : { ...s, text: texts[s.id], comments: reanchorComments(s, texts[s.id]) },
  );
  for (const s of source.scenes)
    if (!scenes.some((t) => t.id === s.id) && texts[s.id] !== undefined)
      scenes.push({ ...structuredClone(s), text: texts[s.id] });
  return {
    ...next,
    projects: next.projects.map((p) =>
      p.id === target.id
        ? { ...p, scenes, updated: new Date().toISOString() }
        : p.id === source.id
          ? { ...p, syncResolved: true }
          : p,
    ),
  };
}
