import { validCover } from './cover-data.ts';
export type BookDesign = {
  marginTop?: number;
  marginBottom?: number;
  marginLeft?: number;
  marginRight?: number;
  halfTitleSeriesSize?: number;
  halfTitleSeriesPosition?: 'above' | 'below';
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
  prologuePage?: boolean;
  prologueInChapter?: boolean;
  partPage?: boolean;
  partInChapter?: boolean;
  header?: string;
  footer?: string;
};
export const bookDesignDefaults: Required<
  Omit<BookDesign, 'alternativeCover'>
> = {
  marginTop: 25,
  marginBottom: 25,
  marginLeft: 25,
  marginRight: 25,
  halfTitleSeriesSize: 24,
  halfTitleSeriesPosition: 'above',
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
  prologuePage: false,
  prologueInChapter: true,
  partPage: false,
  partInChapter: true,
  header: '',
  footer: '',
};
export function validBookDesign(o: BookDesign) {
  return (
    !!o &&
    ['marginTop', 'marginBottom', 'marginLeft', 'marginRight'].every((key) => {
      const n = o[key as keyof BookDesign];
      return (
        n === undefined ||
        (typeof n === 'number' && Number.isFinite(n) && n >= 5 && n <= 50)
      );
    }) &&
    (o.halfTitleSeriesSize === undefined ||
      (Number.isFinite(o.halfTitleSeriesSize) &&
        o.halfTitleSeriesSize >= 8 &&
        o.halfTitleSeriesSize <= 72)) &&
    (o.halfTitleSeriesPosition === undefined ||
      ['above', 'below'].includes(o.halfTitleSeriesPosition)) &&
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
      'prologuePage',
      'prologueInChapter',
      'partPage',
      'partInChapter',
    ].every(
      (k) =>
        o[k as keyof BookDesign] === undefined ||
        typeof o[k as keyof BookDesign] === 'boolean',
    )
  );
}
