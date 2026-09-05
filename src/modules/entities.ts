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
const stopWords = new Set(
  'Sie Er Es Wir Ihr Ich Du Das Die Der Den Dem Des Ein Eine Einer Eines Einen Einem Kein Keine Keiner Keines Keinen Keinem Man Niemand Jemand Alle Alles Dann Dort Hier Heute Morgen Gestern Plötzlich Vielleicht Allerdings Schließlich Trotzdem Nur Auch Als Schon Noch Wieder Doch Nun Herr Frau Großmutter Großvater Oma Opa Mutter Vater Tante Onkel Schwester Bruder Tochter Sohn'
    .toLocaleLowerCase('de')
    .split(' '),
);
const commonNouns = new Set(
  'Haus Zimmer Tür Fenster Straße Stadt Dorf Wald Meer Fluss Bahnhof Hafen Schule Universität Krankenhaus Gedanken Wirklichkeit Wahrheit Ruhe Licht Staub Absender Umschlag Brief Name Handschrift Schlüssel Schloss Menschen Mensch Koffer Uhr Stimme Schreibtisch Stuhl Regen Flur Fliesen Vorhang Ende Gang Boden Wand Tisch Bett Himmel Sonne Mond Wind Schatten Dunkelheit Nacht Tag Abend Morgen Winter Sommer Frühling Herbst Zeit Jahr Jahren Jahre Wasser Feuer Luft Erde Blick Hand Augen Kopf Herz Angst Hoffnung Leben Tod Weg Arbeit Wort Worte Antwort Frage Stille Nachricht Erinnerung Vergangenheit Zukunft Entfernung Richtung Nähe Ferne Hause Hausein Ort Land Norden Süden Osten Westen Anfang Gruß Grüße Liebe Dank Glück Pech Hilfe Besitz Auftrag Interesse Auftraggeber'
    .toLocaleLowerCase('de')
    .split(' '),
);
const boundary = '(?<![\\p{L}\\p{M}\\p{N}_])';
const end = '(?![\\p{L}\\p{M}\\p{N}_])';
const token = "\\p{Lu}[\\p{Ll}\\p{M}]+(?:[-’']\\p{Lu}?[\\p{Ll}\\p{M}]+)*";
const fullName = `${token}(?: ${token})?`;
const roles =
  'Großmutter|Großvater|Oma|Opa|Mutter|Vater|Tante|Onkel|Schwester|Bruder|Tochter|Sohn|Cousine|Cousin|Enkelin|Enkel|Freundin|Freund|Nachbarin|Nachbar|Professorin|Professor|Doktor|Doktorin|Herrn?|Frau|Dr\\.';
const rules: Array<{ pattern: RegExp; kind: Entity['kind']; strong: boolean }> =
  [
    {
      pattern: new RegExp(
        `${boundary}(?:${roles})\\s+(${fullName})${end}`,
        'gu',
      ),
      kind: 'Figur',
      strong: true,
    },
    {
      pattern: new RegExp(
        `${boundary}(?:namens|genannt|heißt|hiess|hieß)\\s+(${fullName})${end}`,
        'gu',
      ),
      kind: 'Figur',
      strong: true,
    },
    {
      pattern: new RegExp(
        `${boundary}(${fullName}),\\s+(?:(?:ihre?|seine?|meine?|deine?|unsere?|die|der)\\s+)?(?:${roles})${end}`,
        'gu',
      ),
      kind: 'Figur',
      strong: true,
    },
    {
      pattern: new RegExp(
        `${boundary}(?:Stadt|Dorf|Ortschaft|Insel|Königreich)\\s+(${fullName})${end}`,
        'gu',
      ),
      kind: 'Ort',
      strong: true,
    },
    {
      pattern: new RegExp(
        `${boundary}(${fullName})\\s+(?:sagte|fragte|antwortete|flüsterte|rief|dachte|lächelte|nickte|wusste|wollte|erzählte|erwiderte|murmelte|schrie|lachte|weinte|seufzte)${end}`,
        'gu',
      ),
      kind: 'Figur',
      strong: false,
    },
    {
      pattern: new RegExp(
        `${boundary}(?:[Ii]n|[Nn]ach|[Aa]us)\\s+(${token}(?: (?:am|an der|im) ${token})?)${end}`,
        'gu',
      ),
      kind: 'Ort',
      strong: false,
    },
  ];
function escaped(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
type Mention = {
  name: string;
  kind: Entity['kind'];
  sceneId: string;
  text: string;
  at: number;
  knownId?: string;
  strong: boolean;
};
export function detectEntities(project: Project): Entity[] {
  const mentions: Mention[] = [];
  const known = project.cards.filter(
    (c) => (c.kind === 'Figur' || c.kind === 'Ort') && c.title.trim(),
  );
  for (const scene of project.scenes) {
    const text = scene.text;
    for (const card of known) {
      const aliases = [card.title.trim()];
      const first = aliases[0].split(' ')[0];
      if (
        card.kind === 'Figur' &&
        aliases[0].includes(' ') &&
        known.filter((c) => c.title.trim().split(' ')[0] === first).length === 1
      )
        aliases.push(first);
      const pattern = new RegExp(
        `${boundary}(?:${aliases
          .map(escaped)
          .sort((a, b) => b.length - a.length)
          .join('|')})${end}`,
        'gu',
      );
      for (const m of text.matchAll(pattern))
        mentions.push({
          name: card.title.trim(),
          kind: card.kind as Entity['kind'],
          sceneId: scene.id,
          text,
          at: m.index!,
          knownId: card.id,
          strong: true,
        });
    }
    for (const rule of rules) {
      for (const m of text.matchAll(rule.pattern)) {
        const name = m[1];
        const first = name.split(' ')[0].toLocaleLowerCase('de');
        const at = m.index! + m[0].indexOf(name);
        if (stopWords.has(first)) continue;
        if (!rule.strong) {
          if (commonNouns.has(first)) continue;
          const prefix = text.slice(Math.max(0, at - 35), at);
          if (
            /(?:^|[^\p{L}])(?:d(?:er|ie|as|en|em|es)|(?:k?ein|mein|dein|sein|ihr|unser|euer)(?:e|er|es|en|em)?)\s+$/iu.test(
              prefix,
            )
          )
            continue;
        }
        mentions.push({
          name,
          kind: rule.kind,
          sceneId: scene.id,
          text,
          at,
          strong: rule.strong,
        });
      }
    }
  }
  // Prefer explicitly named people over weaker location guesses and fold unique first-name references.
  const names = [
    ...new Set(
      mentions.filter((m) => m.kind === 'Figur' && m.strong).map((m) => m.name),
    ),
  ];
  const out = new Map<string, Entity>();
  const seen = new Set<string>();
  mentions.sort(
    (a, b) =>
      Number(!!b.knownId) - Number(!!a.knownId) ||
      Number(b.strong) - Number(a.strong),
  );
  for (const m of mentions) {
    let name = m.name;
    let kind = m.kind;
    let knownId = m.knownId;
    if (!knownId) {
      const matches = names.filter(
        (n) => n === name || n.startsWith(name + ' '),
      );
      if (matches.length === 1) {
        name = matches[0];
        kind = 'Figur';
        knownId = known.find(
          (c) => c.kind === 'Figur' && c.title.trim() === name,
        )?.id;
      }
    }
    const position = m.sceneId + ':' + m.at;
    if (seen.has(position)) continue;
    seen.add(position);
    const key = entityKey(kind, name);
    if (project.dismissedEntities.includes(key)) continue;
    const old = out.get(key);
    if (old) {
      old.count++;
      if (!old.sceneIds.includes(m.sceneId)) old.sceneIds.push(m.sceneId);
      continue;
    }
    out.set(key, {
      key,
      name,
      kind,
      sceneIds: [m.sceneId],
      count: 1,
      context: m.text
        .slice(Math.max(0, m.at - 40), m.at + m.name.length + 65)
        .replace(/\n/g, ' '),
      knownId,
    });
  }
  return [...out.values()].sort(
    (a, b) =>
      Number(!!b.knownId) - Number(!!a.knownId) ||
      b.count - a.count ||
      a.name.localeCompare(b.name, 'de'),
  );
}
