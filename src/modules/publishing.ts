import { exportDefaults, type ExportOptions } from '../core/workbench.ts';
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
export const paragraphs = (s: string) =>
  s
    .split(/\n\s*\n/)
    .map(
      (p) =>
        `<p>${escape(p)
          .replace(/\n/g, '<br/>')
          .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
          .replace(/\*([^*]+)\*/g, '<em>$1</em>')}</p>`,
    )
    .join('\n');
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
export async function exportEpub(
  p: Project,
  options: ExportOptions = exportDefaults,
) {
  if (options.anonymous) p = { ...p, author: '' };
  p = { ...p, scenes: orderedScenes(p) };
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  };
  files['META-INF/container.xml'] = strToU8(
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="de" xml:lang="de"><head><title>${escape(title)}</title><style>${exportStyles(options)}</style></head><body>${body}</body></html>`;
  p.scenes.forEach(
    (s, i) =>
      (files[`EPUB/scene-${i}.xhtml`] = strToU8(
        xhtml(
          exportHeading(p, s),
          `<h1>${escape(options.sceneHeadings ? exportHeading(p, s) : chapterLabel(p, s.chapter))}</h1>${paragraphs(s.text)}`,
        ),
      )),
  );
  files['EPUB/nav.xhtml'] = strToU8(
    xhtml(
      p.title,
      `<nav epub:type="toc" id="toc"><h1>${escape(p.title)}</h1><ol>${p.scenes.map((s, i) => `<li><a href="scene-${i}.xhtml">${escape(exportHeading(p, s))}</a></li>`).join('')}</ol></nav>`,
    ),
  );
  if (options.titlePage)
    files['EPUB/title.xhtml'] = strToU8(
      xhtml(
        p.title,
        `<h1>${escape(p.title)}</h1>${options.anonymous ? '' : `<p>${escape(p.author)}</p>`}`,
      ),
    );
  files['EPUB/package.opf'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${escape(p.id)}</dc:identifier><dc:title>${escape(p.title)}</dc:title><dc:language>de</dc:language><dc:creator>${escape(p.author)}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest>${options.titlePage ? '<item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>' : ''}<item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${p.scenes.map((_, i) => `<item id="s${i}" href="scene-${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${options.titlePage ? '<itemref idref="title"/>' : ''}${p.scenes.map((_, i) => `<itemref idref="s${i}"/>`).join('')}</spine></package>`,
  );
  const bytes = zipSync(files, { level: 6 });
  const a = document.createElement('a');
  const url = URL.createObjectURL(
    new Blob([bytes as BlobPart], { type: 'application/epub+zip' }),
  );
  a.href = url;
  a.download = safeName(p.title) + '.epub';
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function exportStyles(o: ExportOptions) {
  const font =
    o.font === 'mono'
      ? 'Courier New,monospace'
      : o.font === 'sans'
        ? 'Arial,sans-serif'
        : 'Georgia,serif';
  return `@page{size:A4;margin:25mm}body{font:${o.size}pt/${o.line} ${font};color:#111;background:white;margin:0}p{margin:0 0 ${o.gap}pt;orphans:3;widows:3}h1{font-size:1.6em}h2{font-size:1.2em}.chapter{${o.chapterBreak ? 'break-before:page;' : ''}}.cover{padding-top:25%;text-align:center;break-after:page}body>section:first-child{break-before:auto}`;
}
export function exportDocument(p: Project, o: ExportOptions = exportDefaults) {
  const scenes = orderedScenes(p);
  let chapter = '';
  const body = scenes
    .map((s) => {
      const changed = s.chapter !== chapter;
      chapter = s.chapter;
      return `<section class="${changed ? 'chapter' : 'scene'}">${changed ? `<h1>${escape(isStandalone(p) ? p.title : [chapterDetails(p, s.chapter).part, chapterLabel(p, s.chapter)].filter(Boolean).join(' · '))}</h1>` : ''}${o.sceneHeadings && usesScenes(p) ? `<h2>${escape(s.title)}</h2>` : ''}${paragraphs(s.text)}</section>`;
    })
    .join('');
  return `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(p.title)}</title><style>${exportStyles(o)}</style></head><body>${o.titlePage ? `<div class="cover"><h1>${escape(p.title)}</h1>${o.anonymous ? '' : `<p>${escape(p.author)}</p>`}</div>` : ''}${body}</body></html>`;
}
export function printBook(p: Project, o: ExportOptions = exportDefaults) {
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
