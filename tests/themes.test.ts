import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  schemes,
  themeTokens,
  readScheme,
  storeScheme,
} from '../src/core/themes.ts';
function luminance(hex: string) {
  const rgb = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return rgb[0] * 0.2126 + rgb[1] * 0.7152 + rgb[2] * 0.0722;
}
function contrast(a: string, b: string) {
  const x = luminance(a),
    y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}
void test('all palettes have readable body, muted and button text in both modes', () => {
  for (const scheme of schemes)
    for (const dark of [false, true]) {
      const t = themeTokens(scheme.id, dark);
      for (const [fg, bg] of [
        ['foreground', 'background'],
        ['card-foreground', 'card'],
        ['muted-foreground', 'card'],
        ['muted-foreground', 'background'],
        ['primary-foreground', 'primary'],
      ])
        assert.ok(
          contrast(t[fg], t[bg]) >= 4.5,
          `${scheme.id} ${dark} ${fg}/${bg}`,
        );
      assert.deepEqual(
        Object.keys(t),
        Object.keys(themeTokens('petrol', false)),
      );
    }
});
void test('scheme preference survives reads, tolerates invalid and unavailable storage', () => {
  const old = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const data = new Map();
  try {
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, v: string) => data.set(key, v),
      },
    });
    assert.equal(readScheme(), 'petrol');
    storeScheme('sand');
    assert.equal(readScheme(), 'sand');
    data.set('feder.appearance.scheme', 'invalid');
    assert.equal(readScheme(), 'petrol');
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      get: () => {
        throw Error('blocked');
      },
    });
    assert.equal(readScheme(), 'petrol');
    assert.doesNotThrow(() => storeScheme('forest'));
  } finally {
    if (old) Object.defineProperty(globalThis, 'localStorage', old);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
