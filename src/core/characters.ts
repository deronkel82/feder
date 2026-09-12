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
export function validCharacter(c: CharacterProfile) {
  return (
    !!c &&
    ['firstName', 'lastName', 'nickname', 'age', 'title', 'faction'].every(
      (k) => typeof c[k as keyof CharacterProfile] === 'string',
    ) &&
    Array.isArray(c.roles) &&
    c.roles.length <= 2 &&
    new Set(c.roles).size === c.roles.length &&
    c.roles.every((r) => characterRoles.includes(r))
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
  return c ? Object.values(c).flat().join(' ') : '';
}
