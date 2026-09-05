import { test } from 'node:test';
import assert from 'node:assert/strict';
import { escape, paragraphs, exportEpub } from '../src/modules/publishing.ts';
import { seed } from '../src/core/model.ts';
import { unzipSync, strFromU8 } from 'fflate';
void test('user content cannot become executable HTML', () => {
  assert.equal(escape('<script>"&'), '&lt;script&gt;&quot;&amp;');
  const result = paragraphs('**Stark**\n\n<script>alert(1)</script>');
  assert.ok(result.includes('<strong>Stark</strong>'));
  assert.ok(!result.includes('<script>'));
});
void test('EPUB contains first uncompressed mimetype, OPF, navigation and escaped manuscript', async () => {
  let blob: Blob | undefined;
  const original = URL.createObjectURL.bind(URL);
  const revoke = URL.revokeObjectURL.bind(URL);
  URL.createObjectURL = (b) => {
    blob = b as Blob;
    return 'blob:test';
  };
  URL.revokeObjectURL = () => {};
  Object.defineProperty(globalThis, 'document', {
    value: { createElement: () => ({ click() {} }) },
    configurable: true,
  });
  try {
    const p = seed().projects[0];
    p.title = 'Buch & Welt';
    await exportEpub(p);
    const bytes = new Uint8Array(await blob!.arrayBuffer());
    assert.equal(new DataView(bytes.buffer).getUint16(8, true), 0);
    const files = unzipSync(bytes);
    assert.equal(Object.keys(files)[0], 'mimetype');
    assert.equal(strFromU8(files.mimetype), 'application/epub+zip');
    assert.ok(strFromU8(files['EPUB/package.opf']).includes('Buch &amp; Welt'));
    assert.ok(files['EPUB/nav.xhtml']);
    assert.ok(strFromU8(files['EPUB/scene-0.xhtml']).includes('Mara'));
  } finally {
    URL.createObjectURL = original;
    setTimeout(() => {
      URL.revokeObjectURL = revoke;
    }, 10001).unref();
  }
});
