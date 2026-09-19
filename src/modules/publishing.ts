import { exportDefaults, type ExportOptions } from '../core/workbench.ts';
import { bookDesignDefaults } from '../core/book-design.ts';
import { validCover } from '../core/cover-data.ts';
import { isStandalone, usesScenes } from '../core/project-format.ts';
import {
  chapterLabel,
  chapterDetails,
  orderedScenes,
} from '../core/chapters.ts';
import { zipSync, strToU8 } from 'fflate';
import { type Project, type Scene } from '../core/model.ts';
import { safeName } from '../core/storage.ts';
export const escape = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[
        c
      ]!,
  );
const inline = (s: string) =>
  escape(s)
    .replace(/\n/g, '<br/>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>');
// Deliberately limited Markdown: user HTML is always escaped.
export function paragraphs(s: string): string {
  const lines = s.split('\n');
  const blocks: string[] = [];
  let buffer: string[] = [];
  let centered = false;
  const flush = () => {
    if (buffer.length) {
      blocks.push(
        `<p${centered ? ' class="centered"' : ''}>${inline(buffer.join('\n'))}</p>`,
      );
      buffer = [];
    }
  };
  for (const line of lines) {
    if (line.trim() === ':::center' && !centered) {
      flush();
      centered = true;
    } else if (line.trim() === ':::' && centered) {
      flush();
      centered = false;
    } else if (!line.trim()) flush();
    else buffer.push(line);
  }
  flush();
  return blocks.join('\n');
}
export function exportHeading(p: Project, s: Scene) {
  if (isStandalone(p)) return p.title;
  return [
    chapterDetails(p, s.chapter).part,
    chapterLabel(p, s.chapter),
    usesScenes(p) ? s.title : '',
  ]
    .filter(Boolean)
    .join(' · ');
}
function outputChapter(p: Project, s: Scene, o: ExportOptions) {
  if (isStandalone(p)) return p.title;
  const c = chapterDetails(p, s.chapter);
  const hidden =
    (c.kind === 'prologue' && o.hidePrologue) ||
    (c.kind === 'epilogue' && o.hideEpilogue);
  const label = hidden
    ? /^(Prolog|Epilog)$/iu.test(c.name)
      ? ''
      : c.name
    : chapterLabel(p, c.name);
  return [o.partInChapter ? c.part : '', label].filter(Boolean).join(' · ');
}
function coverFor(p: Project, o: ExportOptions) {
  const cover =
    o.coverMode === 'project'
      ? p.cover
      : o.coverMode === 'alternative'
        ? o.alternativeCover
        : undefined;
  return validCover(cover) ? cover : undefined;
}
type BookSection = { file: string; title: string; body: string };
function sections(
  p: Project,
  options: ExportOptions,
  epubCover?: string,
): BookSection[] {
  const o = { ...bookDesignDefaults, ...options };
  const out: BookSection[] = [];
  const add = (file: string, title: string, body: string) =>
    out.push({ file, title, body });
  const cover = coverFor(p, o);
  if (cover)
    add(
      'cover',
      'Cover',
      `<section class="front cover-image"><img src="${escape(epubCover || cover)}" alt="${escape(p.title)}"/></section>`,
    );
  const series =
    p.series.enabled && o.halfTitleSeries && p.series.title.trim()
      ? `<p class="series-title">${escape(p.series.title)}</p>`
      : '';
  const author =
    o.halfTitleAuthor && !o.anonymous && p.author.trim()
      ? `<p class="title-author">${escape(p.author)}</p>`
      : '';
  const titleBlock = `<div class="title-block">${o.halfTitleSeriesPosition === 'above' ? series : ''}${o.halfTitleTitle ? `<h1>${escape(p.title)}</h1>` : ''}${o.halfTitleSeriesPosition === 'below' ? series : ''}${p.series.enabled && o.halfTitleVolume ? `<p class="title-volume">Band ${escape(p.series.volume)}</p>` : ''}</div>`;
  if (o.titlePage)
    add(
      'title',
      'Schmutztitel',
      `<section class="front title-page">${o.halfTitleAuthorPosition === 'above' ? author : ''}${titleBlock}${o.halfTitleAuthorPosition === 'below' ? author : ''}</section>`,
    );
  if (o.imprintEnabled && o.imprint.trim())
    add(
      'imprint',
      'Impressum',
      `<section class="front imprint"><div>${paragraphs(o.imprint)}</div></section>`,
    );
  if (o.dedicationEnabled && o.dedication.trim())
    add(
      'dedication',
      'Widmung',
      `<section class="front title-page dedication">${paragraphs(o.dedication)}</section>`,
    );
  let chapter = '';
  let part = '';
  orderedScenes(p).forEach((s, i) => {
    const changed = s.chapter !== chapter;
    chapter = s.chapter;
    const c = chapterDetails(p, s.chapter);
    const newPart = changed && c.part && c.part !== part;
    if (changed) part = c.part;
    const label = outputChapter(p, s, o);
    const prologueTitle =
      c.kind === 'prologue'
        ? outputChapter(p, s, { ...o, partInChapter: false })
        : '';
    const ownProloguePage = changed && o.prologuePage && prologueTitle;
    const chapterTitle =
      c.kind === 'prologue' && !o.prologueInChapter ? '' : label;
    const sceneTitle =
      o.sceneHeadings &&
      usesScenes(p) &&
      !(
        ((o.hidePrologue && c.kind === 'prologue') ||
          (o.hideEpilogue && c.kind === 'epilogue')) &&
        /^(Prolog|Epilog)$/iu.test(s.title)
      )
        ? s.title
        : '';
    add(
      `scene-${i}`,
      [label, sceneTitle].filter(Boolean).join(' · ') ||
        (c.kind === 'epilogue' ? 'Ausklang' : 'Anfang'),
      `${newPart && o.partPage ? `<section class="front title-page part-page"><h1>${escape(c.part)}</h1></section>` : ''}${ownProloguePage ? `<section class="front title-page prologue-page"><h1>${escape(prologueTitle)}</h1></section>` : ''}<section id="chapter-${i}" class="${changed ? 'chapter' : 'scene'}">${changed && chapterTitle ? `<h1>${escape(chapterTitle)}</h1>` : ''}${sceneTitle ? `<h2>${escape(sceneTitle)}</h2>` : ''}${paragraphs(s.text)}</section>`,
    );
  });
  return out;
}
function toc(p: Project, o: ExportOptions, epub: boolean) {
  let last = '';
  return `<h1>Inhaltsverzeichnis</h1><ol>${orderedScenes(p)
    .map((s, i) => {
      if (s.chapter === last) return '';
      last = s.chapter;
      const label = outputChapter(p, s, o) || s.title || 'Anfang';
      return `<li><a href="${epub ? `scene-${i}.xhtml` : ''}#chapter-${i}">${escape(/^(Prolog|Epilog)$/iu.test(label) && ((o.hidePrologue && chapterDetails(p, s.chapter).kind === 'prologue') || (o.hideEpilogue && chapterDetails(p, s.chapter).kind === 'epilogue')) ? 'Anfang' : label)}</a></li>`;
    })
    .join('')}</ol>`;
}
export function exportStyles(options: ExportOptions) {
  const o = { ...bookDesignDefaults, ...options };
  const font =
    o.font === 'mono'
      ? 'Courier New,monospace'
      : o.font === 'sans'
        ? 'Arial,sans-serif'
        : 'Georgia,serif';
  // Keep the established front-matter allowance: WebKit can add a page when
  // a flex-based imprint or cover fills the entire nominal page area.
  return `@page{size:A4;margin:${o.marginTop}mm ${o.marginRight}mm ${o.marginBottom}mm ${o.marginLeft}mm}body{font:${o.size}pt/${o.line} ${font};color:#111;background:white;margin:0}p{margin:0 0 ${o.gap}pt;orphans:3;widows:3}h1{font-size:1.6em}.series-title{font-size:${o.halfTitleSeriesSize}pt;font-weight:bold;line-height:1.2;margin:0 0 18pt;overflow-wrap:anywhere}h2{font-size:1.2em}h1,h2{break-after:avoid}.centered{text-align:center}.chapter{${o.chapterBreak ? 'break-before:page;' : ''}}.front{box-sizing:border-box;break-before:page;break-inside:avoid}.front+section{break-before:page}.title-page{display:block;padding:65mm 0 10mm;text-align:center}.title-page h1{break-after:auto;margin:0 0 18pt}.title-block{break-inside:avoid}.title-author{margin:0 0 24pt}.title-block+.title-author{margin-top:24pt}.title-block .series-title{margin-bottom:18pt}.title-volume{margin-top:18pt}.title-page p:last-child{margin-bottom:0}.imprint{min-height:${297 - o.marginTop - o.marginBottom - 17}mm;display:flex;align-items:flex-end}.imprint>div{width:100%;overflow-wrap:anywhere}.cover-image{display:flex;align-items:center;justify-content:center}.cover-image img{max-width:100%;max-height:${297 - o.marginTop - o.marginBottom - 17}mm;object-fit:contain}.contents li{margin:8pt 0}.running{font-size:9pt;white-space:pre-wrap;text-align:center;overflow-wrap:anywhere}header.running{margin-bottom:12pt}footer.running{margin-top:12pt}main>section:first-child,body>section:first-child{break-before:auto}@media screen{body{padding:24px}.front{min-height:75vh;margin-bottom:32px;border-bottom:1px solid #ddd}.title-page{padding:20vh 0 24px}.cover-image img{max-height:75vh}.imprint{min-height:75vh}}@media print{header.running,footer.running{position:fixed;left:0;right:0;margin:0;max-height:15mm;overflow:hidden}header.running{top:-${Math.max(0, o.marginTop - 3)}mm;max-height:${Math.max(0, o.marginTop - 6)}mm}footer.running{bottom:-${Math.max(0, o.marginBottom - 3)}mm;max-height:${Math.max(0, o.marginBottom - 6)}mm}}`;
}
export function exportDocument(
  p: Project,
  options: ExportOptions = p.exportOptions || exportDefaults,
) {
  const o = { ...bookDesignDefaults, ...options };
  const parts = sections(p, o);
  const firstScene = parts.findIndex((s) => s.file.startsWith('scene-'));
  if (o.contents)
    parts.splice(firstScene < 0 ? parts.length : firstScene, 0, {
      file: 'contents',
      title: 'Inhaltsverzeichnis',
      body: `<section class="front contents">${toc(p, o, false)}</section>`,
    });
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(p.title)}</title><style>${exportStyles(o)}</style></head><body>${o.header ? `<header class="running">${escape(o.header)}</header>` : ''}<main>${parts.map((s) => s.body).join('')}</main>${o.footer ? `<footer class="running">${escape(o.footer)}</footer>` : ''}</body></html>`;
}
export function epubBytes(
  p: Project,
  options: ExportOptions = p.exportOptions || exportDefaults,
) {
  const o = { ...bookDesignDefaults, ...options };
  if (o.anonymous) p = { ...p, author: '' };
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  };
  files['META-INF/container.xml'] = strToU8(
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  const cover = coverFor(p, o);
  let imageItem = '';
  let coverPath: string | undefined;
  if (cover) {
    const match = /^data:(image\/(jpeg|png|webp));base64,(.*)$/.exec(cover)!;
    coverPath = 'cover.' + (match[2] === 'jpeg' ? 'jpg' : match[2]);
    files['EPUB/' + coverPath] = Uint8Array.from(atob(match[3]), (c) =>
      c.charCodeAt(0),
    );
    imageItem = `<item id="cover-image" href="${coverPath}" media-type="${match[1]}" properties="cover-image"/>`;
  }
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="de" xml:lang="de"><head><title>${escape(title)}</title><style>${exportStyles(o)}</style></head><body>${body}</body></html>`;
  const parts = sections(p, o, coverPath);
  for (const s of parts)
    files[`EPUB/${s.file}.xhtml`] = strToU8(xhtml(s.title, s.body));
  files['EPUB/nav.xhtml'] = strToU8(
    xhtml(
      'Inhaltsverzeichnis',
      `<nav epub:type="toc" id="toc">${toc(p, o, true)}</nav>`,
    ),
  );
  const first = parts.findIndex((s) => s.file.startsWith('scene-'));
  const spine = parts.map((s) => `<itemref idref="${s.file}"/>`);
  if (o.contents)
    spine.splice(first < 0 ? spine.length : first, 0, '<itemref idref="nav"/>');
  files['EPUB/package.opf'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${escape(p.id)}</dc:identifier><dc:title>${escape(p.title)}</dc:title><dc:language>de</dc:language><dc:creator>${escape(p.author)}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>${imageItem}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${parts.map((s) => `<item id="${s.file}" href="${s.file}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${spine.join('')}</spine></package>`,
  );
  return zipSync(files, { level: 6 });
}
export async function exportEpub(
  p: Project,
  o: ExportOptions = p.exportOptions || exportDefaults,
) {
  const bytes = epubBytes(p, o);
  const a = document.createElement('a');
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: 'application/epub+zip' }),
  );
  a.href = url;
  a.download = safeName(p.title) + '.epub';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function printBook(
  p: Project,
  o: ExportOptions = p.exportOptions || exportDefaults,
) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  };
  frame.srcdoc = exportDocument(p, o);
}
