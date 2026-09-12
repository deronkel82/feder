import { validCover } from './cover-data.ts';
export type BookDesign = {
  coverMode?: 'none' | 'project' | 'alternative';
  alternativeCover?: string;
  halfTitleTitle?: boolean;
  halfTitleAuthor?: boolean;
  halfTitleSeries?: boolean;
  halfTitleVolume?: boolean;
  imprintEnabled?: boolean;
  imprint?: string;
  dedicationEnabled?: boolean;
  dedication?: string;
  contents?: boolean;
  hidePrologue?: boolean;
  hideEpilogue?: boolean;
  partPage?: boolean;
  partInChapter?: boolean;
  header?: string;
  footer?: string;
};
export const bookDesignDefaults: Required<
  Omit<BookDesign, 'alternativeCover'>
> = {
  coverMode: 'none',
  halfTitleTitle: true,
  halfTitleAuthor: true,
  halfTitleSeries: false,
  halfTitleVolume: false,
  imprintEnabled: false,
  imprint: '',
  dedicationEnabled: false,
  dedication: '',
  contents: false,
  hidePrologue: false,
  hideEpilogue: false,
  partPage: false,
  partInChapter: true,
  header: '',
  footer: '',
};
export function validBookDesign(o: BookDesign) {
  return (
    !!o &&
    (o.coverMode === undefined ||
      ['none', 'project', 'alternative'].includes(o.coverMode)) &&
    (o.alternativeCover === undefined || validCover(o.alternativeCover)) &&
    ['imprint', 'dedication', 'header', 'footer'].every(
      (k) =>
        o[k as keyof BookDesign] === undefined ||
        typeof o[k as keyof BookDesign] === 'string',
    ) &&
    [
      'halfTitleTitle',
      'halfTitleAuthor',
      'halfTitleSeries',
      'halfTitleVolume',
      'imprintEnabled',
      'dedicationEnabled',
      'contents',
      'hidePrologue',
      'hideEpilogue',
      'partPage',
      'partInChapter',
    ].every(
      (k) =>
        o[k as keyof BookDesign] === undefined ||
        typeof o[k as keyof BookDesign] === 'boolean',
    )
  );
}
