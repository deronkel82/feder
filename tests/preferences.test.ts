import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readDarkMode, storeDarkMode } from '../src/core/preferences.ts';
void test('dark and light preference persists across reads; inaccessible storage is tolerated', () => {
  const values = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => values.get(k) || null,
      setItem: (k: string, v: string) => values.set(k, v),
    },
  });
  assert.equal(readDarkMode(), false);
  storeDarkMode(true);
  assert.equal(readDarkMode(), true);
  storeDarkMode(false);
  assert.equal(readDarkMode(), false);
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    get() {
      throw Error('blocked');
    },
  });
  assert.equal(readDarkMode(), false);
  assert.doesNotThrow(() => storeDarkMode(true));
});
