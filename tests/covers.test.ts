import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newProject, validateLibrary } from '../src/core/model.ts';
import {
  validCover,
  setProjectCover,
  MAX_COVER_LENGTH,
} from '../src/core/cover-data.ts';
import { withSnapshot } from '../src/core/history.ts';
import {
  deleteProject,
  restoreDeletedProject,
} from '../src/core/project-deletion.ts';
import { readCover } from '../src/modules/cover-image.ts';
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZQAAAABJRU5ErkJggg==';
void test('covers stay attached to their project through save, snapshot, deletion and recovery', () => {
  let l = seed();
  const id = l.active;
  l.projects.push(newProject('Andere'));
  l.active = l.projects[1].id;
  const next = setProjectCover(l, id, png);
  assert.equal(next.projects[0].cover, png);
  assert.equal(next.projects[1].cover, undefined);
  assert.equal(l.projects[0].cover, undefined);
  l = withSnapshot(next, next.projects[0], 'Mit Cover');
  const json = JSON.parse(JSON.stringify(l));
  assert.deepEqual(validateLibrary(json), json);
  const deleted = deleteProject(l, id);
  assert.equal(restoreDeletedProject(deleted, id).projects.at(-1)!.cover, png);
  const removed = setProjectCover(l, id);
  assert.equal(removed.projects[0].cover, undefined);
  assert.equal(removed.snapshots[0].project.cover, png);
});
void test('cover imports reject network URLs, SVG, malformed and oversized values', () => {
  assert.equal(validCover(png), true);
  for (const bad of [
    'https://example.com/a.jpg',
    'data:image/svg+xml;base64,AAAA',
    'data:image/png;base64,@@@',
    'data:image/jpeg;base64,' + 'A'.repeat(MAX_COVER_LENGTH),
  ]) {
    assert.equal(validCover(bad), false);
    const l = seed();
    l.projects[0].cover = bad;
    assert.throws(() => validateLibrary(l));
    assert.throws(() => setProjectCover(seed(), 'id', bad));
  }
});
void test('upload refuses unsupported formats and oversized files before decoding', async () => {
  await assert.rejects(
    readCover(new File(['svg'], 'test.svg', { type: 'image/svg+xml' })),
    /JPG/,
  );
  await assert.rejects(
    readCover(
      new File([new Uint8Array(21 * 1024 * 1024)], 'huge.png', {
        type: 'image/png',
      }),
    ),
    /20 MB/,
  );
});
void test('cover resize preserves aspect ratio, caps size and releases temporary URL', async () => {
  let revoked = 0;
  let draw: number[] = [];
  const originalImage = Object.getOwnPropertyDescriptor(globalThis, 'Image');
  const originalDocument = Object.getOwnPropertyDescriptor(
    globalThis,
    'document',
  );
  const oldCreate = URL.createObjectURL.bind(URL),
    oldRevoke = URL.revokeObjectURL.bind(URL);
  class MockImage {
    naturalWidth = 2400;
    naturalHeight = 3600;
    onload: (() => void) | null = null;
    set src(_v: string) {
      queueMicrotask(() => this.onload?.());
    }
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: () => ({
      fillStyle: '',
      fillRect() {},
      drawImage(_img: unknown, ...dims: number[]) {
        draw = dims;
      },
    }),
    toDataURL: () => png,
  };
  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    value: MockImage,
  });
  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    value: { createElement: () => canvas },
  });
  URL.createObjectURL = () => 'blob:cover-test';
  URL.revokeObjectURL = () => {
    revoked++;
  };
  try {
    assert.equal(
      await readCover(new File(['pixels'], 'a.jpg', { type: 'image/jpeg' })),
      png,
    );
    assert.equal(canvas.width, 768);
    assert.equal(canvas.height, 1152);
    assert.deepEqual(draw, [0, 0, 768, 1152]);
    assert.equal(revoked, 1);
  } finally {
    URL.createObjectURL = oldCreate;
    URL.revokeObjectURL = oldRevoke;
    if (originalImage)
      Object.defineProperty(globalThis, 'Image', originalImage);
    else Reflect.deleteProperty(globalThis, 'Image');
    if (originalDocument)
      Object.defineProperty(globalThis, 'document', originalDocument);
    else Reflect.deleteProperty(globalThis, 'document');
  }
});
