import type { Library, Project } from './model.ts';
// Existing author names predate the preference and remain project-specific.
export const hasOwnAuthor = (p: Project) =>
  p.authorOverride ?? !!p.author.trim();
export function applyDefaultAuthor(p: Project, defaultAuthor = ''): Project {
  return hasOwnAuthor(p)
    ? p
    : { ...p, author: defaultAuthor, authorOverride: false };
}
export function setDefaultAuthor(l: Library, author: string): Library {
  const defaultAuthor = author.trim();
  return {
    ...l,
    defaultAuthor,
    projects: l.projects.map((p) => {
      const next = applyDefaultAuthor(p, defaultAuthor);
      return next.author === p.author
        ? next
        : { ...next, updated: new Date().toISOString() };
    }),
  };
}
export function setAuthorOverride(
  p: Project,
  enabled: boolean,
  defaultAuthor = '',
): Project {
  return {
    ...p,
    authorOverride: enabled,
    author: enabled ? p.author : defaultAuthor,
  };
}
