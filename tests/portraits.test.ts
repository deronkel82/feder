import { test } from 'node:test';
import assert from 'node:assert/strict';
import { characterSearch, validPortrait } from '../src/core/characters.ts';
import { seed, validateLibrary } from '../src/core/model.ts';
import { readPortrait } from '../src/modules/portrait-image.ts';

const portrait = 'data:image/jpeg;base64,AAAA';
void test('figure portraits survive library validation without entering search text', () => {
  const library = seed();
  library.projects[0].cards[0].character = {
    firstName: 'Mara',
    lastName: 'Winter',
    nickname: '',
    age: '',
    title: '',
    faction: '',
    roles: [],
    portrait,
  };
  assert.equal(validPortrait(portrait), true);
  assert.deepEqual(validateLibrary(library), library);
  assert.match(characterSearch(library.projects[0].cards[0].character), /Mara/);
  assert.ok(
    !characterSearch(library.projects[0].cards[0].character).includes('AAAA'),
  );
  library.projects[0].cards[0].character.portrait =
    'https://example.com/photo.jpg';
  assert.throws(() => validateLibrary(library), /Figurenprofil/);
});

void test('portrait upload rejects unsupported and oversized files before decoding', async () => {
  await assert.rejects(
    readPortrait(new File(['svg'], 'a.svg', { type: 'image/svg+xml' })),
    /JPG/,
  );
  await assert.rejects(
    readPortrait(
      new File([new Uint8Array(21 * 1024 * 1024)], 'a.png', {
        type: 'image/png',
      }),
    ),
    /20 MB/,
  );
});
