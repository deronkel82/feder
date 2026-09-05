import type { Project, Scene } from './model.ts';
export type ChapterMeta = {
  name: string;
  kind: 'chapter' | 'prologue' | 'epilogue';
  number: string;
  part: string;
};
export function chapterDetails(p: Project, name: string): ChapterMeta {
  const saved = p.chapterMeta?.find((c) => c.name === name);
  return (
    saved || {
      name,
      kind:
        name.toLocaleLowerCase('de') === 'prolog'
          ? 'prologue'
          : name.toLocaleLowerCase('de') === 'epilog'
            ? 'epilogue'
            : 'chapter',
      number:
        /^Kapitel (\d+)$/.exec(name)?.[1] ||
        String(
          [...new Set(p.scenes.map((s) => s.chapter))]
            .filter(
              (c) => !['prolog', 'epilog'].includes(c.toLocaleLowerCase('de')),
            )
            .indexOf(name) + 1,
        ),
      part: '',
    }
  );
}
export function chapterLabel(p: Project, name: string) {
  const c = chapterDetails(p, name);
  const special =
    c.kind === 'prologue' ? 'Prolog' : c.kind === 'epilogue' ? 'Epilog' : '';
  if (special)
    return name.toLocaleLowerCase('de') === special.toLocaleLowerCase('de')
      ? special
      : special + ' · ' + name;
  return c.number
    ? /^Kapitel \d+$/.test(name)
      ? 'Kapitel ' + c.number
      : c.number + ' · ' + name
    : name;
}
export function chapterGroups(p: Project) {
  const names = [...new Set(p.scenes.map((s) => s.chapter))];
  const toChapter = (name: string) => ({
    name,
    label: chapterLabel(p, name),
    scenes: p.scenes.filter((s) => s.chapter === name),
  });
  const regular = names.filter((n) => chapterDetails(p, n).kind === 'chapter');
  const parts = [...new Set(regular.map((n) => chapterDetails(p, n).part))];
  return [
    {
      key: 'prologue',
      part: '',
      chapters: names
        .filter((n) => chapterDetails(p, n).kind === 'prologue')
        .map(toChapter),
    },
    ...parts.map((part) => ({
      key: 'part:' + part,
      part,
      chapters: regular
        .filter((n) => chapterDetails(p, n).part === part)
        .map(toChapter),
    })),
    {
      key: 'epilogue',
      part: '',
      chapters: names
        .filter((n) => chapterDetails(p, n).kind === 'epilogue')
        .map(toChapter),
    },
  ].filter((g) => g.chapters.length);
}
export function orderedScenes(p: Project): Scene[] {
  return chapterGroups(p).flatMap((g) => g.chapters.flatMap((c) => c.scenes));
}
