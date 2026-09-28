export const characterRoles = [
  'Hauptfigur / Protagonist',
  'Co-Protagonist',
  'zentrale Nebenfigur',
  'Nebenfigur',
  'Funktionsfigur',
  'Randfigur',
  'Statist',
  'Antagonist',
  'Hauptantagonist',
  'Nebenantagonist',
  'Mentor',
  'Love Interest',
] as const;
export type CharacterRole = (typeof characterRoles)[number];
export type CharacterProfile = {
  portrait?: string;
  firstName: string;
  lastName: string;
  nickname: string;
  age: string;
  title: string;
  faction: string;
  roles: CharacterRole[];
};
export const emptyCharacter: CharacterProfile = {
  firstName: '',
  lastName: '',
  nickname: '',
  age: '',
  title: '',
  faction: '',
  roles: [],
};
export const MAX_PORTRAIT_LENGTH = 120000;
export function validPortrait(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_PORTRAIT_LENGTH &&
    /^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}
export function validCharacter(c: CharacterProfile) {
  return (
    !!c &&
    ['firstName', 'lastName', 'nickname', 'age', 'title', 'faction'].every(
      (k) => typeof c[k as keyof CharacterProfile] === 'string',
    ) &&
    Array.isArray(c.roles) &&
    c.roles.length <= 2 &&
    new Set(c.roles).size === c.roles.length &&
    c.roles.every((r) => characterRoles.includes(r)) &&
    (c.portrait === undefined || validPortrait(c.portrait))
  );
}
export function characterNames(c?: CharacterProfile): string[] {
  return c
    ? [[c.firstName, c.lastName].filter(Boolean).join(' '), c.nickname].filter(
        Boolean,
      )
    : [];
}
export function characterSearch(c?: CharacterProfile) {
  return c
    ? [
        c.firstName,
        c.lastName,
        c.nickname,
        c.age,
        c.title,
        c.faction,
        ...c.roles,
      ].join(' ')
    : '';
}
