import type { Project } from '../core/model.ts';
export type Entity = {
  key: string;
  name: string;
  kind: 'Figur' | 'Ort';
  sceneIds: string[];
  count: number;
  context: string;
  knownId?: string;
};
export const entityKey = (kind: string, name: string) =>
  kind + ':' + name.trim().toLocaleLowerCase('de');
const excluded = new Set(
  'Sie Er Es Wir Ihr Ich Du Das Die Der Ein Eine Einer Eines Man Niemand Jemand Alle Dann Dort Hier Heute Morgen Gestern Plötzlich Vielleicht Allerdings Schließlich Trotzdem Haus Zimmer Tür Fenster Straße Stadt Dorf Wald Meer Fluss Bahnhof Hafen Schule Universität Krankenhaus Gedanken Wirklichkeit Wahrheit Ruhe'.split(
    ' ',
  ),
);
const name = '[A-ZÄÖÜ][a-zäöüß]+(?:[-’\u0027][A-ZÄÖÜ]?[a-zäöüß]+)?';
const person = new RegExp(
  `\\b(${name}(?: ${name})?)\\s+(?:sagte|fragte|antwortete|flüsterte|rief|dachte|lächelte|ging|kam|sah|nickte|zog|stellte|wusste|wollte|hatte|war)\\b`,
  'gu',
);
const introduced = new RegExp(
  `(?:Herr|Frau|Dr\\.)\\s+(${name}(?: ${name})?)`,
  'gu',
);
const place = new RegExp(
  `(?:in|nach|aus|bei)\\s+(${name}(?: (?:am|an der|im) ${name})?)`,
  'gu',
);
function escaped(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
export function detectEntities(project: Project): Entity[] {
  const out = new Map<string, Entity>();
  const known = project.cards.filter(
    (c) =>
      (c.kind === 'Figur' || c.kind === 'Ort') && c.title.trim().length > 0,
  );
  function add(
    n: string,
    kind: 'Figur' | 'Ort',
    sceneId: string,
    text: string,
    at: number,
    knownId?: string,
  ) {
    const name = n.trim();
    if (!knownId && excluded.has(name.split(' ')[0])) return;
    const key = entityKey(kind, name);
    if (project.dismissedEntities.includes(key)) return;
    const old = out.get(key);
    if (old) {
      old.count++;
      if (!old.sceneIds.includes(sceneId)) old.sceneIds.push(sceneId);
      return;
    }
    out.set(key, {
      key,
      name,
      kind,
      sceneIds: [sceneId],
      count: 1,
      context: text
        .slice(Math.max(0, at - 40), at + name.length + 65)
        .replace(/\n/g, ' '),
      knownId,
    });
  }
  for (const s of project.scenes) {
    const text = s.text;
    const matched = new Set<string>();
    for (const c of known) {
      const aliases = [c.title];
      if (c.kind === 'Figur' && c.title.includes(' ')) {
        const first = c.title.split(' ')[0];
        if (
          known.filter(
            (k) => k.kind === 'Figur' && k.title.split(' ')[0] === first,
          ).length === 1
        )
          aliases.push(first);
      }
      const pattern = new RegExp(
        `(?<![\\p{L}])(?:${aliases
          .map(escaped)
          .sort((a, b) => b.length - a.length)
          .join('|')})(?![\\p{L}])`,
        'gu',
      );
      for (const m of text.matchAll(pattern)) {
        add(c.title, c.kind as 'Figur' | 'Ort', s.id, text, m.index!, c.id);
        matched.add(m[0]);
      }
    }
    for (const [pattern, kind] of [
      [person, 'Figur'],
      [introduced, 'Figur'],
      [place, 'Ort'],
    ] as const) {
      for (const m of text.matchAll(pattern)) {
        const n = m[1];
        if (matched.has(n)) continue;
        add(n, kind, s.id, text, m.index!);
      }
    }
  }
  return [...out.values()].sort(
    (a, b) =>
      Number(!!b.knownId) - Number(!!a.knownId) ||
      b.count - a.count ||
      a.name.localeCompare(b.name, 'de'),
  );
}
