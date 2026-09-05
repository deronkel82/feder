import {
  BookOpen,
  LayoutGrid,
  UsersRound,
  Waypoints,
  Library,
  Sparkles,
} from 'lucide-react';
export const modules = [
  {
    id: 'write',
    label: 'Manuskript',
    icon: BookOpen,
    description: 'Schreiben, Szenen und Kapitel organisieren.',
    core: true,
  },
  {
    id: 'board',
    label: 'Ideenwand',
    icon: LayoutGrid,
    description: 'Ideen sammeln und Schritt für Schritt entwickeln.',
  },
  {
    id: 'world',
    label: 'Figuren & Orte',
    icon: UsersRound,
    description: 'Das Wissen über deine Romanwelt bündeln.',
  },
  {
    id: 'timeline',
    label: 'Zeitstrahl',
    icon: Waypoints,
    description: 'Die zeitliche Reihenfolge deiner Szenen planen.',
  },
  {
    id: 'research',
    label: 'Recherche',
    icon: Library,
    description: 'Quellen und Hintergrundwissen festhalten.',
  },
  {
    id: 'language',
    label: 'Sprache',
    icon: Sparkles,
    description: 'Stilanalyse und lokale OpenThesaurus-Synonyme.',
  },
];
