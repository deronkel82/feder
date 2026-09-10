export const schemes = [
  {
    id: 'petrol',
    name: 'Petrol',
    description: 'Das klassische Feder',
    light: [
      '#f5f6f7',
      '#ffffff',
      '#27343b',
      '#596b73',
      '#235b62',
      '#ffffff',
      '#e1eceb',
      '#d7e0e3',
    ],
    dark: [
      '#152026',
      '#1c2b32',
      '#dde6e9',
      '#a8bbc3',
      '#9bccce',
      '#152c33',
      '#28494d',
      '#3b4e56',
    ],
  },
  {
    id: 'sand',
    name: 'Sand',
    description: 'Warm wie Papier',
    light: [
      '#f5f0e6',
      '#fffaf1',
      '#3e3328',
      '#706050',
      '#80532b',
      '#ffffff',
      '#eee0cb',
      '#d8c7b0',
    ],
    dark: [
      '#241f19',
      '#302920',
      '#f1e7d8',
      '#c5b49c',
      '#e3b980',
      '#2b2116',
      '#4b3b28',
      '#61513e',
    ],
  },
  {
    id: 'forest',
    name: 'Wald',
    description: 'Ruhiges Salbeigrün',
    light: [
      '#eef3ed',
      '#fafdf8',
      '#273b2c',
      '#526b58',
      '#316241',
      '#ffffff',
      '#dcebdc',
      '#bdcfbf',
    ],
    dark: [
      '#18231c',
      '#223027',
      '#e2ede2',
      '#adbfaf',
      '#a2cfaa',
      '#152a1b',
      '#314d39',
      '#435c49',
    ],
  },
  {
    id: 'lavender',
    name: 'Lavendel',
    description: 'Sanftes Violett',
    light: [
      '#f3f0f8',
      '#fdfbff',
      '#392f49',
      '#6d5d80',
      '#705095',
      '#ffffff',
      '#e9dff3',
      '#cec0dd',
    ],
    dark: [
      '#221e2b',
      '#2e283a',
      '#ece4f6',
      '#bfb0d1',
      '#cbb0e7',
      '#291a39',
      '#473657',
      '#5b4d6c',
    ],
  },
  {
    id: 'graphite',
    name: 'Graphit',
    description: 'Klar und zurückhaltend',
    light: [
      '#f2f3f4',
      '#ffffff',
      '#292d32',
      '#60666e',
      '#485363',
      '#ffffff',
      '#e1e5ea',
      '#cbd0d7',
    ],
    dark: [
      '#1c1e22',
      '#272a30',
      '#eceef2',
      '#b5bbc5',
      '#b9c6db',
      '#202630',
      '#3a4351',
      '#4d5562',
    ],
  },
] as const;
export type Scheme = (typeof schemes)[number]['id'];
const KEY = 'feder.appearance.scheme';
export function readScheme(): Scheme {
  try {
    const value = localStorage.getItem(KEY);
    return schemes.find((s) => s.id === value)?.id || 'petrol';
  } catch {
    return 'petrol';
  }
}
export function storeScheme(scheme: Scheme) {
  try {
    localStorage.setItem(KEY, scheme);
  } catch {
    /* Appearance remains usable without persistence. */
  }
}
export function themeTokens(
  scheme: Scheme,
  dark: boolean,
): Record<string, string> {
  const entry = schemes.find((s) => s.id === scheme) || schemes[0];
  const [
    background,
    card,
    foreground,
    muted,
    primary,
    onPrimary,
    accent,
    border,
  ] = entry[dark ? 'dark' : 'light'];
  return {
    background,
    card,
    foreground,
    'card-foreground': foreground,
    popover: card,
    'popover-foreground': foreground,
    primary,
    'primary-foreground': onPrimary,
    secondary: accent,
    'secondary-foreground': foreground,
    muted: background,
    'muted-foreground': muted,
    accent,
    'accent-foreground': foreground,
    border,
    input: border,
    ring: primary,
    sidebar: background,
    'sidebar-foreground': foreground,
    'sidebar-primary': primary,
    'sidebar-primary-foreground': onPrimary,
    'sidebar-accent': accent,
    'sidebar-accent-foreground': foreground,
    'sidebar-border': border,
    'sidebar-ring': primary,
  };
}
export function applyTheme(scheme: Scheme, dark: boolean) {
  for (const [key, value] of Object.entries(themeTokens(scheme, dark)))
    document.documentElement.style.setProperty('--' + key, value);
  document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
}
