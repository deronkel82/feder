export type Scene = {
  id: string;
  title: string;
  chapter: string;
  text: string;
  synopsis: string;
  status: 'Idee' | 'Entwurf' | 'Überarbeitung' | 'Fertig';
  date: string;
  pov: string;
  notes: string;
};
export type Card = {
  id: string;
  title: string;
  subtitle: string;
  text: string;
  kind: 'Figur' | 'Ort' | 'Recherche' | 'Idee';
  stage: 'Sammlung' | 'Entwicklung' | 'Im Manuskript';
};
export type Project = {
  id: string;
  title: string;
  author: string;
  target: number;
  scenes: Scene[];
  cards: Card[];
  enabled: string[];
  updated: string;
};
export type Snapshot = { id: string; date: string; project: Project };
export type Library = {
  version: 1;
  projects: Project[];
  active: string;
  snapshots: Snapshot[];
};
export const uid = () => crypto.randomUUID();
export function newScene(chapter = 'Kapitel 1'): Scene {
  return {
    id: uid(),
    title: 'Neue Szene',
    chapter,
    text: '',
    synopsis: '',
    status: 'Idee',
    date: '',
    pov: '',
    notes: '',
  };
}
export function newProject(title = 'Mein neues Buch'): Project {
  return {
    id: uid(),
    title,
    author: '',
    target: 50000,
    scenes: [newScene()],
    cards: [],
    enabled: ['board', 'world', 'timeline', 'research', 'language'],
    updated: new Date().toISOString(),
  };
}
export function seed(): Library {
  const p = newProject('Das Licht zwischen den Zeilen');
  p.author = '';
  p.scenes = [
    {
      ...newScene(),
      title: 'Die Rückkehr',
      status: 'Entwurf',
      synopsis:
        'Mara kehrt nach Jahren in das Haus ihrer Großmutter zurück. Im Arbeitszimmer wartet ein Brief.',
      date: '2026-10-12T17:30',
      pov: 'Mara',
      text: 'Als Mara den Schlüssel ins Schloss steckte, wusste sie noch nicht, dass manche Häuser länger auf jemanden warteten als Menschen.\n\nDie Tür gab mit einem leisen Seufzen nach. Dahinter lag der Flur, schmal und kühl, mit den gleichen blauen Fliesen wie damals. Nur das Licht hatte sich verändert. Es fiel jetzt ungehindert durch das Fenster am Ende des Gangs, wo früher der schwere Vorhang gehangen hatte.\n\nSie stellte ihren Koffer ab. Irgendwo im Haus tickte eine Uhr.\n\n„Ich bin wieder da“, sagte sie. Es klang seltsam, die eigene Stimme hier zu hören.\n\nAuf dem Schreibtisch ihrer Großmutter lag ein Umschlag. Kein Staub, kein Absender. Nur ihr Name, in einer Handschrift, die sie überall erkannt hätte.\n\nMara zog den Stuhl zurück und setzte sich. Draußen begann es zu regnen.',
    },
    {
      ...newScene(),
      title: 'Ein Brief ohne Datum',
      synopsis:
        'Der Brief enthält eine Bitte und den Hinweis auf eine verschwundene Karte.',
      date: '2026-10-12T18:00',
    },
    {
      ...newScene('Kapitel 2'),
      title: 'Am anderen Ufer',
      synopsis: 'Mara trifft am Hafen auf einen alten Bekannten.',
    },
  ];
  p.cards = [
    {
      id: uid(),
      kind: 'Figur',
      title: 'Mara Winter',
      subtitle: 'Protagonistin · 32 Jahre',
      text: 'Restauratorin. Beobachtet genau, spricht vorsichtig.\nWunsch: herausfinden, warum ihre Großmutter gegangen ist.\nKonflikt: Sie fürchtet, selbst bleiben zu müssen.',
      stage: 'Entwicklung',
    },
    {
      id: uid(),
      kind: 'Ort',
      title: 'Das Haus am Fluss',
      subtitle: 'Schauplatz · Rückkehr',
      text: 'Blaue Fliesen, ein helles Arbeitszimmer, Blick auf das andere Ufer.',
      stage: 'Sammlung',
    },
    {
      id: uid(),
      kind: 'Idee',
      title: 'Was steht im letzten Brief?',
      subtitle: 'Offene Frage',
      text: 'Die Großmutter hat nicht alles erzählt. Vielleicht schützt ihr Schweigen jemanden.',
      stage: 'Sammlung',
    },
  ];
  return { version: 1, projects: [p], active: p.id, snapshots: [] };
}
export function words(text: string): number {
  return (text.match(/[\p{L}\p{N}]+(?:[’'-][\p{L}\p{N}]+)*/gu) || []).length;
}
export function moveScene(scenes: Scene[], id: string, delta: number) {
  const i = scenes.findIndex((s) => s.id === id);
  const j = i + delta;
  if (i < 0 || j < 0 || j >= scenes.length) return scenes;
  const next = [...scenes];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
export function validateLibrary(data: unknown): Library {
  const d = data as Library;
  const str = (v: unknown) => typeof v === 'string';
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.projects) ||
    !d.projects.length ||
    !Array.isArray(d.snapshots)
  )
    throw Error('Keine gültige Feder-Sicherung.');
  const ids = new Set<string>();
  for (const p of d.projects) {
    if (
      !p ||
      !str(p.id) ||
      ids.has(p.id) ||
      !str(p.title) ||
      !str(p.author) ||
      !Number.isFinite(p.target) ||
      p.target < 1 ||
      !Array.isArray(p.scenes) ||
      !p.scenes.length ||
      !Array.isArray(p.cards) ||
      !Array.isArray(p.enabled) ||
      !p.enabled.every(str)
    )
      throw Error('Ungültiges Projekt.');
    ids.add(p.id);
    const sids = new Set();
    for (const s of p.scenes) {
      if (
        !s ||
        ![
          'id',
          'title',
          'chapter',
          'text',
          'synopsis',
          'date',
          'pov',
          'notes',
        ].every((k) => str(s[k as keyof Scene])) ||
        sids.has(s.id) ||
        !['Idee', 'Entwurf', 'Überarbeitung', 'Fertig'].includes(s.status)
      )
        throw Error('Ungültige Szene.');
      sids.add(s.id);
    }
    for (const c of p.cards) {
      if (
        !c ||
        !['id', 'title', 'subtitle', 'text'].every((k) =>
          str(c[k as keyof Card]),
        ) ||
        !['Figur', 'Ort', 'Recherche', 'Idee'].includes(c.kind) ||
        !['Sammlung', 'Entwicklung', 'Im Manuskript'].includes(c.stage)
      )
        throw Error('Ungültige Karte.');
    }
  }
  if (!ids.has(d.active)) throw Error('Aktives Projekt fehlt.');
  if (d.snapshots.length > 200) throw Error('Zu viele Versionen.');
  for (const s of d.snapshots) {
    if (!s || !str(s.id) || !str(s.date)) throw Error('Ungültige Version.');
    validateLibrary({
      version: 1,
      projects: [s.project],
      active: s.project?.id,
      snapshots: [],
    });
  }
  return d;
}
