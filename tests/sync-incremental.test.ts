import { test } from 'node:test';
import assert from 'node:assert/strict';
import 'fake-indexeddb/auto';
import { seed } from '../src/core/model.ts';
import { Drive, remoteHeads } from '../src/sync/drive.ts';
import { digest, pack, unpack } from '../src/sync/blocks.ts';
import { mergeLibraries, syncEqual } from '../src/sync/merge.ts';
import { readRecovery, verifyRemoteBackup } from '../src/sync/recovery.ts';
import { replaceFromLocal } from '../src/sync/replace.ts';
import { illustratedLibrary, jpeg } from './illustrated-fixture.ts';
import { imageInventory } from '../src/core/image-inventory.ts';

const noWait = async () => {};
async function evictCache(hashes?: string[]) {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {
    const r = indexedDB.open('feder-sync-cache', 1);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction('blocks', 'readwrite');
    if (hashes)
      for (const hash of hashes) tx.objectStore('blocks').delete(hash);
    else tx.objectStore('blocks').clear();
    tx.oncomplete = () => resolve();
    tx.onabort = () => reject(tx.error);
  });
  db.close();
}
function server() {
  let next = 0;
  const files = new Map<
    string,
    {
      id: string;
      description?: string;
      appProperties?: Record<string, string>;
      text: string;
    }
  >();
  const sessions = new Map<
    string,
    { metadata: Record<string, unknown>; bytes: Uint8Array; id?: string }
  >();
  const requests: { method: string; url: string; range: string | null }[] = [];
  let uploadedBytes = 0,
    blockReads = 0,
    failBlock = false;
  let interruptAfterReceipt = false;
  const fetch = async (
    input: string | URL | Request,
    init: RequestInit = {},
  ) => {
    const url = input instanceof Request ? input.url : input.toString(),
      method = init.method || 'GET';
    const headers = new Headers(init.headers);
    requests.push({ method, url, range: headers.get('Content-Range') });
    if (method === 'POST') {
      const session = 'https://www.googleapis.com/upload/session/' + ++next;
      sessions.set(session, {
        metadata: JSON.parse(init.body as string),
        bytes: new Uint8Array(),
      });
      return new Response('', { headers: { Location: session } });
    }
    if (method === 'PUT') {
      const session = sessions.get(url)!;
      const range = headers.get('Content-Range')!;
      const status = () =>
        session.id
          ? Response.json({ id: session.id })
          : new Response(null, {
              status: 308,
              headers: session.bytes.length
                ? { Range: `bytes=0-${session.bytes.length - 1}` }
                : {},
            });
      if (range.startsWith('bytes */')) return status();
      if (
        failBlock &&
        (session.metadata.appProperties as Record<string, string>)?.federBlock
      )
        return new Response(null, { status: 403 });
      const [, start, end, total] = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(range)!;
      assert.equal(Number(start), session.bytes.length);
      const body = new Uint8Array(await (init.body as Blob).arrayBuffer());
      assert.equal(body.length, Number(end) - Number(start) + 1);
      assert.ok(body.length <= 256 * 1024);
      const bytes = new Uint8Array(session.bytes.length + body.length);
      bytes.set(session.bytes);
      bytes.set(body, session.bytes.length);
      session.bytes = bytes;
      uploadedBytes += body.length;
      if (bytes.length === Number(total)) {
        session.id = 'file-' + ++next;
        files.set(session.id, {
          ...session.metadata,
          id: session.id,
          text: new TextDecoder().decode(bytes),
        });
      }
      if (interruptAfterReceipt) {
        interruptAfterReceipt = false;
        throw new DOMException('Fetch aborted', 'AbortError');
      }
      return status();
    }
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/files')) {
      const query = parsed.searchParams.get('q')!;
      const block = query.includes('federBlock');
      const requestedHashes = [
        ...query.matchAll(/key='hash' and value='([a-f0-9]{64})'/g),
      ].map((match) => match[1]);
      return Response.json({
        files: [...files.values()].filter((f) =>
          block
            ? f.appProperties?.federBlock === '2' &&
              (!requestedHashes.length ||
                requestedHashes.includes(f.appProperties?.hash || ''))
            : f.appProperties?.federSync === '1',
        ),
      });
    }
    const id = parsed.pathname.split('/').at(-1)!;
    const file = files.get(id);
    if (method === 'DELETE') {
      files.delete(id);
      return new Response(null, { status: 204 });
    }
    if (method === 'PATCH') {
      if (!file) return new Response(null, { status: 404 });
      const changes = JSON.parse(init.body as string);
      file.appProperties = { ...file.appProperties, ...changes.appProperties };
      return Response.json({ id });
    }
    if (!file) return new Response(null, { status: 404 });
    if (file.appProperties?.federBlock) blockReads++;
    return new Response(file.text);
  };
  return {
    fetch,
    files,
    requests,
    get uploadedBytes() {
      return uploadedBytes;
    },
    get blockReads() {
      return blockReads;
    },
    set failBlock(value: boolean) {
      failBlock = value;
    },
    set interruptAfterReceipt(value: boolean) {
      interruptAfterReceipt = value;
    },
  };
}

void test('incremental sync migrates legacy data and transfers only changed blocks, including across devices', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const library = seed();
  library.projects[0].scenes[0].text = 'Ein langer Roman 😀. '.repeat(40000);
  library.snapshots.push({
    id: 'version-1',
    date: new Date().toISOString(),
    project: structuredClone(library.projects[0]),
  });
  api.files.set('legacy', {
    id: 'legacy',
    appProperties: { federSync: '1' },
    description: JSON.stringify({ protocol: 1, parents: [] }),
    text: JSON.stringify({ protocol: 1, parents: [], library }),
  });
  const drive = new Drive('test', () => {}, noWait);
  const old = (await drive.list())[0];
  assert.deepEqual(await drive.read(old), library);
  const id = await drive.create(library, ['legacy']);
  let heads = remoteHeads(await drive.list());
  assert.equal(heads[0].id, id);
  assert.equal(heads[0].protocol, 2);
  await evictCache();
  assert.deepEqual(await drive.read(heads[0]), library);
  assert.ok(
    api.blockReads > 0,
    'cold device downloads and verifies content blocks',
  );
  const oldHashes = Object.keys(JSON.parse(api.files.get(id)!.text).blocks);
  const before = api.uploadedBytes;
  const changed = structuredClone(library);
  changed.projects[0].scenes[0].text =
    'X' + changed.projects[0].scenes[0].text.slice(1);
  const newer = new Drive('test', () => {}, noWait);
  const changedId = await newer.create(changed, [id]);
  const newHashes = Object.keys(
    JSON.parse(api.files.get(changedId)!.text).blocks,
  );
  const changedHashes = newHashes.filter((hash) => !oldHashes.includes(hash));
  await evictCache(changedHashes); // Simulate another device with the previous cache.
  const delta = api.uploadedBytes - before;
  assert.ok(delta < 100000, `Expected small delta, uploaded ${delta} bytes`);
  // Old manifests may be cleaned up, but their shared content must remain.
  await newer.remove('legacy');
  await newer.remove(id);
  heads = remoteHeads(await newer.list());
  assert.equal(heads[0].id, changedId);
  const beforeRead = api.blockReads;
  assert.deepEqual(
    await new Drive('test', () => {}, noWait).read(heads[0]),
    changed,
  );
  assert.equal(
    api.blockReads - beforeRead,
    changedHashes.length,
    'second device downloads only new blocks',
  );
  const reads = api.blockReads;
  await new Drive('test', () => {}, noWait).read(heads[0]);
  assert.equal(
    api.blockReads,
    reads,
    'verified persistent cache avoids repeat block downloads',
  );
  t.diagnostic(
    `Changed one character in an ~880 KB manuscript plus snapshot: ${delta} uploaded bytes.`,
  );
});

void test('completed blocks survive failed manifest publication and are reused on retry', async (t) => {
  const api = server();
  let failCommit = true;
  t.mock.method(
    globalThis,
    'fetch',
    async (url: string, init: RequestInit = {}) => {
      if (
        failCommit &&
        init.method === 'POST' &&
        JSON.parse(init.body as string).appProperties?.federSync
      )
        return new Response(null, { status: 403 });
      return api.fetch(url, init);
    },
  );
  const library = seed();
  await assert.rejects(
    new Drive('test', () => {}, noWait).create(library, []),
    /Drive-Zugriff abgelehnt/,
  );
  const blockCount = api.files.size;
  assert.ok(blockCount > 0);
  assert.equal((await new Drive('test').list()).length, 0);
  failCommit = false;
  const id = await new Drive('test', () => {}, noWait).create(library, []);
  assert.equal(api.files.size, blockCount + 1, 'only the manifest was added');
  assert.equal(remoteHeads(await new Drive('test').list())[0].id, id);
});

void test('a small sync change probes hashes without listing the entire block history', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const library = seed();
  const drive = new Drive('test', () => {}, noWait);
  const head = await drive.create(library, []);
  await drive.read({ id: head, parents: [], date: 'now', protocol: 2 });
  const edited = structuredClone(library);
  edited.projects[0].scenes[0].text += ' Ein Satz.';
  const before = api.requests.length;
  await drive.create(edited, [head]);
  const searches = api.requests
    .slice(before)
    .filter(
      (r) => r.method === 'GET' && new URL(r.url).pathname.endsWith('/files'),
    );
  assert.equal(searches.length, 1);
  assert.ok(
    searches.every((r) =>
      new URL(r.url).searchParams.get('q')?.includes("key='hash'"),
    ),
  );
});

void test('persistent network aborts stop after bounded retries with a useful message', async (t) => {
  let calls = 0;
  t.mock.method(
    globalThis,
    'fetch',
    async (_url: string, init: RequestInit = {}) => {
      if (init.method === 'POST')
        return new Response(null, {
          headers: { Location: 'https://www.googleapis.com/upload/test' },
        });
      calls++;
      throw new DOMException('Fetch aborted', 'AbortError');
    },
  );
  await assert.rejects(
    new Drive('test', () => {}, noWait).upload('data', {}, 'Buch übertragen'),
    /Buch übertragen: Netzwerkübertragung unterbrochen/,
  );
  assert.equal(calls, 4);
});

void test('resumable upload probes acknowledged bytes after interruption and resumes at server offset', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  api.interruptAfterReceipt = true;
  const text = 'ä😀'.repeat(150000);
  const id = await new Drive('test', () => {}, noWait).upload(text, {}, 'Test');
  assert.equal(api.files.get(id)!.text, text);
  assert.ok(api.requests.some((r) => r.range?.startsWith('bytes */')));
  assert.ok(api.requests.some((r) => r.range?.startsWith('bytes 262144-')));
  assert.equal(
    api.uploadedBytes,
    new Blob([text]).size,
    'acknowledged bytes were not resent',
  );
});

void test('lost final response is confirmed without duplicate upload', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  api.interruptAfterReceipt = true;
  const id = await new Drive('test', () => {}, noWait).upload(
    'small',
    {},
    'Test',
  );
  assert.equal(api.files.get(id)!.text, 'small');
  assert.equal(api.files.size, 1);
});

void test('failed block upload never publishes a head or removes an existing backup', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const drive = new Drive('test', () => {}, noWait);
  const library = seed(),
    id = await drive.create(library, []);
  library.projects[0].title = 'Neue Änderung';
  api.failBlock = true;
  await assert.rejects(drive.create(library, [id]), /Drive-Zugriff abgelehnt/);
  assert.deepEqual(
    remoteHeads(await drive.list()).map((h) => h.id),
    [id],
  );
  assert.equal(api.requests.filter((r) => r.method === 'DELETE').length, 0);
});

void test('parallel incremental heads preserve both edits and can merge after parent cleanup', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const base = seed(),
    drive = new Drive('test', () => {}, noWait);
  const first = await drive.create(base, []);
  const local = structuredClone(base),
    remote = structuredClone(base);
  local.projects[0].scenes[0].text = 'Mac';
  remote.projects[0].scenes[0].text = 'iPad';
  await drive.create(local, [first]);
  await drive.create(remote, [first]);
  await drive.remove(first);
  const heads = remoteHeads(await drive.list());
  assert.equal(heads.length, 2);
  const a = await drive.read(heads[0]),
    b = await drive.read(heads[1]);
  const merged = mergeLibraries(null, a, b).library;
  assert.deepEqual(
    new Set(merged.projects.map((p) => p.scenes[0].text)),
    new Set(['Mac', 'iPad']),
  );
  await drive.create(
    merged,
    heads.map((h) => h.id),
  );
  assert.ok(
    syncEqual(await drive.read(remoteHeads(await drive.list())[0]), merged),
  );
});

void test('chunk codec rejects corruption and round-trips escaped unicode and special keys', async () => {
  const value = JSON.parse('{"__proto__":{"safe":true},"text":"hello"}');
  value.text = '\\"😀\n'.repeat(40000);
  const packed = await pack(value);
  const rebuilt = await unpack(packed.root, async (hash) =>
    packed.blocks.get(hash)!,
  );
  assert.equal(JSON.stringify(rebuilt), JSON.stringify(value));
  await assert.rejects(
    unpack(packed.root, async () => '{}'),
    /Beschädigter/,
  );
  const bad = JSON.stringify({
    kind: 'object',
    entries: [['x', 'not-a-hash']],
  });
  await assert.rejects(
    unpack(await digest(bad), async () => bad),
    /Ungültige Verknüpfung/,
  );
});

void test('download body abort retries, while permanent errors do not loop', async (t) => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => {
    if (++calls === 1)
      return new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new DOMException('Fetch aborted', 'AbortError'));
          },
        }),
      );
    return Response.json({ ok: true });
  });
  const drive = new Drive('test', () => {}, noWait);
  assert.deepEqual(await drive.json('https://www.googleapis.com/test'), {
    ok: true,
  });
  assert.equal(calls, 2);
  t.mock.method(globalThis, 'fetch', async () => {
    calls++;
    return new Response(null, { status: 401 });
  });
  await assert.rejects(
    drive.json('https://www.googleapis.com/test'),
    /Anmeldung abgelaufen/,
  );
  assert.equal(calls, 3);
});

void test('Drive rescue reads complete remote blocks even when browser cache hides a missing block, and an older stand remains recoverable', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const drive = new Drive('test', () => {}, noWait);
  const original = seed();
  original.projects[0].scenes[0].text = 'Vollständiger älterer Stand';
  const firstId = await drive.create(original, []);
  const first = (await drive.list()).find((r) => r.id === firstId)!;
  await verifyRemoteBackup(drive, first, original);
  const changed = structuredClone(original);
  changed.projects[0].scenes[0].text = 'Neuer Stand';
  const secondId = await drive.create(changed, [firstId]);
  const second = (await drive.list()).find((r) => r.id === secondId)!;
  await verifyRemoteBackup(drive, second, changed);
  const firstManifest = JSON.parse(api.files.get(firstId)!.text);
  const secondManifest = JSON.parse(api.files.get(secondId)!.text);
  const uniqueHash = Object.keys(secondManifest.blocks).find(
    (hash) => !firstManifest.blocks[hash],
  )!;
  api.files.delete(secondManifest.blocks[uniqueHash]);
  assert.deepEqual(
    await drive.read(second),
    changed,
    'optional warm cache can still serve this browser',
  );
  await assert.rejects(readRecovery(drive, second), /404/);
  assert.deepEqual(await readRecovery(drive, first), original);
  assert.ok(api.files.has(firstId));
  assert.ok(api.files.has(secondId));
  assert.equal(api.requests.filter((r) => r.method === 'DELETE').length, 0);
});
void test('complete Drive roundtrip verifies versions and rejects a different expected library', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const drive = new Drive('test', () => {}, noWait);
  const library = seed();
  library.snapshots.push({
    id: 'restore-version',
    date: 'now',
    project: structuredClone(library.projects[0]),
  });
  const id = await drive.create(library, []);
  const record = (await drive.list()).find((r) => r.id === id)!;
  await verifyRemoteBackup(drive, record, library);
  assert.deepEqual(await readRecovery(drive, record), library);
  const wrong = structuredClone(library);
  wrong.projects[0].scenes[0].text = 'Unbestätigte Änderungen';
  await assert.rejects(
    verifyRemoteBackup(drive, record, wrong),
    /stimmt nicht/,
  );
});
void test('recovery listing keeps valid older backups available when another manifest description is corrupt', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const drive = new Drive('test', () => {}, noWait);
  const library = seed();
  const id = await drive.create(library, []);
  api.files.set('broken-description', {
    id: 'broken-description',
    appProperties: { federSync: '1' },
    description: 'not JSON',
    text: 'broken',
  });
  await assert.rejects(drive.list(), /beschädigt/);
  const records = await drive.list({ recovery: true });
  assert.ok(records.find((r) => r.id === 'broken-description')?.invalid);
  assert.deepEqual(
    await readRecovery(
      drive,
      records.find((r) => r.id === id)!,
    ),
    library,
  );
});

void test('local authority replaces damaged Drive metadata and missing blocks with fresh verified data including all images', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const drive = new Drive('test', () => {}, noWait);
  const broken = seed();
  broken.projects[0].title = 'Defekter Stand';
  const oldId = await drive.create(broken, []);
  const oldManifest = JSON.parse(api.files.get(oldId)!.text);
  api.files.delete(oldManifest.blocks[oldManifest.root]);
  api.files.set('broken-metadata', {
    id: 'broken-metadata',
    description: 'broken',
    appProperties: { federSync: '1' },
    text: 'broken',
  });
  const library = illustratedLibrary();
  const before = structuredClone(library);
  const record = await replaceFromLocal(drive, library);
  assert.deepEqual(library, before, 'local data is never replaced or mutated');
  assert.deepEqual(await readRecovery(drive, record), library);
  assert.deepEqual(
    imageInventory(await readRecovery(drive, record)),
    imageInventory(library),
  );
  const active = remoteHeads(await drive.list());
  assert.equal(active.length, 1);
  assert.equal(active[0].id, record.id);
  assert.deepEqual(
    await readRecovery(new Drive('other-device', () => {}, noWait), active[0]),
    library,
  );
  assert.ok(api.files.has(oldId));
  assert.ok(
    (await drive.list({ recovery: true })).some(
      (r) => r.id === 'broken-metadata',
    ),
  );
  assert.equal(api.requests.filter((r) => r.method === 'DELETE').length, 0);
});
void test('a missing portrait block cannot publish or supersede an existing valid Drive backup', async (t) => {
  const api = server();
  const old = seed();
  const drive = new Drive('test', () => {}, noWait);
  t.mock.method(globalThis, 'fetch', api.fetch);
  const oldId = await drive.create(old, []);
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const response = await api.fetch(input, init);
      const candidate = [...api.files.values()].find(
        (file) => file.appProperties?.federCandidate === '1',
      );
      if (candidate) {
        const manifest = JSON.parse(candidate.text);
        const imageId = Object.values(manifest.blocks).find((id) =>
          api.files.get(id as string)?.text.includes(jpeg),
        );
        if (imageId) api.files.delete(imageId as string);
      }
      return response;
    },
  );
  await assert.rejects(replaceFromLocal(drive, illustratedLibrary()), /404/);
  assert.deepEqual(
    remoteHeads(await drive.list()).map((r) => r.id),
    [oldId],
  );
  assert.deepEqual(await readRecovery(drive, (await drive.list())[0]), old);
  assert.equal(
    api.requests.filter((r) => r.method === 'PATCH' || r.method === 'DELETE')
      .length,
    0,
  );
});
void test('another device publishing during repair prevents promotion of the candidate', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const old = seed();
  const drive = new Drive('test', () => {}, noWait);
  const oldId = await drive.create(old, []);
  let inserted = false;
  t.mock.method(
    globalThis,
    'fetch',
    async (input: string | URL | Request, init?: RequestInit) => {
      const response = await api.fetch(input, init);
      if (
        !inserted &&
        [...api.files.values()].some(
          (file) => file.appProperties?.federCandidate === '1',
        )
      ) {
        inserted = true;
        api.files.set('peer', {
          id: 'peer',
          appProperties: { federSync: '1' },
          description: JSON.stringify({ protocol: 1, parents: [oldId] }),
          text: JSON.stringify({ protocol: 1, parents: [oldId], library: old }),
        });
      }
      return response;
    },
  );
  await assert.rejects(
    replaceFromLocal(drive, illustratedLibrary()),
    /anderes Gerät/,
  );
  assert.deepEqual(
    remoteHeads(await drive.list()).map((r) => r.id),
    ['peer'],
  );
  assert.equal(api.requests.filter((r) => r.method === 'PATCH').length, 0);
});
void test('changing local data during repair prevents candidate promotion', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const drive = new Drive('test', () => {}, noWait);
  let checks = 0;
  await assert.rejects(
    replaceFromLocal(drive, illustratedLibrary(), () => {
      if (++checks > 1) throw Error('Lokale Änderungen');
    }),
    /Lokale Änderungen/,
  );
  assert.deepEqual(await drive.list(), []);
  assert.equal(api.requests.filter((r) => r.method === 'PATCH').length, 0);
});
void test('acknowledged upload progress and cold download progress finish at their measured totals', async (t) => {
  const api = server();
  t.mock.method(globalThis, 'fetch', api.fetch);
  const events: import('../src/sync/transfer-progress.ts').TransferProgress[] =
    [];
  const drive = new Drive(
    'test',
    () => {},
    noWait,
    (progress) => events.push(progress),
  );
  const library = illustratedLibrary();
  const id = await drive.create(library, []);
  const upload = events.filter((e) => e.phase === 'Sicherung hochladen');
  assert.ok(upload.length > 1);
  assert.equal(upload.at(-1)!.completed, upload.at(-1)!.total);
  const record = (await drive.list()).find((r) => r.id === id)!;
  await readRecovery(drive, record);
  const download = events.filter(
    (e) => e.phase === 'Sicherung vollständig aus Drive prüfen',
  );
  assert.ok(download.length > 1);
  assert.equal(download.at(-1)!.completed, download.at(-1)!.total);
});
