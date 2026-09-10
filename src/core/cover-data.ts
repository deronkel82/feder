import type { Library } from './model.ts';
export const MAX_COVER_LENGTH = 600000;
export function validCover(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.length <= MAX_COVER_LENGTH &&
    /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(value)
  );
}
export function setProjectCover(
  library: Library,
  projectId: string,
  cover?: string,
): Library {
  if (cover !== undefined && !validCover(cover))
    throw Error('Ungültiges Coverbild.');
  return {
    ...library,
    projects: library.projects.map((p) =>
      p.id === projectId
        ? { ...p, cover, updated: new Date().toISOString() }
        : p,
    ),
  };
}
