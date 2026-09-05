import { zipSync, strToU8 } from 'fflate';
import { type Project } from '../core/model.ts';
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
export async function exportEpub(p: Project) {
  const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = {
    mimetype: [strToU8('application/epub+zip'), { level: 0 }],
  };
  files['META-INF/container.xml'] = strToU8(
    '<?xml version="1.0"?><container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container"><rootfiles><rootfile full-path="EPUB/package.opf" media-type="application/oebps-package+xml"/></rootfiles></container>',
  );
  const xhtml = (title: string, body: string) =>
    `<?xml version="1.0" encoding="UTF-8"?><html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" lang="de" xml:lang="de"><head><title>${escape(title)}</title><style>body{font-family:serif;line-height:1.6}h1{margin:2em 0 1em}p{margin:0 0 1em}</style></head><body>${body}</body></html>`;
  p.scenes.forEach(
    (s, i) =>
      (files[`EPUB/scene-${i}.xhtml`] = strToU8(
        xhtml(
          s.title,
          `<h2>${escape(s.chapter)}</h2><h1>${escape(s.title)}</h1>${paragraphs(s.text)}`,
        ),
      )),
  );
  files['EPUB/nav.xhtml'] = strToU8(
    xhtml(
      p.title,
      `<nav epub:type="toc" id="toc"><h1>${escape(p.title)}</h1><ol>${p.scenes.map((s, i) => `<li><a href="scene-${i}.xhtml">${escape(s.chapter)} · ${escape(s.title)}</a></li>`).join('')}</ol></nav>`,
    ),
  );
  files['EPUB/package.opf'] = strToU8(
    `<?xml version="1.0" encoding="UTF-8"?><package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="book-id"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:identifier id="book-id">urn:uuid:${escape(p.id)}</dc:identifier><dc:title>${escape(p.title)}</dc:title><dc:language>de</dc:language><dc:creator>${escape(p.author)}</dc:creator><meta property="dcterms:modified">${new Date().toISOString().replace(/\.\d+Z$/, 'Z')}</meta></metadata><manifest><item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>${p.scenes.map((_, i) => `<item id="s${i}" href="scene-${i}.xhtml" media-type="application/xhtml+xml"/>`).join('')}</manifest><spine>${p.scenes.map((_, i) => `<itemref idref="s${i}"/>`).join('')}</spine></package>`,
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
export function printBook(p: Project) {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;width:0;height:0;border:0';
  document.body.appendChild(frame);
  frame.onload = () => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 60000);
  };
  frame.srcdoc = `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>${escape(p.title)}</title><style>@page{size:A4;margin:25mm}body{font:12pt/1.8 Georgia,serif;color:#111}section{break-before:page}h1{font-size:26pt}p{orphans:3;widows:3}.cover{padding-top:35%;text-align:center}</style></head><body><div class="cover"><h1>${escape(p.title)}</h1><p>${escape(p.author)}</p></div>${p.scenes.map((s) => `<section><h2>${escape(s.chapter)}</h2><h1>${escape(s.title)}</h1>${paragraphs(s.text)}</section>`).join('')}</body></html>`;
}
