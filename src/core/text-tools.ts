import { uid, type Scene, type Library, type Project } from './model.ts';
import { withSnapshot } from './history.ts';
export type TextComment = {
  id: string;
  start: number;
  end: number;
  quote: string;
  text: string;
  resolved: boolean;
  orphaned?: boolean;
};
export function reanchorComments(
  scene: Scene,
  text: string,
): TextComment[] | undefined {
  if (!scene.comments?.length) return scene.comments;
  let start = 0;
  while (
    start < scene.text.length &&
    start < text.length &&
    scene.text[start] === text[start]
  )
    start++;
  let oldEnd = scene.text.length,
    newEnd = text.length;
  while (
    oldEnd > start &&
    newEnd > start &&
    scene.text[oldEnd - 1] === text[newEnd - 1]
  ) {
    oldEnd--;
    newEnd--;
  }
  const delta = newEnd - oldEnd;
  return scene.comments.map((c) => {
    if (c.orphaned || c.end <= start) return c;
    if (c.start >= oldEnd) {
      const next = { ...c, start: c.start + delta, end: c.end + delta };
      return text.slice(next.start, next.end) === c.quote
        ? next
        : { ...c, orphaned: true };
    }
    return { ...c, orphaned: true };
  });
}
export function mergeComments(scenes: Scene[], skipEmpty: boolean) {
  const result: TextComment[] = [];
  let offset = 0;
  let count = 0;
  for (const s of scenes) {
    if (skipEmpty && !s.text) {
      for (const c of s.comments || []) result.push({ ...c, orphaned: true });
      continue;
    }
    if (count++) offset += 2;
    for (const c of s.comments || [])
      result.push({ ...c, start: c.start + offset, end: c.end + offset });
    offset += s.text.length;
  }
  return result.length ? result : undefined;
}
export function addComment(
  scene: Scene,
  start: number,
  end: number,
  text: string,
): Scene {
  if (!text.trim() || start < 0 || end <= start || end > scene.text.length)
    throw Error(
      'Bitte zuerst eine Textstelle markieren und einen Kommentar eingeben.',
    );
  return {
    ...scene,
    comments: [
      ...(scene.comments || []),
      {
        id: uid(),
        start,
        end,
        quote: scene.text.slice(start, end),
        text: text.trim(),
        resolved: false,
      },
    ],
  };
}
export type Match = {
  id: string;
  sceneId: string;
  start: number;
  end: number;
  before: string;
  context: string;
};
export function findMatches(
  project: Project,
  query: string,
  matchCase: boolean,
  whole: boolean,
): Match[] {
  if (!query) return [];
  const regex = new RegExp(
    query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
    matchCase ? 'gu' : 'giu',
  );
  const hits: Match[] = [];
  for (const s of project.scenes)
    for (const m of s.text.matchAll(regex)) {
      const start = m.index,
        end = start + m[0].length;
      if (
        whole &&
        (/[\p{L}\p{N}_]$/u.test(s.text.slice(0, start)) ||
          /^[\p{L}\p{N}_]/u.test(s.text.slice(end)))
      )
        continue;
      hits.push({
        id: `${s.id}:${start}`,
        sceneId: s.id,
        start,
        end,
        before: m[0],
        context: s.text.slice(
          Math.max(0, start - 45),
          Math.min(s.text.length, end + 45),
        ),
      });
      if (hits.length >= 2000) return hits;
    }
  return hits;
}
export function replaceMatches(
  l: Library,
  projectId: string,
  matches: Match[],
  replacement: string,
): Library {
  const p = l.projects.find((p) => p.id === projectId);
  if (!p) throw Error('Projekt nicht gefunden.');
  if (!matches.length) return l;
  const unique = [...new Map(matches.map((m) => [m.id, m])).values()];
  const scenes = p.scenes.map((s) => {
    const list = unique
      .filter((m) => m.sceneId === s.id)
      .sort((a, b) => b.start - a.start);
    let result = s,
      last = s.text.length;
    for (const m of list) {
      if (
        m.start < 0 ||
        m.end > last ||
        s.text.slice(m.start, m.end) !== m.before
      )
        throw Error('Text geändert. Bitte Vorschau erneut erstellen.');
      const text =
        result.text.slice(0, m.start) + replacement + result.text.slice(m.end);
      result = { ...result, text, comments: reanchorComments(result, text) };
      last = m.start;
    }
    return result;
  });
  if (unique.some((m) => !p.scenes.some((s) => s.id === m.sceneId)))
    throw Error('Textabschnitt nicht mehr vorhanden.');
  const next = withSnapshot(l, p, 'Vor Suchen & Ersetzen');
  return {
    ...next,
    projects: next.projects.map((x) =>
      x.id === p.id ? { ...x, scenes, updated: new Date().toISOString() } : x,
    ),
  };
}
export type DiffPart = { type: 'same' | 'add' | 'remove'; text: string };
export function textDiff(before: string, after: string): DiffPart[] {
  const a = before.match(/\s+|[^\s]+/g) || [],
    b = after.match(/\s+|[^\s]+/g) || [];
  let prefix = 0;
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++;
  let ae = a.length,
    be = b.length;
  while (ae > prefix && be > prefix && a[ae - 1] === b[be - 1]) {
    ae--;
    be--;
  }
  const out: DiffPart[] = [];
  const put = (type: DiffPart['type'], text: string) => {
    if (!text) return;
    const last = out.at(-1);
    if (last?.type === type) last.text += text;
    else out.push({ type, text });
  };
  put('same', a.slice(0, prefix).join(''));
  const x = a.slice(prefix, ae),
    y = b.slice(prefix, be);
  if (x.length * y.length > 250000) {
    put('remove', x.join(''));
    put('add', y.join(''));
  } else {
    const rows = Array.from(
      { length: x.length + 1 },
      () => new Uint32Array(y.length + 1),
    );
    for (let i = x.length - 1; i >= 0; i--)
      for (let j = y.length - 1; j >= 0; j--)
        rows[i][j] =
          x[i] === y[j]
            ? rows[i + 1][j + 1] + 1
            : Math.max(rows[i + 1][j], rows[i][j + 1]);
    let i = 0,
      j = 0;
    while (i < x.length || j < y.length) {
      if (i < x.length && j < y.length && x[i] === y[j]) {
        put('same', x[i++]);
        j++;
      } else if (
        j < y.length &&
        (i === x.length || rows[i][j + 1] >= rows[i + 1][j])
      )
        put('add', y[j++]);
      else put('remove', x[i++]);
    }
  }
  put('same', a.slice(ae).join(''));
  return out;
}
