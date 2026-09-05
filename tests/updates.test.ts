import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
void test('service worker installs without forcing reload; activation rejects other open clients', async () => {
  const handlers = new Map<string, (e: unknown) => void>();
  let activations = 0;
  let windows = [
    { id: 'one', url: 'https://example.test/feder/' },
    { id: 'two', url: 'https://example.test/feder/' },
  ];
  const source = readFileSync('scripts/sw-template.txt', 'utf8')
    .replace('__VERSION__', '"test"')
    .replace('__ASSETS__', '["./index.html"]');
  runInNewContext(source, {
    self: {
      registration: { scope: 'https://example.test/feder/' },
      location: { origin: 'https://example.test' },
      addEventListener: (name: string, fn: (e: unknown) => void) =>
        handlers.set(name, fn),
      clients: {
        matchAll: () => Promise.resolve(windows),
        claim: () => Promise.resolve(),
      },
      skipWaiting: () => {
        activations++;
        return Promise.resolve();
      },
    },
    caches: {
      open: () => Promise.resolve({ addAll: () => Promise.resolve() }),
    },
    URL,
  });
  let job = Promise.resolve();
  handlers.get('install')!({
    waitUntil: (p: Promise<void>) => {
      job = p;
    },
  });
  await job;
  assert.equal(activations, 0);
  let reply: { ok?: boolean; error?: string } = {};
  const msg = () =>
    handlers.get('message')!({
      data: { type: 'ACTIVATE_SAFELY' },
      source: { id: 'one' },
      ports: [
        {
          postMessage: (v: typeof reply) => {
            reply = v;
          },
        },
      ],
      waitUntil: (p: Promise<void>) => {
        job = p;
      },
    });
  msg();
  await job;
  assert.equal(reply.ok, false);
  assert.equal(activations, 0);
  windows = [windows[0]];
  msg();
  await job;
  assert.equal(reply.ok, true);
  assert.equal(activations, 1);
});
