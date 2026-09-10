import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readAccessibility,
  storeAccessibility,
  defaultAccessibility,
} from '../src/core/accessibility.ts';
void test('accessibility settings persist with bounded values and safe fallback for old or corrupt preferences', () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  let raw: string | null = null;
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: () => raw,
        setItem: (_key: string, value: string) => (raw = value),
      },
    });
    assert.deepEqual(readAccessibility(), defaultAccessibility);
    storeAccessibility({
      ...defaultAccessibility,
      fontSize: 28,
      lineHeight: 2.1,
      font: 'sans',
      largeTargets: true,
      reducedMotion: true,
    });
    assert.equal(readAccessibility().fontSize, 28);
    assert.equal(readAccessibility().font, 'sans');
    assert.equal(readAccessibility().largeTargets, true);
    raw = JSON.stringify({ fontSize: 200, lineHeight: 100, font: 'invalid' });
    assert.deepEqual(readAccessibility(), defaultAccessibility);
    raw = '{';
    assert.deepEqual(readAccessibility(), defaultAccessibility);
  } finally {
    if (previous) Object.defineProperty(globalThis, 'localStorage', previous);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
