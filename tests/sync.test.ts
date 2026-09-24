import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seed, newProject } from '../src/core/model.ts';
import { mergeLibraries, syncEqual } from '../src/sync/merge.ts';
import { Drive, remoteHeads } from '../src/sync/drive.ts';

void test('damaged or unknown remote data aborts before upload or deletion', async (t) => {
  const requests: string[] = [];
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, init: RequestInit) => {
      requests.push(init.method || 'GET');
      return Response.json({
        files: [
          {
            id: 'bad',
            description: JSON.stringify({ protocol: 3, parents: [] }),
          },
        ],
      });
    },
  );
  await assert.rejects(new Drive('test').list(), /Unbekanntes Syncformat/);
  assert.deepEqual(requests, ['GET']);
  assert.throws(
    () =>
      remoteHeads([
        { id: 'a', parents: ['b'], date: '' },
        { id: 'b', parents: ['a'], date: '' },
        { id: 'c', parents: [], date: '' },
      ]),
    /Ungültiger Drive-Verlauf/,
  );
});

void test('Drive reading validates complete libraries and unicode payloads', async (t) => {
  const library = seed();
  library.projects[0].title = 'Grüße 😀';
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ protocol: 1, parents: [], library }),
  );
  const drive = new Drive('test');
  assert.deepEqual(
    await drive.read({ id: 'remote', parents: [], date: '' }),
    library,
  );
  await assert.rejects(
    drive.read({ id: 'remote', parents: ['missing'], date: '' }),
    /Unvollständiger Syncstand/,
  );
});

void test('three-way sync takes remote edits and keeps independent local projects', () => {
  const base = seed(),
    local = structuredClone(base),
    remote = structuredClone(base);
  const extra = newProject('Lokal');
  local.projects.push(extra);
  remote.projects[0].scenes[0].text = 'Neue Fassung vom iPad';
  const result = mergeLibraries(base, local, remote);
  assert.equal(
    result.library.projects[0].scenes[0].text,
    'Neue Fassung vom iPad',
  );
  assert.ok(result.library.projects.some((p) => p.id === extra.id));
  assert.equal(result.conflicts.length, 0);
  assert.equal(
    local.projects[0].scenes[0].text,
    base.projects[0].scenes[0].text,
  );
});

void test('simultaneous project edits retain both complete versions and converge', () => {
  const base = seed(),
    local = structuredClone(base),
    remote = structuredClone(base);
  local.projects[0].scenes[0].text = 'PC';
  remote.projects[0].scenes[0].text = 'iPad';
  const merged = mergeLibraries(base, local, remote);
  assert.deepEqual(
    merged.library.projects.map((p) => p.scenes[0].text),
    ['PC', 'iPad'],
  );
  assert.match(merged.library.projects[1].title, /Konfliktkopie/);
  assert.equal(merged.conflicts.length, 1);
  const again = mergeLibraries(base, merged.library, remote);
  assert.equal(again.library.projects.length, 2);
  assert.ok(
    syncEqual(
      merged.library,
      mergeLibraries(merged.library, merged.library, merged.library).library,
    ),
  );
});

void test('purged projects cannot return through conflicts or snapshots', () => {
  const base = seed(),
    local = structuredClone(base),
    remote = structuredClone(base);
  const id = base.projects[0].id;
  local.purgedProjectIds = [id];
  local.projects[0].title = 'Lokal geändert';
  remote.projects[0].title = 'Remote geändert';
  remote.snapshots.push({
    id: 'old',
    date: new Date().toISOString(),
    project: structuredClone(remote.projects[0]),
  });
  const result = mergeLibraries(base, local, remote).library;
  assert.ok(result.projects.every((p) => !p.id.startsWith(id)));
  assert.equal(result.snapshots.length, 0);
});

void test('simultaneous shared-world edits preserve remote project links', () => {
  const base = seed();
  base.worlds = [{ id: 'world', name: 'Welt', cards: [] }];
  base.projects[0].worldId = 'world';
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.worlds![0].name = 'Lokal';
  remote.worlds![0].name = 'Remote';
  const result = mergeLibraries(base, local, remote).library;
  assert.equal(result.worlds!.length, 2);
  assert.ok(
    result.projects.every((p) =>
      result.worlds!.some((w) => w.id === p.worldId),
    ),
  );
  assert.ok(result.projects.some((p) => p.worldId !== 'world'));
});

void test('immutable uploads leave parallel writes intact and reject foreign upload hosts', async (t) => {
  let next = 0;
  const requests: { url: string; method: string; body?: string }[] = [];
  t.mock.method(globalThis, 'fetch', async (url: string, init: RequestInit) => {
    requests.push({
      url,
      method: init.method || 'GET',
      body: init.body as string,
    });
    assert.equal(
      new Headers(init.headers).get('Authorization'),
      'Bearer test-token',
    );
    if (init.method === 'POST')
      return new Response('', {
        headers: {
          Location: 'https://www.googleapis.com/upload/session/' + ++next,
        },
      });
    return Response.json({ id: 'file-' + url.split('/').at(-1) });
  });
  const drive = new Drive('test-token');
  const [a, b] = await Promise.all([
    drive.upload(JSON.stringify(seed()), { description: 'test' }, 'Test'),
    drive.upload(JSON.stringify(seed()), { description: 'test' }, 'Test'),
  ]);
  assert.notEqual(a, b);
  assert.equal(
    requests.filter((r) => r.method === 'DELETE' || r.method === 'PATCH')
      .length,
    0,
  );
  assert.deepEqual(
    remoteHeads([
      { id: 'old', parents: [], date: '' },
      { id: a, parents: ['old'], date: '' },
      { id: b, parents: ['old'], date: '' },
    ])
      .map((r) => r.id)
      .sort(),
    [a, b].sort(),
  );
  await assert.rejects(
    drive.request('https://example.com/upload'),
    /Ungültige Drive-Adresse/,
  );
  assert.equal(requests.length, 4);
});
